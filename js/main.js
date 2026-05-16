/**
 * Opinion Map Painting Application
 *
 * A visualization tool for exploring and analyzing opinion clusters
 * in conversation data.
 */

import {
    calculateRepresentativeComments,
    selectConsensusStatements,
} from "reddwarf-ts";

// config.js runs before this module and sets these on window
const Config = window.Config;
const AppState = window.AppState;

/**
 * Get group vote matrices from sql.js database
 * @param {Object} db - sql.js Database instance
 * @param {Array} labelArray - Array of group labels per participant
 * @returns {Promise<Object>} - Group vote matrices
 */
async function getGroupVoteMatrices(db, labelArray) {
    const groups = {};
    labelArray.forEach((label, index) => {
        if (label != null) {
            const pid = AppState.data.participants?.[index];
            if (pid !== undefined) {
                if (!groups[label]) groups[label] = [];
                groups[label].push(pid);
            }
        }
    });

    const groupVotes = {};
    for (const [label, indices] of Object.entries(groups)) {
        const quotedIndices = indices.map((pid) => `'${pid}'`);
        const result = db.exec(`
      SELECT participant_id, comment_id, vote
      FROM votes
      WHERE participant_id IN(${quotedIndices.join(",")})
  `);

        const voteMatrix = {};
        const rows = result[0]?.values || [];
        rows.forEach(([pid, cid, vote]) => {
            if (!voteMatrix[pid]) voteMatrix[pid] = {};
            voteMatrix[pid][cid] = vote;
        });

        groupVotes[label] = voteMatrix;
    }

    return groupVotes;
}

/**
 * Get label array with optional ungrouped points
 * @returns {Array} - Label array
 */
function getLabelArrayWithOptionalUngrouped() {
    const includeUnpainted =
        document.getElementById("include-unpainted").checked;
    const labels = [];

    for (let i = 0; i < AppState.selection.colorByIndex.length; i++) {
        const label = AppState.selection.colorByIndex[i];
        if (label) {
            labels.push(label);
        } else if (includeUnpainted) {
            labels.push("black");
        } else {
            labels.push(null);
        }
    }

    return labels;
}

/**
 * Analyze painted clusters
 * @param {Object} db - sql.js Database instance
 * @param {Array} labelArray - Label array
 * @param {Array} commentTexts - Comment texts
 * @returns {Promise<Object>} - Representative comments by group
 */
async function analyzePaintedClusters(db, labelArray, commentTexts) {
    const includeModerated = document.getElementById(
        "include-moderated-checkbox",
    )?.checked;
    const minVoteCount =
        parseInt(document.getElementById("min-vote-count")?.value) || 1;
    const maxStatementsCount =
        parseInt(document.getElementById("max-statements-count")?.value) || 10;

    const groupVotes = await getGroupVoteMatrices(db, labelArray);

    const repComments = calculateRepresentativeComments(
        groupVotes,
        commentTexts,
        {
            includeModerated,
            minVoteCount,
            maxStatementsCount,
            commentTextMap: AppState.data.commentTextMap,
        },
    );

    AppState.data.groupVotes = groupVotes;

    const uniqueGroups = Object.keys(groupVotes);
    let consensusStatements = null;
    if (uniqueGroups.length >= 2) {
        const modOutStatementIds = [];
        if (!includeModerated && AppState.data.commentTexts) {
            AppState.data.commentTexts.forEach((comment) => {
                const isModerated =
                    comment?.mod === "-1" || comment?.mod === -1;
                if (isModerated) {
                    modOutStatementIds.push(comment.tid);
                }
            });
        }

        consensusStatements = selectConsensusStatements(
            groupVotes,
            modOutStatementIds,
            null,
            0.5,
            { minVoteCount, maxStatementsCount },
        );
        console.log("Consensus Statements:", consensusStatements);
    }

    AppState.data.consensusStatements = consensusStatements;

    console.log("Representative Comments:", repComments);
    return repComments;
}

/**
 * Apply group analysis
 */
async function applyGroupAnalysis() {
    const output = document.getElementById("rep-comments-output");

    const labelArray = getLabelArrayWithOptionalUngrouped();

    const uniqueLabels = new Set(labelArray.filter((x) => x !== null));
    if (uniqueLabels.size < 2) {
        output.innerHTML = `<p style="color: #c00; font-weight: bold;">Need at least two groups to analyze.</p>`;
        return;
    }

    // 👉 SHOW loader before starting analysis, because freezes plots.
    window.showPlotLoader();

    const loadingOverlay = document.createElement("div");
    loadingOverlay.className = "absolute inset-0 bg-white bg-opacity-80 z-10";
    loadingOverlay.id = "analysis-loader";
    loadingOverlay.innerHTML = `
    <div class="sticky top-0 left-0 w-full bg-primary-100 p-2 flex items-center justify-center space-x-3 shadow-md">
      <div class="w-5 h-5 border-3 border-primary-300 border-t-primary-600 rounded-full animate-spin"></div>
      <span class="font-medium text-primary-800">Analyzing groups…</span>
    </div>
  `;

    if (window.getComputedStyle(output).position === "static") {
        output.style.position = "relative";
    }

    output.appendChild(loadingOverlay);

    // 🔥 FORCE a DOM paint before continuing with long task
    await preworkRenderPipelinePauseHelper();

    const db = await window.loadVotesDB(AppState.preferences.convoSlug);
    let commentTexts;
    const rep = await analyzePaintedClusters(db, labelArray, commentTexts);

    const loader = document.getElementById("analysis-loader");
    if (loader) {
        loader.remove();
    }

    window.renderRepCommentsTable(rep);

    // 👉 HIDE loader after analysis and render complete
    window.hidePlotLoader();
}

// ============================================================================
// Application Initialization
// ============================================================================

/**
 * Initialize the application
 */
function initializeApp() {
    AppState.init();

    window.initializeUI();

    window.setupEventListeners();

    window.updatePlotVisibility();

    window.loadDatasetList().then(() => {
        const hash = location.hash.slice(1);
        if (hash) {
            const shared = window.decodeShareState(hash);
            if (shared) {
                if (
                    shared.customLabels &&
                    Object.keys(shared.customLabels).length > 0
                ) {
                    console.log(
                        "Found custom labels in shared state:",
                        shared.customLabels,
                    );
                    AppState.selection.customLabels = shared.customLabels;
                    window.saveState("customLabels", shared.customLabels);
                }

                window.applySharedState(shared);
                return;
            }
        }

        window.loadAndRenderData(AppState.preferences.convoSlug);
    });
}

/**
 * Forces the browser to render pending DOM updates before continuing.
 *
 * @returns {Promise<void>} Resolves on the next tick, after paint.
 */
function preworkRenderPipelinePauseHelper() {
    return new Promise((r) => setTimeout(r, 0));
}

// Initialize the application when the DOM is loaded
window.addEventListener("DOMContentLoaded", initializeApp);

// Expose to window for ui.js (loaded as a classic script that references these as globals)
window.applyGroupAnalysis = applyGroupAnalysis;
window.getLabelArrayWithOptionalUngrouped = getLabelArrayWithOptionalUngrouped;
