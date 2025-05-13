/**
 * Opinion Map Painting Application
 *
 * A visualization tool for exploring and analyzing opinion clusters
 * in conversation data.
 */

/**
 * Helper function to check if z-score is significant at 90% confidence
 * @param {number} zVal - Z-score
 * @returns {boolean} - True if significant
 */
function zSig90(zVal) {
  return zVal > Config.stats.significanceThreshold;
}

/**
 * Two-proportion z-test
 * @param {number} succIn - Successes in group
 * @param {number} succOut - Successes outside group
 * @param {number} popIn - Population in group
 * @param {number} popOut - Population outside group
 * @returns {number} - Z-score
 */
function twoPropTest(succIn, succOut, popIn, popOut) {
  const adjustedSuccIn = succIn + 1;
  const adjustedSuccOut = succOut + 1;
  const adjustedPopIn = popIn + 1;
  const adjustedPopOut = popOut + 1;

  const pi1 = adjustedSuccIn / adjustedPopIn;
  const pi2 = adjustedSuccOut / adjustedPopOut;
  const piHat =
    (adjustedSuccIn + adjustedSuccOut) / (adjustedPopIn + adjustedPopOut);

  if (piHat === 1) return 0;

  return (
    (pi1 - pi2) /
    Math.sqrt(piHat * (1 - piHat) * (1 / adjustedPopIn + 1 / adjustedPopOut))
  );
}

/**
 * Add comparative statistics to comment stats
 * @param {Object} inStats - Stats for in-group
 * @param {Object} restStats - Stats for out-group
 * @returns {Object} - Combined stats
 */
function addComparativeStats(inStats, restStats) {
  // Sum up values across other groups
  const sumOtherNa = restStats.reduce((sum, g) => sum + g.na, 0);
  const sumOtherNd = restStats.reduce((sum, g) => sum + g.nd, 0);
  const sumOtherNs = restStats.reduce((sum, g) => sum + g.ns, 0);

  // Calculate relative agreement and disagreement
  const ra = inStats.pa / ((1 + sumOtherNa) / (2 + sumOtherNs));
  const rd = inStats.pd / ((1 + sumOtherNd) / (2 + sumOtherNs));

  // Calculate z-scores for the differences between proportions
  const rat = twoPropTest(inStats.na, sumOtherNa, inStats.ns, sumOtherNs);
  const rdt = twoPropTest(inStats.nd, sumOtherNd, inStats.ns, sumOtherNs);

  return {
    ...inStats,
    ra,
    rd,
    rat,
    rdt,
  };
}

/**
 * Get group vote matrices
 * @param {Object} db - Database instance
 * @param {Array} labelArray - Array of labels
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
    // Properly quote participant IDs as they are strings
    const quotedIndices = indices.map(pid => `'${pid}'`);
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

  console.log(groupVotes);
  return groupVotes;
}

/**
 * Check if a comment passes the significance test
 * @param {Object} commentStats - Comment statistics
 * @returns {boolean} - True if passes test
 */
function passesByTest(commentStats) {
  return (
    (zSig90(commentStats.rat) && zSig90(commentStats.pat)) ||
    (zSig90(commentStats.rdt) && zSig90(commentStats.pdt))
  );
}

/**
 * Check if a comment beats the best by z-score
 * @param {Object} commentStats - Comment statistics
 * @param {number} currentBestZ - Current best z-score
 * @returns {boolean} - True if beats best
 */
function beatsBestByTest(commentStats, currentBestZ) {
  return (
    currentBestZ === null ||
    Math.max(commentStats.rat, commentStats.rdt) > currentBestZ
  );
}

/**
 * Check if a comment beats the best by agreement
 * @param {Object} commentStats - Comment statistics
 * @param {Object} currentBest - Current best stats
 * @returns {boolean} - True if beats best
 */
function beatsBestAgr(commentStats, currentBest) {
  const { na, nd, ra, rat, pa, pat } = commentStats;
  if (na === 0 && nd === 0) return false;
  if (currentBest && currentBest.ra > 1.0) {
    return (
      ra * rat * pa * pat >
      currentBest.ra * currentBest.rat * currentBest.pa * currentBest.pat
    );
  }
  if (currentBest) {
    return pa * pat > currentBest.pa * currentBest.pat;
  }
  return zSig90(pat) || (ra > 1.0 && pa > 0.5);
}

/**
 * Finalize comment statistics
 * @param {string} tid - Comment ID
 * @param {Object} stats - Comment statistics
 * @returns {Object} - Finalized stats
 */
function finalizeCommentStats(tid, stats) {
  const { na, nd, ns, pa, pd, pat, pdt, ra, rd, rat, rdt } = stats;
  const isAgreeMoreRep = (rat > rdt && na >= Config.stats.minVotes) || nd < Config.stats.minVotes;
  const repful_for = isAgreeMoreRep ? "agree" : "disagree";

  return {
    tid,
    n_agree: na,
    n_disagree: nd,
    n_pass: ns - na - nd,
    n_success: isAgreeMoreRep ? na : nd,
    n_trials: ns,
    p_success: isAgreeMoreRep ? pa : pd,
    p_test: isAgreeMoreRep ? pat : pdt,
    repness: isAgreeMoreRep ? ra : rd,
    repness_test: isAgreeMoreRep ? rat : rdt,
    repful_for,
  };
}

function repnessMetric(data) {
  return data.repness * data.repness_test * data.p_success * data.p_test;
}

/**
 * Sort comments by agreement before disagreement
 * @param {Array} comments - Comments to sort
 * @returns {Array} - Sorted comments
 */
function agreesBeforeDisagrees(comments) {
  const agrees = comments.filter((c) => c.repful_for === "agree");
  const disagrees = comments.filter((c) => c.repful_for === "disagree");
  return [...agrees, ...disagrees];
}

/**
 * Select representative comments
 * @param {Array} commentStatsWithTid - Comment statistics
 * @returns {Array} - Representative comments
 */
function selectRepComments(commentStatsWithTid) {
  const result = {};
  const includeModerated = document.getElementById("include-moderated-checkbox")?.checked;

  if (commentStatsWithTid.length === 0) return {};

  const groupIds = Object.keys(commentStatsWithTid[0][1]);

  groupIds.forEach((gid) => {
    result[gid] = { best: null, best_agree: null, sufficient: [] };
  });

  commentStatsWithTid.forEach(([tid, groupsData]) => {
    const comment = AppState.data.commentTextMap?.[tid];
    // TODO: Get this working for strict moderation (-1 or 0)
    // This doesn't work in upstream Polis either, so has feature parity rn.
    const isModerated = comment?.mod === "-1" || comment?.mod === -1;
    if (isModerated && !includeModerated) return;

    Object.entries(groupsData).forEach(([gid, commentStats]) => {
      const groupResult = result[gid];

      if (passesByTest(commentStats)) {
        groupResult.sufficient.push(finalizeCommentStats(tid, commentStats));
      }

      if (
        beatsBestByTest(commentStats, groupResult.best?.repness_test || null)
      ) {
        groupResult.best = finalizeCommentStats(tid, commentStats);
      }

      if (beatsBestAgr(commentStats, groupResult.best_agree)) {
        groupResult.best_agree = { ...commentStats, tid };
      }
    });
  });

  const finalResult = {};

  Object.entries(result).forEach(([gid, { best, best_agree, sufficient }]) => {
    let bestAgreeComment = null;
    if (best_agree) {
      bestAgreeComment = finalizeCommentStats(best_agree.tid, best_agree);
      bestAgreeComment.best_agree = true;
    }

    let selectedComments = [];
    if (bestAgreeComment) {
      selectedComments.push(bestAgreeComment);
      sufficient = sufficient.filter((c) => c.tid !== bestAgreeComment.tid);
    }

    const sortedSufficient = sufficient.sort(
      (a, b) => repnessMetric(b) - repnessMetric(a)
    );

    selectedComments = [...selectedComments, ...sortedSufficient].slice(0, 20);

    finalResult[gid] = agreesBeforeDisagrees(selectedComments);
  });

  return finalResult;
}

/**
 * Proportion test
 * @param {number} succ - Successes
 * @param {number} n - Total
 * @returns {number} - Z-score
 */
function propTest(succ, n) {
  const adjustedSucc = succ + 1;
  const adjustedN = n + 1;
  return 2 * Math.sqrt(adjustedN) * (adjustedSucc / adjustedN - 0.5);
}

/**
 * Calculate representative comments
 * @param {Object} groupVotes - Group votes
 * @param {Array} commentTexts - Comment texts
 * @returns {Object} - Representative comments by group
 */
function calculateRepresentativeComments(groupVotes, commentTexts) {
  const allComments = commentTexts
    ? commentTexts.map((c) => c.id)
    : Array.from(
      new Set(
        Object.values(groupVotes)
          .flatMap((group) => Object.values(group))
          .flatMap((votes) => Object.keys(votes).map(Number))
      )
    ).sort((a, b) => a - b); // unique sorted comment_ids
  const allGroups = Object.keys(groupVotes);
  const commentStatsWithTid = [];

  allComments.forEach((commentId, commentIndex) => {
    const commentStats = {};

    for (const [groupId, groupMatrix] of Object.entries(groupVotes)) {
      let agrees = 0,
        disagrees = 0,
        passes = 0,
        seen = 0;
      for (const voteRow of Object.values(groupMatrix)) {
        const vote = voteRow[commentIndex];
        if (vote != null) {
          seen++;
          if (vote === 1) agrees++;
          else if (vote === -1) disagrees++;
          else passes++;
        }
      }

      const pa = (agrees + 1) / (seen + 2);
      const pd = (disagrees + 1) / (seen + 2);
      const pat = propTest(agrees, seen);
      const pdt = propTest(disagrees, seen);

      commentStats[groupId] = {
        na: agrees,
        nd: disagrees,
        ns: seen,
        pa,
        pd,
        pat,
        pdt,
      };
    }

    commentStatsWithTid.push([commentId, commentStats]);
  });

  // Add comparative stats
  const withComparatives = commentStatsWithTid.map(([tid, stats]) => {
    const processed = {};
    for (const [gid, stat] of Object.entries(stats)) {
      const rest = Object.entries(stats)
        .filter(([otherGid]) => otherGid !== gid)
        .map(([, s]) => s);
      processed[gid] = addComparativeStats(stat, rest);
    }
    return [tid, processed];
  });

  const repCommentMap = selectRepComments(withComparatives, commentTexts);

  return repCommentMap;
}

/**
 * Get label array with optional ungrouped points
 * @returns {Array} - Label array
 */
function getLabelArrayWithOptionalUngrouped() {
  const includeUnpainted = document.getElementById("include-unpainted").checked;
  const labels = [];

  for (let i = 0; i < AppState.selection.colorByIndex.length; i++) {
    const label = AppState.selection.colorByIndex[i];
    if (label) {
      labels.push(label);
    } else if (includeUnpainted) {
      labels.push("black"); // Treat unpainted points as a group
    } else {
      labels.push(null); // Exclude from analysis
    }
  }

  return labels;
}

/**
 * Analyze painted clusters
 * @param {Object} db - Database instance
 * @param {Array} labelArray - Label array
 * @param {Array} commentTexts - Comment texts
 * @returns {Promise<Object>} - Representative comments
 */
async function analyzePaintedClusters(db, labelArray, commentTexts) {
  const groupVotes = await getGroupVoteMatrices(db, labelArray);
  const repComments = calculateRepresentativeComments(groupVotes, commentTexts);

  // Store the raw group votes data for use in the comparison view
  AppState.data.groupVotes = groupVotes;

  console.log("Representative Comments:", repComments);
  return repComments;
}

/**
 * Apply group analysis
 */
async function applyGroupAnalysis() {
  const output = document.getElementById("rep-comments-output");

  const labelArray = getLabelArrayWithOptionalUngrouped(); // same as "unpainted"

  // Count distinct labels, excluding nulls
  const uniqueLabels = new Set(labelArray.filter((x) => x !== null));
  if (uniqueLabels.size < 2) {
    output.innerHTML = `<p style="color: #c00; font-weight: bold;">Need at least two groups to analyze.</p>`;
    return;
  }

  // 👉 SHOW loader before starting analysis, because freezes plots.
  showPlotLoader();

  // Create a loading overlay instead of replacing content
  const loadingOverlay = document.createElement("div");
  loadingOverlay.className = "absolute inset-0 bg-white bg-opacity-80 z-10";
  loadingOverlay.id = "analysis-loader";
  loadingOverlay.innerHTML = `
    <div class="sticky top-0 left-0 w-full bg-primary-100 p-2 flex items-center justify-center space-x-3 shadow-md">
      <div class="w-5 h-5 border-3 border-primary-300 border-t-primary-600 rounded-full animate-spin"></div>
      <span class="font-medium text-primary-800">Analyzing groups…</span>
    </div>
  `;

  // Make sure the output container has relative positioning for the absolute overlay
  if (window.getComputedStyle(output).position === 'static') {
    output.style.position = 'relative';
  }

  // Add the overlay to the output container
  output.appendChild(loadingOverlay);

  // 🔥 FORCE a DOM paint before continuing with long task
  await preworkRenderPipelinePauseHelper();

  const db = await loadVotesDB(AppState.preferences.convoSlug);
  let commentTexts;
  const rep = await analyzePaintedClusters(db, labelArray, commentTexts);

  // Remove the loading overlay
  const loader = document.getElementById("analysis-loader");
  if (loader) {
    loader.remove();
  }

  // Now render the new content
  renderRepCommentsTable(rep);

  // 👉 HIDE loader after analysis and render complete
  hidePlotLoader();
}

// ============================================================================
// Application Initialization
// ============================================================================

/**
 * Initialize the application
 */
function initializeApp() {
  // Initialize application state
  AppState.init();

  // Initialize UI with stored preferences
  initializeUI();

  // Set up event listeners
  setupEventListeners();

  // First load the dataset list to ensure dropdown is populated
  loadDatasetList()
    .then(() => {
      // Check for shared state in URL hash
      const hash = location.hash.slice(1);
      if (hash) {
        const shared = decodeShareState(hash);
        if (shared) {
          // Explicitly handle custom labels if they exist in the shared state
          if (shared.customLabels && Object.keys(shared.customLabels).length > 0) {
            console.log("Found custom labels in shared state:", shared.customLabels);
            AppState.selection.customLabels = shared.customLabels;
            saveState("customLabels", shared.customLabels);
          }

          applySharedState(shared);
          return; // ✅ Don't run normal startup; already handled
        }
      }

      // Only run if no shared state
      loadAndRenderData(AppState.preferences.convoSlug);
    });
}

/**
 * Forces the browser to render pending DOM updates before continuing.
 * Use this after DOM changes (like showing a spinner) but before heavy work.
 *
 * @returns {Promise<void>} Resolves on the next tick, after paint.
 */
function preworkRenderPipelinePauseHelper() {
  return new Promise((r) => setTimeout(r, 0));
}

// Initialize the application when the DOM is loaded
window.addEventListener("DOMContentLoaded", initializeApp);

// For testing purposes, export objects and functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    twoPropTest,
    zSig90,
    // Add other functions you want to test
  };
}
