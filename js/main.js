/**
 * Opinion Map Painting Application
 *
 * A visualization tool for exploring and analyzing opinion clusters
 * in conversation data.
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Application configuration constants
 */
const Config = {
  // Default dot opacity
  dotOpacity: 0.3,
  // Default dot size
  dotSize: 3,

  // Reference: https://matplotlib.org/stable/users/explain/colors/colormaps.html#qualitative
  colors: {
    tab10: [
      "#1f77b4", // (A) muted blue
      "#ff7f0e", // (B) safety orange
      "#2ca02c", // (C) cooked asparagus green
      "#d62728", // (D) brick red
      "#9467bd", // (E) muted purple
      "#8c564b", // (F) chestnut brown
      "#e377c2", // (G) raspberry yogurt pink
      "#7f7f7f", // (H) middle gray
      "#bcbd22", // (I) curry yellow-green
      "#17becf", // (J) blue-teal
    ]
  },

  // Chart colors for vote visualization
  voteColors: {
    agree: "rgb(46, 204, 113)",
    disagree: "rgb(231, 76, 60)",
    pass: "rgb(230,230,230)"
  },

  // Statistical thresholds
  stats: {
    minVotes: 3,
    significanceThreshold: 1.2816, // 90% confidence
  }
};

// ============================================================================
// State Management
// ============================================================================

/**
 * Application state management
 */
const AppState = {
  // Dimensions
  dimensions: {
    width: 0,
    height: 0
  },

  // Data
  data: {
    X1: null, // PCA projection
    X2: null, // PaCMAP projection
    X3: null, // LocalMAP projection
    participants: [],
    commentTexts: null,
    commentTextMap: {},
    meta: null,
    repComments: null,
    dbInstance: null
  },

  // UI State
  ui: {
    isDragging: false,
    hoveredIndices: new Set(),
    dotOpacity: Config.dotOpacity,
    dotSize: Config.dotSize
  },

  // Selection state
  selection: {
    colorToLabelIndex: {}, // hex -> int
    colorByIndex: [],
    selectedIndices: new Set()
  },

  // Preferences
  preferences: {
    convoSlug: null,
    isAdditive: false,
    flipX: false,
    flipY: false
  },

  /**
   * Initialize the application state
   */
  init() {
    // Initialize color mapping
    Config.colors.tab10.forEach((color, i) => {
      this.selection.colorToLabelIndex[color] = i;
    });

    // Load preferences from session storage
    this.preferences.convoSlug = getQueryParam("dataset") || loadState("dataset", "bg2050");
    this.preferences.isAdditive = loadState("additive", false);
    this.preferences.flipX = loadState("flipX", false);
    this.preferences.flipY = loadState("flipY", false);
    this.ui.dotOpacity = Config.dotOpacity;
    this.ui.dotSize = Config.dotSize;
  },

  /**
   * Update dimensions based on container size
   */
  updateDimensions() {
    const container = document.getElementById("plot-wrapper");
    const containerWidth = container.clientWidth;
    this.dimensions.width = containerWidth / 3 - 20;
    this.dimensions.height = this.dimensions.width;
  },

  /**
   * Reset data state for a new dataset
   */
  resetDataState() {
    this.data.dbInstance = null;
    this.data.commentTexts = null;
    this.data.repComments = null;
    document.getElementById("rep-comments-output").innerHTML = "";
  }
};

// For backward compatibility with existing code
// These will be gradually removed as code is refactored
let width = 0, height = 0;
let X1, X2, X3;
let dotOpacity = AppState.ui.dotOpacity;
let dotSize = AppState.ui.dotSize;
let isDragging = false;
let hoveredIndices = new Set();
let flipX = false, flipY = false;
const colorToLabelIndex = AppState.selection.colorToLabelIndex;
const colorByIndex = AppState.selection.colorByIndex;
const selectedIndicesGlobal = AppState.selection.selectedIndices;
let isAdditiveDefault = AppState.preferences.isAdditive;
let convoSlug = AppState.preferences.convoSlug;

// ============================================================================
// Data Loading Functions
// ============================================================================

/**
 * Load and render data for a specific dataset
 * @param {string} slug - Dataset identifier
 * @returns {Promise} - Resolves when data is loaded and rendered
 */
function loadAndRenderData(slug) {
  // Reset data state for a new dataset
  AppState.resetDataState();
  window.dbInstance = null; // For backward compatibility

  return new Promise((resolve) => {
    Promise.all([
      d3.json(`data/datasets/${slug}/pca.json`),
      d3.json(`data/datasets/${slug}/pacmap.json`),
      d3.json(`data/datasets/${slug}/localmap.json`),
      d3.json(`data/datasets/${slug}/meta.json`).catch(() => null),
    ]).then(([data1, data2, data3, meta]) => {
      // Store data in AppState
      AppState.data.participants = data1.map(([tid]) => tid);
      AppState.data.meta = meta;

      // For backward compatibility
      window.participants = AppState.data.participants;
      window.meta = meta;

      showPlotLoader();
      renderMetaInfo(meta);

      d3.json(`data/datasets/${slug}/statements.json`).then((rawStatements) => {
        const statements = rawStatements.map((s) => ({
          tid: s.tid ?? s.statement_id,
          pid: s.pid ?? s.participant_id,
          mod: s.mod ?? s.moderated,
          txt: s.txt ?? s.text ?? "<missing>", // optional: fallback for text
          ...s, // keep any other keys
        }));

        AppState.data.commentTexts = statements;
        AppState.data.commentTextMap = Object.fromEntries(statements.map((c) => [c.tid, c]));

        // For backward compatibility
        window.commentTexts = statements;
        window.commentTextMap = AppState.data.commentTextMap;
      });

      // Store projection data
      AppState.data.X1 = data1.map(([, coords]) => coords);
      AppState.data.X2 = data2.map(([, coords]) => coords);
      AppState.data.X3 = data3.map(([, coords]) => coords);

      // For backward compatibility
      X1 = AppState.data.X1;
      X2 = AppState.data.X2;
      X3 = AppState.data.X3;

      // Reset selection state
      AppState.selection.colorByIndex.length = AppState.data.X1.length;
      AppState.selection.colorByIndex.fill(null);
      AppState.selection.selectedIndices.clear();

      // For backward compatibility
      colorByIndex.length = AppState.data.X1.length;
      colorByIndex.fill(null);
      selectedIndicesGlobal.clear();

      // Render UI
      renderAllPlots();
      renderColorPalette();
      updateLabelCounts();
      hidePlotLoader();

      resolve(); // ✅ Important
    });
  });
}

/**
 * Apply shared state from URL or other source
 * @param {Object} state - The state to apply
 * @returns {Promise} - Resolves when state is applied
 */
function applySharedState({
  dataset,
  labelIndices,
  flipX: fx = false,
  flipY: fy = false,
}) {
  // Update AppState
  AppState.preferences.convoSlug = dataset;
  AppState.preferences.flipX = fx;
  AppState.preferences.flipY = fy;

  // For backward compatibility
  convoSlug = dataset;
  flipX = fx;
  flipY = fy;

  // Update UI
  document.getElementById("dataset").value = dataset;
  document.getElementById("flip-x-checkbox").checked = fx;
  document.getElementById("flip-y-checkbox").checked = fy;

  // Save to session storage
  saveState("dataset", dataset);
  saveState("flipX", fx);
  saveState("flipY", fy);

  return loadAndRenderData(dataset).then(() => {
    // Update selection state
    AppState.selection.colorByIndex.length = labelIndices.length;
    AppState.selection.selectedIndices.clear();

    // For backward compatibility
    colorByIndex.length = labelIndices.length;
    selectedIndicesGlobal.clear();

    for (let i = 0; i < labelIndices.length; i++) {
      const idx = labelIndices[i];
      if (idx != null) {
        const color = Config.colors.tab10[idx];
        AppState.selection.colorByIndex[i] = color;
        AppState.selection.selectedIndices.add(i);

        // For backward compatibility
        colorByIndex[i] = color;
        selectedIndicesGlobal.add(i);
      }
    }

    renderAllPlots();
    updateLabelCounts();
  });
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the UI with stored preferences
 */
function initializeUI() {
  document.getElementById("dataset").value = AppState.preferences.convoSlug;
  document.getElementById("toggle-additive").checked = AppState.preferences.isAdditive;
  document.getElementById("include-unpainted").checked = loadState("includeUnpainted", false);
  document.getElementById("auto-analyze-checkbox").checked = loadState("autoAnalyze", true);
  document.getElementById("include-moderated-checkbox").checked = loadState("includeModerated", false);
  document.getElementById("flip-x-checkbox").checked = AppState.preferences.flipX;
  document.getElementById("flip-y-checkbox").checked = AppState.preferences.flipY;

  // Initialize sliders
  document.getElementById("opacity-slider").value = AppState.ui.dotOpacity;
  document.getElementById("opacity-value").textContent = AppState.ui.dotOpacity;
  document.getElementById("dot-size-slider").value = AppState.ui.dotSize;
  document.getElementById("dot-size-value").textContent = AppState.ui.dotSize;

  // Update global variables for backward compatibility
  flipX = AppState.preferences.flipX;
  flipY = AppState.preferences.flipY;
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Share button
  document.getElementById("share-button").addEventListener("click", () => {
    const encoded = encodeShareState();
    const url = `${location.origin}${location.pathname}#${encoded}`;
    const input = document.getElementById("share-url");
    input.value = url;
    input.select();
    document.execCommand("copy");
  });

  // Dataset selection
  document.getElementById("dataset").addEventListener("change", (e) => {
    const selectedDataset = e.target.value;
    AppState.preferences.convoSlug = selectedDataset;
    convoSlug = selectedDataset; // Update global for backward compatibility
    saveState("dataset", selectedDataset);
    loadAndRenderData(selectedDataset);
  });

  // Additive selection mode
  document.getElementById("toggle-additive").addEventListener("change", (e) => {
    const isAdditive = e.target.checked;
    AppState.preferences.isAdditive = isAdditive;
    isAdditiveDefault = isAdditive; // Update global for backward compatibility
    saveState("additive", isAdditive);
  });

  // Include unpainted points
  document.getElementById("include-unpainted").addEventListener("change", (e) => {
    const includeUnpainted = e.target.checked;
    saveState("includeUnpainted", includeUnpainted);
    updateLabelCounts();
    if (document.getElementById("auto-analyze-checkbox").checked) {
      applyGroupAnalysis();
    }
  });

  // Flip X axis
  document.getElementById("flip-x-checkbox").addEventListener("change", (e) => {
    AppState.preferences.flipX = e.target.checked;
    flipX = e.target.checked; // Update global for backward compatibility
    saveState("flipX", AppState.preferences.flipX);
    renderAllPlots();
  });

  // Flip Y axis
  document.getElementById("flip-y-checkbox").addEventListener("change", (e) => {
    AppState.preferences.flipY = e.target.checked;
    flipY = e.target.checked; // Update global for backward compatibility
    saveState("flipY", AppState.preferences.flipY);
    renderAllPlots();
  });

  // Auto analyze
  document.getElementById("auto-analyze-checkbox").addEventListener("change", (e) => {
    const isEnabled = e.target.checked;
    saveState("autoAnalyze", isEnabled);
    if (isEnabled) applyGroupAnalysis();
  });

  // Include moderated comments
  document.getElementById("include-moderated-checkbox").addEventListener("change", (e) => {
    saveState("includeModerated", e.target.checked);
  });

  // Color selection
  document.getElementById("color").addEventListener("input", (e) => {
    const selectedColor = e.target.value;
    if (!(selectedColor in AppState.selection.colorToLabelIndex)) {
      Config.colors.tab10.push(selectedColor); // Add to end
      AppState.selection.colorToLabelIndex[selectedColor] = Config.colors.tab10.length - 1;
      renderColorPalette(); // Refresh palette
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Only trigger on number keys 0–9 and when not typing into an input field
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    const index = parseInt(e.key, 10);

    if (!isNaN(index) && index < Config.colors.tab10.length) {
      const color = Config.colors.tab10[index];
      document.getElementById("color").value = color;
      highlightSelectedColor(color); // visually reflect the change
    }
  });

  // Window resize
  window.addEventListener("resize", () => {
    if (AppState.data.X1 && AppState.data.X2 && AppState.data.X3) renderAllPlots();
  });

  // Opacity slider
  const opacitySlider = document.getElementById("opacity-slider");
  const opacityValueLabel = document.getElementById("opacity-value");
  opacitySlider.addEventListener("input", () => {
    AppState.ui.dotOpacity = parseFloat(opacitySlider.value);
    dotOpacity = AppState.ui.dotOpacity; // Update global for backward compatibility
    opacityValueLabel.textContent = AppState.ui.dotOpacity;
    renderAllPlots(); // Reapply to all plots
  });

  // Dot size slider
  const dotSizeSlider = document.getElementById("dot-size-slider");
  const dotSizeValueLabel = document.getElementById("dot-size-value");
  dotSizeSlider.addEventListener("input", () => {
    AppState.ui.dotSize = parseFloat(dotSizeSlider.value);
    dotSize = AppState.ui.dotSize; // Update global for backward compatibility
    dotSizeValueLabel.textContent = AppState.ui.dotSize;
    saveState("dotSize", AppState.ui.dotSize);
    renderAllPlots(); // Reapply to all plots
  });

  // Run analysis button
  document.getElementById("run-analysis").addEventListener("click", applyGroupAnalysis);
}

// --- Utility Functions ---

function encodeShareState() {
  const dataset = convoSlug;
  const labelIndices = colorByIndex.map((c) =>
    c == null ? null : colorToLabelIndex[c]
  );
  const payload = {
    dataset,
    labelIndices,
    flipX,
    flipY,
  };
  return btoa(JSON.stringify(payload));
}

function decodeShareState(base64) {
  try {
    const json = atob(base64);
    const parsed = JSON.parse(json);

    // Backward compatibility: if old `labels` format is used
    if (parsed.labels) {
      const labelIndices = parsed.labels.map((color) =>
        color == null ? null : colorToLabelIndex[color]
      );
      parsed.labelIndices = labelIndices;
    }

    return {
      dataset: parsed.dataset,
      labelIndices: parsed.labelIndices || [],
      flipX: parsed.flipX || false,
      flipY: parsed.flipY || false,
    };
  } catch (e) {
    console.warn("Invalid share state", e);
    return null;
  }
}

function saveState(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function loadState(key, defaultValue) {
  const saved = sessionStorage.getItem(key);
  return saved !== null ? JSON.parse(saved) : defaultValue;
}

function showPlotLoader() {
  document.getElementById("plot-loader").style.display = "flex";
}

function hidePlotLoader() {
  document.getElementById("plot-loader").style.display = "none";
}

function labelIndexToLetter(i) {
  return String.fromCharCode("A".charCodeAt(0) + i);
}

function getScales(X, width, height, padding = 40) {
  const xExtent = d3.extent(X, (d) => d[0]);
  const yExtent = d3.extent(X, (d) => d[1]);

  const xDomain = flipX ? [...xExtent].reverse() : xExtent;
  const yDomain = flipY ? [...yExtent].reverse() : yExtent;

  return {
    x: d3
      .scaleLinear()
      .domain(xDomain)
      .range([padding, width - padding]),
    y: d3
      .scaleLinear()
      .domain(yDomain)
      .range([height - padding, padding]),
  };
}

function updateDimensions() {
  const container = document.getElementById("plot-wrapper");
  const containerWidth = container.clientWidth;
  width = containerWidth / 3 - 20;
  height = width;
}

function pointInPolygon([x, y], vs) {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const [xi, yi] = vs[i],
      [xj, yj] = vs[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function findIndicesWithinRadius(data, mouseX, mouseY, scales, radius = null) {
  // Use the current dot size for hover detection if no radius is specified
  const hoverRadius = radius || Math.max(dotSize + 5, 10);
  const indices = new Set();
  data.forEach((d, i) => {
    const dx = scales.x(d[0]) - mouseX;
    const dy = scales.y(d[1]) - mouseY;
    if (Math.hypot(dx, dy) < hoverRadius) {
      indices.add(i);
    }
  });
  return indices;
}

function adjustColorForHover(hex, factor = 0.2) {
  if (!hex.startsWith("#")) return hex;
  const toHSL = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  };
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const { h, s, l } = toHSL(r, g, b);
  const lightness = Math.max(
    0,
    Math.min(100, l + (l > 50 ? -1 : 1) * factor * 100)
  );
  return `hsl(${h}, ${s}%, ${lightness}%)`;
}

// --- UI Rendering Functions ---
function renderColorPalette() {
  const container = document.getElementById("color-palette");
  container.innerHTML = "";

  Config.colors.tab10.forEach((color, i) => {
    AppState.selection.colorToLabelIndex[color] = i; // Assign label
    const letter = labelIndexToLetter(i);

    const span = document.createElement("span");
    span.classList.add("palette-color");
    span.setAttribute("data-color", color); // Needed for selection logic
    span.style = `
      display:inline-block; width:24px; height:24px;
      background:${color}; border:1px solid #888;
      margin-right:5px; cursor:pointer; text-align:center;
      line-height:24px; font-size:12px; color:white; font-family:sans-serif;
    `;
    span.title = `${letter} (${color})`;
    span.textContent = letter;

    span.onclick = () => {
      document.getElementById("color").value = color;
      highlightSelectedColor(color);
    };

    container.appendChild(span);
  });

  // Re-apply highlight after re-render
  highlightSelectedColor(document.getElementById("color").value);
}

function createCompactBarChart({ voteCounts, nMembers, voteColors }) {
  const container = document.createElement("div");
  container.style.display = "inline-block";
  container.style.verticalAlign = "middle";
  container.style.marginLeft = "10px";

  let w = 100;
  let agrees = 0;
  let disagrees = 0;
  let sawTheComment = 0;
  let missingCounts = false;

  if (typeof voteCounts !== "undefined") {
    agrees = voteCounts.A ?? 0;
    disagrees = voteCounts.D ?? 0;
    sawTheComment = voteCounts.S ?? 0;
  } else {
    missingCounts = true;
  }

  let passes = sawTheComment - (agrees + disagrees);

  const agree = (agrees / nMembers) * w;
  const disagree = (disagrees / nMembers) * w;
  const pass = (passes / nMembers) * w;

  const agreeSaw = (agrees / sawTheComment) * w || 0;
  const disagreeSaw = (disagrees / sawTheComment) * w || 0;
  const passSaw = (passes / sawTheComment) * w || 0;

  const agreeString = `${agreeSaw.toFixed(0)}%`;
  const disagreeString = `${disagreeSaw.toFixed(0)}%`;
  const passString = `${passSaw.toFixed(0)}%`;

  container.title = `${agreeString} Agreed\n${disagreeString} Disagreed\n${passString} Passed\n${sawTheComment} Respondents`;

  // SVG Bar Chart
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", w + 1);
  svg.setAttribute("height", 10);
  svg.style.marginBottom = "2px";

  const outerRect = document.createElementNS(svgNS, "rect");
  outerRect.setAttribute("x", 0.5);
  outerRect.setAttribute("width", w + 0.5);
  outerRect.setAttribute("height", 10);
  outerRect.setAttribute("fill", "white");
  outerRect.setAttribute("stroke", "rgb(180,180,180)");
  svg.appendChild(outerRect);

  const passRect = document.createElementNS(svgNS, "rect");
  passRect.setAttribute("x", 0.5 + agree + disagree);
  passRect.setAttribute("width", pass);
  passRect.setAttribute("y", 0.5);
  passRect.setAttribute("height", 9);
  passRect.setAttribute("fill", voteColors.pass);
  svg.appendChild(passRect);

  const agreeRect = document.createElementNS(svgNS, "rect");
  agreeRect.setAttribute("x", 0.5);
  agreeRect.setAttribute("width", agree);
  agreeRect.setAttribute("y", 0.5);
  agreeRect.setAttribute("height", 9);
  agreeRect.setAttribute("fill", voteColors.agree);
  svg.appendChild(agreeRect);

  const disagreeRect = document.createElementNS(svgNS, "rect");
  disagreeRect.setAttribute("x", 0.5 + agree);
  disagreeRect.setAttribute("width", disagree);
  disagreeRect.setAttribute("y", 0.5);
  disagreeRect.setAttribute("height", 9);
  disagreeRect.setAttribute("fill", voteColors.disagree);
  svg.appendChild(disagreeRect);

  container.appendChild(svg);

  // Label section
  const label = document.createElement("div");
  label.style.fontSize = "12px";

  if (missingCounts) {
    label.innerHTML = `<span style="color: grey; margin-right: 4px;">Missing vote counts</span>`;
  } else {
    label.innerHTML = `
      <span style="color: ${voteColors.agree}; margin-right: 6px;">${agreeString}</span>
      <span style="color: ${voteColors.disagree}; margin-right: 6px;">${disagreeString}</span>
      <span style="color: #999; margin-right: 6px;">${passString}</span>
      <span style="color: grey;">(${sawTheComment})</span>
    `;
  }

  container.appendChild(label);
  return container;
}

function renderMetaInfo(meta) {
  const container = document.getElementById("meta-info");

  if (!meta) meta = {};

  const items = [
    {
      label: "About:",
      url: meta.about_url,
    },
    {
      label: "Conversation:",
      url: meta.conversation_url,
    },
    {
      label: "Report:",
      url: meta.report_url,
    },
  ];

  container.innerHTML = items
    .map(({ label, url }) => {
      const content = url
        ? `<a href="${url}" target="_blank" style="color: #0066cc;">link</a>`
        : `<span style="color: #999;">n/a</span>`;
      return `<span>${label} ${content}</span>`;
    })
    .join(" &nbsp; | &nbsp; ");
}

function highlightSelectedColor(color) {
  document.querySelectorAll(".palette-color").forEach((el) => {
    const isSelected = el.getAttribute("data-color") === color;
    el.style.outline = isSelected ? "3px solid black" : "none";
  });
}

/**
 * Update the counts of points in each label group
 */
function updateLabelCounts() {
  const counts = {};
  const labelArray = getLabelArrayWithOptionalUngrouped();
  labelArray.forEach((color) => {
    if (color) counts[color] = (counts[color] || 0) + 1;
  });

  const container = document.getElementById("label-counts");

  const ordered = Object.entries(counts).sort(([colorA], [colorB]) => {
    const iA = AppState.selection.colorToLabelIndex[colorA] ?? 999;
    const iB = AppState.selection.colorToLabelIndex[colorB] ?? 999;
    return iA - iB;
  });

  container.innerHTML =
    ordered
      .map(
        ([color, count]) => `
    <span style="margin-right: 12px;">
      <span style="display:inline-block; width:14px; height:14px; background:${color}; border:1px solid #aaa; margin-right:5px; vertical-align:middle;"></span>
      ${count}
    </span>`
      )
      .join("") || "(No selections yet)";
}

/**
 * Apply hover styles to points
 */
function applyHoverStyles() {
  d3.selectAll("circle").each(function () {
    const circle = d3.select(this);
    const index = +circle.attr("data-index");
    const rawColor = AppState.selection.colorByIndex[index];
    const baseColor = rawColor || "#7f7f7f";
    if (AppState.ui.hoveredIndices.has(index)) {
      const hoverColor = adjustColorForHover(baseColor);
      circle.attr("fill", hoverColor).attr("fill-opacity", 0.3).raise();
    } else {
      circle
        .attr("fill", rawColor || "rgba(0,0,0,0.5)")
        .attr("fill-opacity", AppState.ui.dotOpacity);
    }
  });
}

// --- Plotting Functions ---
function makeLassoDragHandler(svg, data, scales) {
  let coords = [];
  let lassoPath = null;

  function drawPath() {
    if (!lassoPath) {
      lassoPath = svg
        .append("path")
        .attr("id", "lasso")
        .style("stroke", "#666")
        .style("stroke-width", 1.5)
        .style("stroke-dasharray", "4,2")
        .style("stroke-dashoffset", 0)
        .style("animation", "marching-ants 1s linear infinite")
        .style("fill", "rgba(0,0,0,0.1)");
    }
    lassoPath.attr("d", d3.line()(coords));
  }

  return d3
    .drag()
    .on("start", () => {
      isDragging = true;
      coords = [];
      if (lassoPath) lassoPath.remove();
      lassoPath = null;
    })
    .on("drag", function (event) {
      coords.push(d3.pointer(event, this));
      drawPath();
    })
    .on("end", function (event) {
      const selectedColor = document.getElementById("color").value;
      const sourceEvent = event.sourceEvent;
      const modifierHeld =
        sourceEvent &&
        (sourceEvent.shiftKey || sourceEvent.metaKey || sourceEvent.ctrlKey);
      const additive = isAdditiveDefault || modifierHeld;

      if (!additive) {
        colorByIndex.fill(null);
        selectedIndicesGlobal.clear();
      }

      svg.selectAll("circle").each(function ({ d, i }) {
        const cx = scales.x(d[0]);
        const cy = scales.y(d[1]);
        if (pointInPolygon([cx, cy], coords)) {
          colorByIndex[i] = selectedColor;
          selectedIndicesGlobal.add(i);
        }
      });

      isDragging = false;
      renderAllPlots();
      updateLabelCounts();

      const autoAnalyze = document.getElementById(
        "auto-analyze-checkbox"
      )?.checked;
      if (autoAnalyze) {
        applyGroupAnalysis();
      }
    });
}

function getParticipantVoteSummary(participantId) {
  if (!window.dbInstance || !window.commentTexts) return "(data not loaded)";

  const result = window.dbInstance.exec(`
    SELECT comment_id, vote
    FROM votes
    WHERE participant_id = '${participantId}'
  `);

  const rows = result[0]?.values || [];
  return rows
    .map(([cid, vote]) => {
      let label;
      if (vote === 1) label = "agree";
      else if (vote === -1) label = "disagree";
      else label = "pass";

      const text = window.commentTexts?.[cid]?.txt || "<missing>";
      return `#${cid} - ${label}: ${text}`;
    })
    .join("\n");
}

function renderPlot(svgId, data, title) {
  const svg = d3.select(svgId);
  svg.attr("width", width).attr("height", height);
  const scales = getScales(data, width, height);
  svg.selectAll("*").remove();

  // Add light origin axes at x=0 and y=0 (if within domain)
  const [xMin, xMax] = d3.extent(data, d => d[0]);
  const [yMin, yMax] = d3.extent(data, d => d[1]);

  if (xMin < 0 && xMax > 0) {
    svg.append("line")
      .attr("x1", scales.x(0))
      .attr("x2", scales.x(0))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2");
  }

  if (yMin < 0 && yMax > 0) {
    svg.append("line")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", scales.y(0))
      .attr("y2", scales.y(0))
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2");
  }

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 25)
    .attr("text-anchor", "middle")
    .attr("font-size", "16px")
    .attr("font-weight", "bold")
    .text(title);

  svg
    .selectAll("circle")
    .data(data.map((d, i) => ({ d, i })))
    .enter()
    .append("circle")
    .attr("cx", ({ d }) => scales.x(d[0]))
    .attr("cy", ({ d }) => scales.y(d[1]))
    .attr("r", dotSize)
    .attr("fill-opacity", dotOpacity)
    .attr("fill", ({ i }) => colorByIndex[i] || "rgba(0,0,0,0.5)")
    .attr("data-index", ({ i }) => i)
    // Show user vote history in console (for debug)
    .on("mouseover", function (event, d) {
      const i = d.i;
      this.hoverTimeout = setTimeout(() => {
        const pid = window.participants?.[i] || `#${i}`;
        console.log(`Participant ID: ${pid}`);
        console.log(getParticipantVoteSummary(pid));
      }, 100);
    })
    .on("mouseout", function () {
      clearTimeout(this.hoverTimeout);
    });

  svg.call(makeLassoDragHandler(svg, data, scales));

  svg.on("mousemove", function (event) {
    if (isDragging) return;
    const [x, y] = d3.pointer(event, this);
    hoveredIndices = findIndicesWithinRadius(data, x, y, scales);
    // Update AppState as well for the refactored code
    AppState.ui.hoveredIndices = new Set(hoveredIndices);
    applyHoverStyles();
  });

  svg.on("mouseleave", () => {
    hoveredIndices.clear();
    // Update AppState as well for the refactored code
    AppState.ui.hoveredIndices.clear();
    applyHoverStyles();
  });
}

/**
 * Render all three projection plots
 */
function renderAllPlots() {
  AppState.updateDimensions();

  // Update global variables for backward compatibility
  width = AppState.dimensions.width;
  height = AppState.dimensions.height;

  renderPlot("#plot1", AppState.data.X1, "PCA projection");
  renderPlot("#plot2", AppState.data.X2, "PaCMAP projection");
  renderPlot("#plot3", AppState.data.X3, "LocalMAP projection");
}

/**
 * Application initialization
 */
function initializeApp() {
  // Initialize application state
  AppState.init();

  // Initialize UI with stored preferences
  initializeUI();

  // Set up event listeners
  setupEventListeners();

  // Check for shared state in URL hash
  const hash = location.hash.slice(1);
  if (hash) {
    const shared = decodeShareState(hash);
    if (shared) {
      applySharedState(shared);
      return; // ✅ Don't run normal startup; already handled
    }
  }

  // Load dataset list and initialize
  loadDatasetList()
    .then(() => {
      // Only run if no shared state
      loadAndRenderData(AppState.preferences.convoSlug);
    });
}

/**
 * Load the dataset list from JSON
 */
function loadDatasetList() {
  return fetch("data/datasets.json")
    .then((res) => res.json())
    .then((datasets) => {
      const select = document.getElementById("dataset");
      const current = AppState.preferences.convoSlug;

      datasets.forEach(({ slug, label }) => {
        const option = document.createElement("option");
        option.value = slug;
        option.textContent = label;
        if (slug === current) option.selected = true;
        select.appendChild(option);
      });

      // fallback if current is invalid
      if (!datasets.find(d => d.slug === current)) {
        AppState.preferences.convoSlug = datasets[0]?.slug;
        convoSlug = AppState.preferences.convoSlug; // Update global for backward compatibility
        saveState("dataset", AppState.preferences.convoSlug);
      }
    })
    .catch((err) => {
      console.error("Failed to load dataset list:", err);
    });
}

// Initialize the application when the DOM is loaded
window.addEventListener("DOMContentLoaded", initializeApp);

let dbInstance = null;

/**
 * Load the votes database for a dataset
 * @param {string} slug - Dataset identifier
 * @returns {Promise<Object>} - SQL.js database instance
 */
async function loadVotesDB(slug) {
  if (AppState.data.dbInstance) {
    return AppState.data.dbInstance;
  }

  const SQL = await initSqlJs({
    locateFile: (file) =>
      `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`,
  });

  const res = await fetch(`data/${slug}/votes.db`);
  const buffer = await res.arrayBuffer();
  const db = new SQL.Database(new Uint8Array(buffer));

  // Store in AppState
  AppState.data.dbInstance = db;

  // For backward compatibility
  window.dbInstance = db;

  return db;
}

// Helper function to check if z-score is significant at 90% confidence
function zSig90(zVal) {
  return zVal > Config.stats.significanceThreshold;
}

function renderRepCommentsTable(repComments) {
  const container = document.getElementById("rep-comments-output");
  container.innerHTML = "";

  Object.entries(repComments)
    .sort(([a], [b]) => {
      // Sort by group letter.
      // Anything without a label goes to the end.
      const indexA = AppState.selection.colorToLabelIndex[a] ?? Infinity;
      const indexB = AppState.selection.colorToLabelIndex[b] ?? Infinity;
      return indexA - indexB;
    })
    .forEach(([labelColor, comments]) => {
      const groupDiv = document.createElement("div");
      groupDiv.style.marginBottom = "30px";

      // Section header with colored circle
      const title = document.createElement("h3");
      title.style.display = "flex";
      title.style.alignItems = "center";
      title.style.gap = "10px";

      const circle = document.createElement("span");
      circle.style.display = "inline-block";
      circle.style.width = "16px";
      circle.style.height = "16px";
      circle.style.borderRadius = "50%";
      circle.style.backgroundColor = labelColor;
      circle.style.border = "1px solid #999";

      const UNGROUPED_LABEL = "Ungrouped";

      const labelIndex = AppState.selection.colorToLabelIndex[labelColor];
      const letter =
        labelIndex !== undefined
          ? labelIndexToLetter(labelIndex)
          : UNGROUPED_LABEL;

      const groupSize = getLabelArrayWithOptionalUngrouped().filter(
        (label) => label === labelColor
      ).length;

      const text = document.createElement("span");
      text.textContent = `Group ${letter} (${groupSize} participants)`;

      title.appendChild(circle);
      title.appendChild(text);
      groupDiv.appendChild(title);

      const table = document.createElement("table");
      table.style.borderCollapse = "collapse";
      table.style.width = "100%";

      const headerRow = document.createElement("tr");
      ["Comment ID", "Rep Type", "% Support", "", "Statement"].forEach((h) => {
        const th = document.createElement("th");
        th.textContent = h;
        th.style.borderBottom = "2px solid #ccc";
        th.style.padding = "6px 10px";
        th.style.textAlign = "left";
        headerRow.appendChild(th);
      });
      table.appendChild(headerRow);

      comments.forEach((c) => {
        const tr = document.createElement("tr");
        const repColor =
          c.repful_for === "agree"
            ? "green"
            : c.repful_for === "disagree"
              ? "red"
              : "#333";

        const match = window.commentTextMap?.[c.tid];
        const commentText = match?.txt || "<em>Missing</em>";

        const metaLine = `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">
          Agree: ${c.n_agree}, Disagree: ${c.n_disagree}, Pass: ${c.n_pass}, Total: ${c.n_trials}
        </div>`;

        const barChart = createCompactBarChart({
          voteCounts: {
            A: c.n_agree,
            D: c.n_disagree,
            S: c.n_trials,
          },
          nMembers: groupSize, // or total participants in this group
          voteColors: Config.voteColors
        });

        // Comment ID
        const tdId = document.createElement("td");
        tdId.textContent = c.tid;
        tdId.style.padding = "6px 10px";
        tdId.style.borderBottom = "1px solid #eee";
        tr.appendChild(tdId);

        // Rep Type
        const tdRep = document.createElement("td");
        tdRep.innerHTML = `<span style="color: ${repColor}; font-weight: bold;">${c.repful_for}</span>`;
        tdRep.style.padding = "6px 10px";
        tdRep.style.borderBottom = "1px solid #eee";
        tr.appendChild(tdRep);

        // % Support
        const tdPct = document.createElement("td");
        tdPct.textContent = `${Math.round((c.n_success / c.n_trials) * 100)}%`;
        tdPct.style.padding = "6px 10px";
        tdPct.style.borderBottom = "1px solid #eee";
        tr.appendChild(tdPct);

        // ⬅️ NEW: Bar chart column
        const tdChart = document.createElement("td");
        tdChart.style.padding = "6px 10px";
        tdChart.style.borderBottom = "1px solid #eee";
        tdChart.appendChild(barChart);
        tr.appendChild(tdChart);

        // Statement + meta
        const tdStatement = document.createElement("td");
        tdStatement.innerHTML = `<div class="comment-text">${commentText}</div>${metaLine}`;
        tdStatement.style.padding = "6px 10px";
        tdStatement.style.borderBottom = "1px solid #eee";
        tr.appendChild(tdStatement);

        table.appendChild(tr);
      });
      groupDiv.appendChild(table);
      container.appendChild(groupDiv);
    });
}

// Test if two proportions differ significantly
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

// Helper function to calculate comparative statistics for groups
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

async function getGroupVoteMatrices(db, labelArray) {
  const groups = {};
  labelArray.forEach((label, index) => {
    if (label != null) {
      const pid = window.participants?.[index];
      if (pid !== undefined) {
        if (!groups[label]) groups[label] = [];
        groups[label].push(pid);
      }
    }
  });

  const groupVotes = {};
  for (const [label, indices] of Object.entries(groups)) {
    const result = db.exec(`
      SELECT participant_id, comment_id, vote
      FROM votes
      WHERE participant_id IN (${indices.join(",")})
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

function passesByTest(commentStats) {
  return (
    (zSig90(commentStats.rat) && zSig90(commentStats.pat)) ||
    (zSig90(commentStats.rdt) && zSig90(commentStats.pdt))
  );
}

function beatsBestByTest(commentStats, currentBestZ) {
  return (
    currentBestZ === null ||
    Math.max(commentStats.rat, commentStats.rdt) > currentBestZ
  );
}

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

function agreesBeforeDisagrees(comments) {
  const agrees = comments.filter((c) => c.repful_for === "agree");
  const disagrees = comments.filter((c) => c.repful_for === "disagree");
  return [...agrees, ...disagrees];
}

function selectRepComments(commentStatsWithTid) {
  const result = {};
  const includeModerated = document.getElementById("include-moderated-checkbox")?.checked;

  if (commentStatsWithTid.length === 0) return {};

  const groupIds = Object.keys(commentStatsWithTid[0][1]);

  groupIds.forEach((gid) => {
    result[gid] = { best: null, best_agree: null, sufficient: [] };
  });

  commentStatsWithTid.forEach(([tid, groupsData]) => {
    const comment = window.commentTextMap?.[tid];
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

// Test if a proportion differs from 0.5
function propTest(succ, n) {
  const adjustedSucc = succ + 1;
  const adjustedN = n + 1;
  return 2 * Math.sqrt(adjustedN) * (adjustedSucc / adjustedN - 0.5);
}

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
 * Get an array of labels with optional handling for unpainted points
 * @returns {Array} Array of color labels or null
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

async function analyzePaintedClusters(db, labelArray, commentTexts) {
  const groupVotes = await getGroupVoteMatrices(db, labelArray);
  const repComments = calculateRepresentativeComments(groupVotes, commentTexts);

  console.log("Representative Comments:", repComments);
  return repComments;
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

  output.innerHTML = `
    <div class="spinner-container">
      <div class="spinner"></div>
      <span>Analyzing groups…</span>
    </div>
  `;

  // 🔥 FORCE a DOM paint before continuing with long task
  await preworkRenderPipelinePauseHelper();

  const db = await loadVotesDB(AppState.preferences.convoSlug);
  let commentTexts;
  const rep = await analyzePaintedClusters(db, labelArray, commentTexts);
  renderRepCommentsTable(rep, window.commentTexts);

  // 👉 HIDE loader after analysis and render complete
  hidePlotLoader();
}

