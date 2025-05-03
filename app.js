// --- Configuration and Shared State ---
let convoSlug = document.getElementById("dataset")?.value || "bg2050";
const width = 450,
  height = 450;
const presetColors = ["#ff0000", "#00cc00", "#0066ff", "#ff9900", "#cc00cc"];
const colorByIndex = [];
const selectedIndicesGlobal = new Set();
let isShiftPressed = false;
let X1, X2, X3;

// --- App Init ---
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

loadAndRenderData(convoSlug);

// --- Event Listeners ---
document.getElementById("dataset").addEventListener("change", (e) => {
  convoSlug = e.target.value;
  loadAndRenderData(convoSlug);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Shift") isShiftPressed = true;
});
window.addEventListener("keyup", (e) => {
  if (e.key === "Shift") isShiftPressed = false;
});

// --- Helpers ---
function getScales(X, padding = 40) {
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

function makeLassoDragHandler(svg, data, scales) {
  let coords = [];

  function drawPath() {
    svg.select("#lasso").remove();
    svg
      .append("path")
      .attr("id", "lasso")
      .style("stroke", "black")
      .style("stroke-width", 2)
      .style("fill", "#00000054")
      .attr("d", d3.line()(coords));
  }

  return d3
    .drag()
    .on("start", () => {
      coords = [];
      svg.select("#lasso").remove();
    })
    .on("drag", function (event) {
      coords.push(d3.pointer(event, this));
      drawPath();
    })
    .on("end", function (event) {
      const selectedColor = document.getElementById("color").value;
      const additive = isShiftPressed || event.sourceEvent?.metaKey;

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

      renderAllPlots();
      updateLabelCounts();
    });
}

// --- UI Rendering ---
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

function renderPlot(svgId, data, title) {
  const svg = d3.select(svgId);
  const scales = getScales(data);
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
    .attr("fill", ({ i }) => colorByIndex[i] || "rgba(0,0,0,0.5)");

  svg.call(makeLassoDragHandler(svg, data, scales));
}

function renderAllPlots() {
  renderPlot("#plot1", X1, "PCA projection");
  renderPlot("#plot2", X2, "PaCMAP projection");
  renderPlot("#plot3", X3, "LocalMAP projection");
}
