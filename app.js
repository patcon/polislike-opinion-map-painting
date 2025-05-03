let X1, X2, X3;

let convo_slug = "bg2050";
const width = 450,
  height = 450;
const presetColors = ["#ff0000", "#00cc00", "#0066ff", "#ff9900", "#cc00cc"];
const colorByIndex = [];
const selectedIndicesGlobal = new Set();
let isShiftPressed = false;

Promise.all([
  d3.json(`data/${convo_slug}/pca.json`),
  d3.json(`data/${convo_slug}/pacmap.json`),
  d3.json(`data/${convo_slug}/localmap.json`),
]).then(([_X1, _X2, _X3]) => {
  X1 = _X1;
  X2 = _X2;
  X3 = _X3;

  const N = X1.length;
  colorByIndex.length = N;
  colorByIndex.fill(null);

  renderAllPlots();
  updateLabelCounts();
  renderColorPalette();

  window.addEventListener("keydown", (e) => {
    if (e.key === "Shift") isShiftPressed = true;
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "Shift") isShiftPressed = false;
  });
});

function getScales(X, width, height, padding = 40) {
  const xExtent = d3.extent(X, (d) => d[0]);
  const yExtent = d3.extent(X, (d) => d[1]);
  return {
    x: d3
      .scaleLinear()
      .domain(xExtent)
      .range([padding, width - padding]),
    y: d3
      .scaleLinear()
      .domain(yExtent)
      .range([height - padding, padding]),
  };
}

function renderColorPalette() {
  const container = document.getElementById("color-palette");
  container.innerHTML = presetColors
    .map(
      (color) => `
    <span 
      style="display:inline-block; width:20px; height:20px; background:${color}; border:1px solid #888; margin-right:5px; cursor:pointer;"
      title="${color}"
      onclick="document.getElementById('color').value = '${color}'"
    ></span>`
    )
    .join("");
}

function updateLabelCounts() {
  const counts = {};
  for (const color of colorByIndex) {
    if (color) counts[color] = (counts[color] || 0) + 1;
  }
  const container = document.getElementById("label-counts");
  const entries = Object.entries(counts)
    .map(
      ([color, count]) => `
      <span style="margin-right: 12px;">
        <span style="display:inline-block; width:14px; height:14px; background:${color}; border:1px solid #aaa; margin-right:5px; vertical-align:middle;"></span>
        ${count}
      </span>`
    )
    .join("");
  container.innerHTML = entries || "(No selections yet)";
}

function pointInPolygon(point, vs) {
  let [x, y] = point;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let [xi, yi] = vs[i],
      [xj, yj] = vs[j];
    let intersect =
      yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function installGlobalLasso(svg, data, scales) {
  let coords = [];
  const lineGenerator = d3.line();

  function drawPath() {
    svg.select("#lasso").remove();
    svg
      .append("path")
      .attr("id", "lasso")
      .style("stroke", "black")
      .style("stroke-width", 2)
      .style("fill", "#00000054")
      .attr("d", lineGenerator(coords));
  }

  function dragStart(event) {
    coords = [];
    svg.select("#lasso").remove();
  }

  function dragMove(event) {
    const pt = d3.pointer(event, this);
    coords.push(pt);
    drawPath();
  }

  function dragEnd(event) {
    const selectedColor = document.getElementById("color").value;
    const additive = isShiftPressed || event.sourceEvent?.metaKey;

    if (!additive) {
      colorByIndex.fill(null);
      selectedIndicesGlobal.clear();
    }

    svg.selectAll("circle").each(function (d, i) {
      const cx = scales.x(d[0]);
      const cy = scales.y(d[1]);
      if (pointInPolygon([cx, cy], coords)) {
        colorByIndex[i] = selectedColor;
        selectedIndicesGlobal.add(i);
      }
    });

    renderAllPlots();
    updateLabelCounts();
  }

  svg.call(
    d3.drag().on("start", dragStart).on("drag", dragMove).on("end", dragEnd)
  );
}

function renderPlot(svgId, data, title) {
  const svg = d3.select(svgId);
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
    .attr("fill", ({ i }) => colorByIndex[i] || "rgba(0,0,0,0.5)");

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

  function dragStart(event) {
    coords = [];
    svg.select("#lasso").remove();
  }

  function dragMove(event) {
    const [x, y] = d3.pointer(event, this);
    coords.push([x, y]);
    drawPath();
  }

  function dragEnd(event) {
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
  }

  svg.call(
    d3.drag().on("start", dragStart).on("drag", dragMove).on("end", dragEnd)
  );
}
function renderAllPlots() {
  renderPlot("#plot1", X1, "PCA projection", 0);
  renderPlot("#plot2", X2, "PaCMAP projection", 1);
  renderPlot("#plot3", X3, "LocalMAP projection", 2);
}
