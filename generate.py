# Usage:
#
#   $ uv run python generate.py --report-id r7cwmiaxczyj8te9rzdmx
#   $ uv run python generate.py --convo-id 9usurb2mmh
#   $ uv run python generate.py --import-dir ../somedir
#   $ uv run python generate.py --report-id r7cwmiaxczyj8te9rzdmx --slug demdis-eu

import argparse
import os
import json
import sqlite3
import types
from pathlib import Path
from typing import cast

from reddwarf.data_loader import Loader
from reddwarf.implementations.base import ClustererType, ReducerType, run_pipeline
from reddwarf.utils.statements import process_statements
from reddwarf.utils.polismath import get_corrected_centroid_guesses
from urllib.parse import urlparse


# --- CLI Handling ---
def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", help="Full Polis URL to a conversation or report")
    parser.add_argument("--report-id", help="Polis report ID", default=None)
    parser.add_argument("--convo-id", help="Polis conversation ID", default=None)
    parser.add_argument(
        "--import-dir", help="Directory with previously downloaded data", default=None
    )

    # Get slug from environment variable if available
    default_slug = os.environ.get("POLIS_DATASET_SLUG")
    parser.add_argument(
        "--slug",
        "--slugs",
        dest="slug",
        default=default_slug,
        help="Dataset slug(s) to create or update (comma-separated). Can also be set with POLIS_DATASET_SLUG env var.",
    )
    parser.add_argument(
        "--polis-base-url",
        default="https://pol.is",
        help="Base URL for Polis API (default: https://pol.is)",
    )
    parser.add_argument(
        "--ca-bundle", help="Path to custom CA bundle for HTTPS verification"
    )
    return parser.parse_args()


def parse_url_metadata(url: str):
    parsed = urlparse(url)
    path_parts = parsed.path.strip("/").split("/")

    if not path_parts:
        raise ValueError(f"URL path is empty: {url}")

    # Last part is always the ID
    maybe_id = path_parts[-1]
    base_url = f"{parsed.scheme}://{parsed.netloc}"

    if maybe_id.startswith("r"):
        return {"base_url": base_url, "report_id": maybe_id}
    elif maybe_id[0].isdigit():
        return {"base_url": base_url, "convo_id": maybe_id}
    else:
        raise ValueError(f"Could not detect ID type in URL: {url}")


# --- Save Vote Matrix to SQLite ---
def save_votes_db(raw_vote_matrix, participant_ids, outpath):
    print("🗃️  Creating votes.db from filtered participants")
    df = raw_vote_matrix.loc[participant_ids].copy()
    df = df.reset_index().rename(
        # Keep participant_id as a column
        columns={"index": "participant_id"}
    )
    long_df = df.melt(
        id_vars="participant_id", var_name="comment_id", value_name="vote"
    )
    long_df = long_df.dropna(subset=["vote"]).astype(
        {"participant_id": str, "comment_id": str, "vote": int}
    )

    conn = sqlite3.connect(outpath)
    long_df.to_sql("votes", conn, index=False, if_exists="replace")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_participant ON votes(participant_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_comment ON votes(comment_id)")
    conn.commit()
    conn.close()
    print(f"✅ Saved votes.db with {len(long_df)} rows")


# --- Update Mode Helpers ---
def get_url_from_meta(slug):
    """Extract report_url or conversation_url from meta.json for a given slug"""
    meta_path = Path("data/datasets") / slug / "meta.json"

    if not meta_path.exists():
        raise ValueError(f"No meta.json found for slug: {slug}")

    with open(meta_path, "r") as f:
        meta = json.load(f)

    # Prefer report_url if available, otherwise use conversation_url
    if meta.get("report_url"):
        return meta["report_url"]
    elif meta.get("conversation_url"):
        return meta["conversation_url"]
    else:
        raise ValueError(
            f"No report_url or conversation_url found in meta.json for slug: {slug}"
        )


# --- Main Logic ---
def process_single_dataset(
    slug=None,
    url=None,
    report_id=None,
    convo_id=None,
    import_dir=None,
    polis_base_url="https://pol.is",
    ca_bundle=None,
):
    """Process a single dataset with the given parameters"""
    update_mode = False
    args_dict = {
        "slug": slug,
        "url": url,
        "report_id": report_id,
        "convo_id": convo_id,
        "import_dir": import_dir,
        "polis_base_url": polis_base_url,
        "ca_bundle": ca_bundle,
    }

    # Create a namespace object that mimics argparse.Namespace
    args = types.SimpleNamespace(**args_dict)

    # Handle update mode when only slug is provided
    if args.slug and not (
        args.url or args.report_id or args.convo_id or args.import_dir
    ):
        print(f"🔄 Update mode: Looking up URL for provided slug '{args.slug}'")
        args.url = get_url_from_meta(args.slug)
        print(f"🌐 Found URL: {args.url}")
        update_mode = True

    # Infer from --url if provided
    if args.url:
        print(f"🌐 Parsing metadata from URL: {args.url}")
        parsed = parse_url_metadata(args.url)
        args.polis_base_url = parsed["base_url"]
        args.report_id = parsed.get("report_id")
        args.convo_id = parsed.get("convo_id")

    if not (args.convo_id or args.report_id or args.import_dir or args.url):
        raise ValueError(
            "You must pass one of --convo-id, --report-id, --url, --import-dir, or a valid --slug for update"
        )

    if args.ca_bundle:
        os.environ["REQUESTS_CA_BUNDLE"] = os.path.abspath(args.ca_bundle)
        print(f"🔐 Using custom CA bundle: {os.environ['REQUESTS_CA_BUNDLE']}")

    # Load data
    print("📦 Loading Polis data...")
    base_url = args.polis_base_url
    if args.import_dir:
        print(f"🔍 Loading from directory: {args.import_dir}")
        loader = Loader(
            filepaths=[
                os.path.join(args.import_dir, "comments.json"),
                os.path.join(args.import_dir, "votes.json"),
                os.path.join(args.import_dir, "math-pca2.json"),
                os.path.join(args.import_dir, "conversation.json"),
            ]
        )
        loader.conversation_id = loader.conversation_data["conversation_id"]
    elif args.report_id:
        # TODO: Loader should handle this logic on its own.
        try:
            print(
                f"🔍 Loading via report ID: {args.polis_base_url.rstrip('/')}/report/{args.report_id}"
            )
            loader = Loader(
                polis_instance_url=base_url,
                polis_id=args.report_id,
                data_source="csv_export",
            )
            loader.load_api_data_report()
            loader.conversation_id = loader.report_data["conversation_id"]
            loader.load_api_data_math()
            loader.load_api_data_conversation()
        except Exception as e:
            print(
                f"❌ Fetching CSV Export failed: {e}. (Likely old server). Attempting slower API fetch..."
            )
            loader = Loader(
                polis_instance_url=base_url,
                polis_id=args.report_id,
                data_source="api",
            )
            print(
                f"🔍 Loading via conversation ID: {args.polis_base_url.rstrip('/')}/{loader.conversation_id}"
            )
    else:
        print(
            f"🔍 Loading via conversation ID: {args.polis_base_url.rstrip('/')}/{args.convo_id}"
        )
        loader = Loader(polis_instance_url=base_url, polis_id=args.convo_id)

    # Ensure slug is a string
    slug = args.slug or loader.conversation_id
    if slug is None:
        raise ValueError(
            "Could not determine slug - neither --slug nor conversation_id available"
        )

    outdir = Path("data/datasets") / str(slug)
    outdir.mkdir(parents=True, exist_ok=True)
    print(f"📁 Output directory: {outdir}")

    # Dump raw input files for reuse
    if not args.import_dir:
        dump_dir = Path(".dumps") / str(slug)
        dump_dir.mkdir(parents=True, exist_ok=True)
        print(f"🧾 Dumping raw Polis data to {dump_dir}")
        loader.dump_data(output_dir=str(dump_dir))

    # Process votes
    _, _, mod_out_statement_ids, meta_statement_ids = process_statements(loader.comments_data)

    # Extract the latest vote timestamp
    latest_vote_timestamp = None

    # First try to get lastVoteTimestamp from math_data if available
    if (
        hasattr(loader, "math_data")
        and loader.math_data
        and "lastVoteTimestamp" in loader.math_data
    ):
        latest_vote_timestamp = loader.math_data["lastVoteTimestamp"]
        print(f"📅 Latest vote timestamp from math_data: {latest_vote_timestamp}")
    # Fall back to extracting from votes_data if math_data isn't available
    elif loader.votes_data and len(loader.votes_data) > 0:
        # Find the maximum 'modified' timestamp in the votes data
        # Ensure it's in the same format as lastVoteTimestamp (milliseconds since epoch)
        latest_vote_timestamp = int(
            max(vote.get("modified", 0) for vote in loader.votes_data) * 1000
        )
        print(f"📅 Latest vote timestamp from votes_data: {latest_vote_timestamp}")

    # Save statements.json from loader.comments_data
    with open(outdir / "statements.json", "w") as f:
        json.dump(loader.comments_data, f, indent=2)
    print("✅ Saved statements.json from loader")

    # Whether to use the active participant IDs from the platform rather than recalculate.
    USE_POLIS_PARTICIPANT_IDS = True
    if USE_POLIS_PARTICIPANT_IDS:
        keep_participant_ids = loader.math_data["in-conv"]
    else:
        keep_participant_ids = []

    # Load existing meta.json to get n_neighbors if available
    meta_path = outdir / "meta.json"

    # Setting n_neighbors to None defaults to 10 below 10,000 samples, and
    # slowly increases it according to a formula beyond that.
    # See: https://github.com/YingfanWang/PaCMAP?tab=readme-ov-file#parameters
    # Use override when set.
    # TODO: Intelligently scale this for small polis conversations.
    existing_n_neighbors = None
    if meta_path.exists():
        try:
            with open(meta_path, "r") as f:
                existing_meta = json.load(f)
            existing_n_neighbors = existing_meta.get("n_neighbors")
            if existing_n_neighbors is not None:
                print(
                    f"🔧 Using n_neighbors={existing_n_neighbors} from existing meta.json"
                )
        except (json.JSONDecodeError, IOError) as e:
            print(f"⚠️  Could not read existing meta.json: {e}")

    # Save projections and clustering results
    clustering_algorithms = ["HDBSCAN", "KMeans"]
    votes_db_saved = False  # Track if votes.db has been saved to avoid redundancy

    for reducer in ["PCA", "PaCMAP", "LocalMAP"]:
        print(f"🔄 Running projection: {reducer}")
        reducer_name = cast(ReducerType, reducer.lower())

        if reducer_name in {"pacmap", "localmap"}:
            reducer_kwargs = {"n_neighbors": existing_n_neighbors}
        else:
            reducer_kwargs = {}

        # Run clustering with each algorithm
        for clusterer in clustering_algorithms:
            print(f"🔄 Running {clusterer} clustering for {reducer}")
            clusterer_name = cast(ClustererType, clusterer.lower())

            # Get flip_x and flip_y from meta.json if available, otherwise use defaults
            flip_x = True  # Default value from get_corrected_centroid_guesses
            flip_y = True  # Default value from get_corrected_centroid_guesses

            # Try to read existing meta.json for init_center_guesses configuration
            if meta_path.exists():
                try:
                    with open(meta_path, "r") as f:
                        existing_meta = json.load(f)

                    init_center_config = existing_meta.get("init_center_guesses", {})
                    if "flip_x" in init_center_config:
                        flip_x = init_center_config["flip_x"]
                    if "flip_y" in init_center_config:
                        flip_y = init_center_config["flip_y"]

                except (json.JSONDecodeError, IOError) as e:
                    print(f"⚠️  Could not read existing meta.json for init_center_guesses: {e}")

            polis_init_cluster_center_guesses = get_corrected_centroid_guesses(loader.math_data, flip_x=flip_x, flip_y=flip_y)

            is_polis = (clusterer_name == "kmeans" and reducer_name == "pca")
            if is_polis:
                print(f"🎯 Using {len(polis_init_cluster_center_guesses)} initial cluster centers for PCA + kmeans")

            result = run_pipeline(
                votes=loader.votes_data,
                reducer=reducer_name,
                reducer_kwargs=reducer_kwargs,
                clusterer=clusterer_name,
                # clusterer_kwargs=clusterer_kwargs,
                # TODO: Move this into cluster_kwargs.
                init_centers=polis_init_cluster_center_guesses if is_polis else None,
                mod_out_statement_ids=mod_out_statement_ids,
                meta_statement_ids=meta_statement_ids,
                keep_participant_ids=keep_participant_ids,
                random_state=607642,
            )

            clustered_participants_df = result.participants_df[result.participants_df["to_cluster"]]
            X_clustered = clustered_participants_df.loc[:, ["x", "y"]].values

            # Get participant_ids matching filtered projection
            clustered_pids = clustered_participants_df.index.tolist()
            X_with_ids = list(zip(clustered_pids, X_clustered.tolist()))

            # Save projection data only once per reducer (use first clusterer result)
            if clusterer_name == clustering_algorithms[0]:
                with open(outdir / f"{reducer_name}.json", "w") as f:
                    json.dump(X_with_ids, f, indent=2)

            # Extract and save clustering labels
            if hasattr(clustered_participants_df, 'cluster_id'):
                clustering_labels = clustered_participants_df["cluster_id"].tolist()
                labels_with_ids = list(zip(clustered_pids, clustering_labels))

                with open(outdir / f"labels.{clusterer_name}.{reducer_name}.json", "w") as f:
                    json.dump(labels_with_ids, f, indent=2)

                print(f"✅ Saved {clusterer} clustering results for {reducer}")
            else:
                print(f"⚠️  No clustering labels found for {clusterer} on {reducer}")

            # Save votes.db only once to avoid redundancy
            if not votes_db_saved:
                save_votes_db(result.raw_vote_matrix, clustered_pids, outdir / "votes.db")
                votes_db_saved = True

    # --- Generate or preserve meta.json ---
    meta_path = outdir / "meta.json"
    if meta_path.exists() and not update_mode:
        print("📄 meta.json already exists — preserving it")
    else:
        # If updating, load existing meta.json first
        if meta_path.exists() and update_mode:
            with open(meta_path, "r") as f:
                meta = json.load(f)
            print("🔄 Updating existing meta.json")
        else:
            meta = {
                "about_url": None,
                "conversation_url": f"{args.polis_base_url.rstrip('/')}/{loader.conversation_id}",
                "report_url": None,
                "last_vote": None,  # Initialize last_vote as None for new datasets
                "n_neighbors": None,
                "init_center_guesses": { # defaults
                    "flip_x": True,
                    "flip_y": True,
                },
            }
            print("📝 Creating new meta.json")

        # Update URLs if we have new information
        if hasattr(loader, "report_data") and "report_url" in loader.report_data:
            meta["report_url"] = loader.report_data["report_url"]
        elif args.report_id:
            meta["report_url"] = (
                f"{args.polis_base_url.rstrip('/')}/report/{args.report_id}"
            )

        # Update the last_vote timestamp if we have a new one
        if latest_vote_timestamp is not None:
            old_timestamp = meta.get("last_vote")
            meta["last_vote"] = latest_vote_timestamp

            if old_timestamp != latest_vote_timestamp:
                print(
                    f"📊 Updated last_vote timestamp: {old_timestamp} -> {latest_vote_timestamp}"
                )
            else:
                print(
                    f"📊 No new votes since last update (timestamp: {latest_vote_timestamp})"
                )

        with open(meta_path, "w") as f:
            json.dump(meta, f, indent=2)
        print("✅ Saved meta.json")

        print(f"Done! Files written to {outdir}")

        datasets_path = Path("data/datasets.json")

        # Load existing or create new list
        if datasets_path.exists():
            with open(datasets_path, "r") as f:
                datasets = json.load(f)
        else:
            datasets = []

        # Only add if slug is not already listed
        existing_slugs = {entry["slug"] for entry in datasets}
        if slug not in existing_slugs:
            # Auto-generate label from slug: title case + space-separated
            label = str(slug).replace("-", " ").title()
            new_entry = {"slug": slug, "label": label}
            datasets.append(new_entry)
            print(f"➕ Added new dataset entry: {new_entry}")
        else:
            print(f"✅ Dataset entry for slug '{slug}' already exists in datasets.json")

        # Save back
        with open(datasets_path, "w") as f:
            json.dump(datasets, f, indent=2)
            print("📘 Updated datasets.json")


def main():
    args = parse_args()

    # Handle multiple slugs if provided as comma-separated list
    if (
        args.slug
        and "," in args.slug
        and not (args.url or args.report_id or args.convo_id or args.import_dir)
    ):
        slugs = [s.strip() for s in args.slug.split(",")]
        print(
            f"🔄 Batch update mode: Processing {len(slugs)} slugs: {', '.join(slugs)}"
        )

        for i, slug in enumerate(slugs):
            print(f"\n{'=' * 50}")
            print(f"Processing slug {i + 1}/{len(slugs)}: {slug}")
            print(f"{'=' * 50}\n")
            process_single_dataset(
                slug=slug, polis_base_url=args.polis_base_url, ca_bundle=args.ca_bundle
            )

        print(f"\n✅ Batch processing complete for {len(slugs)} datasets")
        return

    # Process a single dataset
    process_single_dataset(
        slug=args.slug,
        url=args.url,
        report_id=args.report_id,
        convo_id=args.convo_id,
        import_dir=args.import_dir,
        polis_base_url=args.polis_base_url,
        ca_bundle=args.ca_bundle,
    )


if __name__ == "__main__":
    print("🚀 Starting Red-Dwarf report generator")

    main()
