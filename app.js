// --- Configuration and Shared State ---
let convoSlug = document.getElementById("dataset")?.value || "bg2050";
let width = 0,
  height = 0;
const presetColors = ["#ff0000", "#00cc00", "#0066ff", "#ff9900", "#cc00cc"];
const colorByIndex = [];
const selectedIndicesGlobal = new Set();
let isAdditiveDefault = false;
let isDragging = false;
let hoveredIndices = new Set();
let X1, X2, X3;

// --- Data Loading ---
function loadAndRenderData(slug) {
  Promise.all([
    d3.json(`data/${slug}/pca.json`),
    d3.json(`data/${slug}/pacmap.json`),
    d3.json(`data/${slug}/localmap.json`),
  ]).then(([data1, data2, data3]) => {
    X1 = data1;
    X2 = data2;
    X3 = data3;

    colorByIndex.length = X1.length;
    colorByIndex.fill(null);
    selectedIndicesGlobal.clear();

    renderAllPlots();
    renderColorPalette();
    updateLabelCounts();
  });
}

// --- DOM + Event Binding ---
document.getElementById("dataset").addEventListener("change", (e) => {
  convoSlug = e.target.value;
  loadAndRenderData(convoSlug);
});
document.getElementById("toggle-additive").addEventListener("change", (e) => {
  isAdditiveDefault = e.target.checked;
});

window.addEventListener("resize", () => {
  if (X1 && X2 && X3) renderAllPlots();
});

// --- Utility Functions ---
function getScales(X, width, height, padding = 40) {
  return {
    x: d3
      .scaleLinear()
      .domain(d3.extent(X, (d) => d[0]))
      .range([padding, width - padding]),
    y: d3
      .scaleLinear()
      .domain(d3.extent(X, (d) => d[1]))
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

function findIndicesWithinRadius(data, mouseX, mouseY, scales, radius = 10) {
  const indices = new Set();
  data.forEach((d, i) => {
    const dx = scales.x(d[0]) - mouseX;
    const dy = scales.y(d[1]) - mouseY;
    if (Math.hypot(dx, dy) < radius) {
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
  container.innerHTML = presetColors
    .map(
      (color) => `
    <span style="display:inline-block; width:20px; height:20px; background:${color}; border:1px solid #888; margin-right:5px; cursor:pointer;"
      title="${color}" onclick="document.getElementById('color').value = '${color}'">
    </span>`
    )
    .join("");
}

function updateLabelCounts() {
  const counts = {};
  colorByIndex.forEach((color) => {
    if (color) counts[color] = (counts[color] || 0) + 1;
  });

  const container = document.getElementById("label-counts");
  container.innerHTML =
    Object.entries(counts)
      .map(
        ([color, count]) => `
    <span style="margin-right: 12px;">
      <span style="display:inline-block; width:14px; height:14px; background:${color}; border:1px solid #aaa; margin-right:5px; vertical-align:middle;"></span>
      ${count}
    </span>`
      )
      .join("") || "(No selections yet)";
}

function applyHoverStyles() {
  d3.selectAll("circle").each(function () {
    const circle = d3.select(this);
    const index = +circle.attr("data-index");
    const rawColor = colorByIndex[index];
    const baseColor = rawColor || "#7f7f7f";
    if (hoveredIndices.has(index)) {
      const hoverColor = adjustColorForHover(baseColor);
      circle.attr("fill", hoverColor).attr("fill-opacity", 0.3).raise();
    } else {
      circle
        .attr("fill", rawColor || "rgba(0,0,0,0.5)")
        .attr("fill-opacity", 0.3);
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
    });
}

function renderPlot(svgId, data, title) {
  const svg = d3.select(svgId);
  svg.attr("width", width).attr("height", height);
  const scales = getScales(data, width, height);
  svg.selectAll("*").remove();

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
    .attr("r", 5)
    .attr("fill-opacity", 0.3)
    .attr("fill", ({ i }) => colorByIndex[i] || "rgba(0,0,0,0.5)")
    .attr("data-index", ({ i }) => i);

  svg.call(makeLassoDragHandler(svg, data, scales));

  svg.on("mousemove", function (event) {
    if (isDragging) return;
    const [x, y] = d3.pointer(event, this);
    hoveredIndices = findIndicesWithinRadius(data, x, y, scales, 12);
    applyHoverStyles();
  });

  svg.on("mouseleave", () => {
    hoveredIndices.clear();
    applyHoverStyles();
  });

  svg.on("touchstart", function (event) {
    console.log("test");
    if (isDragging) return;
    const [x, y] = d3.pointers(event, this)[0];
    hoveredIndices = findIndicesWithinRadius(data, x, y, scales, 12);
    applyHoverStyles();
  });

  svg.on("touchend", () => {
    hoveredIndices.clear();
    applyHoverStyles();
  });
}

function renderAllPlots() {
  updateDimensions();
  renderPlot("#plot1", X1, "PCA projection");
  renderPlot("#plot2", X2, "PaCMAP projection");
  renderPlot("#plot3", X3, "LocalMAP projection");
}

// --- Initial Kickoff ---
loadAndRenderData(convoSlug);
