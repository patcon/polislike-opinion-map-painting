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
from pathlib import Path

from reddwarf.data_loader import Loader
from reddwarf.utils.matrix import generate_raw_matrix, simple_filter_matrix
from reddwarf.utils.polismath import extract_data_from_polismath
from reddwarf.utils.statements import process_statements


from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.decomposition import PCA
from reddwarf.sklearn.transformers import SparsityAwareScaler
from pacmap import PaCMAP, LocalMAP
import numpy as np
import requests

# --- CLI Handling ---
def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report-id", help="Polis report ID", default=None)
    parser.add_argument("--convo-id", help="Polis conversation ID", default=None)
    parser.add_argument("--import-dir", help="Directory with previously downloaded data", default=None)
    parser.add_argument("--slug", help="Optional directory name override")
    return parser.parse_args()

# --- Projection Helpers ---
def run_projection(name, data, seed, raw_vote_matrix):
    pipe = None
    if name == "PCA":
        pipe = Pipeline([
            ("impute", SimpleImputer(missing_values=np.nan, strategy="mean")),
            ("pca", PCA(n_components=2, random_state=seed)),
            ("scale", SparsityAwareScaler(X_sparse=raw_vote_matrix.values)),
        ])
    elif name == "PaCMAP":
        pipe = Pipeline([
            ("impute", SimpleImputer(missing_values=np.nan, strategy="mean")),
            ("pacmap", PaCMAP(n_components=2, random_state=seed)),
        ])
    elif name == "LocalMAP":
        pipe = Pipeline([
            ("impute", SimpleImputer(missing_values=np.nan, strategy="mean")),
            ("localmap", LocalMAP(n_components=2, random_state=seed)),
        ])
    else:
        raise ValueError(f"Unknown projection method: {name}")
    return pipe.fit_transform(data)

# --- Save Vote Matrix to SQLite ---
def save_votes_db(raw_vote_matrix, participant_ids, outpath):
    print("🗃️  Creating votes.db from filtered participants")
    df = raw_vote_matrix.loc[participant_ids].copy()
    df = df.reset_index().rename(columns={"index": "participant_id"})  # Keep participant_id as a column
    long_df = df.melt(id_vars="participant_id", var_name="comment_id", value_name="vote")
    long_df = long_df.dropna(subset=["vote"]).astype({
        "participant_id": str,
        "comment_id": str,
        "vote": int
    })

    conn = sqlite3.connect(outpath)
    long_df.to_sql("votes", conn, index=False, if_exists="replace")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_participant ON votes(participant_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_comment ON votes(comment_id)")
    conn.commit()
    conn.close()
    print(f"✅ Saved votes.db with {len(long_df)} rows")

# --- Main Logic ---
def main():
    args = parse_args()
    if not (args.convo_id or args.report_id or args.import_dir):
        raise ValueError("You must pass one of --convo-id, --report-id, or --import-dir")

    # Load data
    print(f"📦 Loading Polis data...")
    if args.import_dir:
        print(f"🔍 Loading from directory: {args.import_dir}")
        loader = Loader(filepaths=[
            os.path.join(args.import_dir, "comments.json"),
            os.path.join(args.import_dir, "votes.json"),
            os.path.join(args.import_dir, "math-pca2.json"),
            os.path.join(args.import_dir, "conversation.json"),
        ])
    elif args.report_id:
        print(f"🔍 Loading via report ID: {args.report_id}")
        loader = Loader(polis_id=args.report_id, data_source="csv_export")
        loader.load_api_data_report()
        loader.conversation_id = loader.report_data["conversation_id"]
        loader.load_api_data_math()
        loader.load_api_data_conversation()
    else:
        print(f"🔍 Loading via conversation ID: {args.convo_id}")
        loader = Loader(polis_id=args.convo_id)

    slug = args.slug or loader.conversation_id
    outdir = Path("data") / slug
    outdir.mkdir(parents=True, exist_ok=True)
    print(f"📁 Output directory: {outdir}")

    # Process votes
    _, _, mod_out_statement_ids, _ = process_statements(loader.comments_data)
    raw_vote_matrix = generate_raw_matrix(loader.votes_data)
    filtered_vote_matrix = simple_filter_matrix(raw_vote_matrix, mod_out_statement_ids)

    # Save statements.json from loader.comments_data
    with open(outdir / "statements.json", "w") as f:
        json.dump(loader.comments_data, f, indent=2)
    print("✅ Saved statements.json from loader")   

    clustered_pids, _ = extract_data_from_polismath(loader.math_data)
    safe_ids = [pid for pid in clustered_pids if pid in raw_vote_matrix.index]

    # Apply cluster_mask for saving only clustered participants
    clustered_pids, _ = extract_data_from_polismath(loader.math_data)
    cluster_mask = [pid in clustered_pids for pid in raw_vote_matrix.index]

    # Save projections
    projections = {}
    for name in ["PCA", "PaCMAP", "LocalMAP"]:
        print(f"🔄 Running projection: {name}")
        X = run_projection(name, filtered_vote_matrix.values, seed=42, raw_vote_matrix=raw_vote_matrix)
        X_filtered = X[cluster_mask]

        # Get participant_ids matching filtered projection
        filtered_pids = raw_vote_matrix.index[cluster_mask].tolist()
        X_with_ids = list(zip(filtered_pids, X_filtered.tolist()))

        with open(outdir / f"{name.lower()}.json", "w") as f:
            json.dump(X_with_ids, f, indent=2)

    # Save votes.db
    clustered_pids, _ = extract_data_from_polismath(loader.math_data)
    safe_ids = [pid for pid in clustered_pids if pid in raw_vote_matrix.index]
    save_votes_db(raw_vote_matrix, safe_ids, outdir / "votes.db")

    print(f"Done! Files written to {outdir}")

if __name__ == "__main__":
    print("🚀 Starting Red-Dwarf report generator")

    main()