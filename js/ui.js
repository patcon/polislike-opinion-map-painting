
/**
 * UI-related functions for Opinion Map Painting Application
 */

// ============================================================================
// UI Initialization and Event Handlers
// ============================================================================

/**
 * Initialize the UI with stored preferences
 */
function initializeUI() {
    document.getElementById("dataset").value = AppState.preferences.convoSlug;
    document.getElementById("toggle-additive").checked = AppState.preferences.isAdditive;
    document.getElementById("include-unpainted").checked = AppState.selection.includeUnpainted;
    document.getElementById("auto-analyze-checkbox").checked = loadState("autoAnalyze", true);
    document.getElementById("include-moderated-checkbox").checked = loadState("includeModerated", false);
    document.getElementById("scale-opacity-checkbox").checked = AppState.preferences.scaleOpacityWithVotes;
    document.getElementById("flip-x-checkbox").checked = AppState.preferences.flipX;
    document.getElementById("flip-y-checkbox").checked = AppState.preferences.flipY;
    document.getElementById("show-group-comparison-checkbox").checked = AppState.preferences.showGroupComparison;
    document.getElementById("show-group-labels-checkbox").checked = AppState.preferences.showGroupLabels;

    // Initialize sliders
    document.getElementById("opacity-slider").value = AppState.ui.dotOpacity;
    document.getElementById("opacity-value").textContent = AppState.ui.dotOpacity;
    document.getElementById("dot-size-slider").value = AppState.ui.dotSize;
    document.getElementById("dot-size-value").textContent = AppState.ui.dotSize;

    // Initialize tooltips for projection explanations
    initializeTooltips();
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Initialize the share button text
    window.addEventListener("DOMContentLoaded", () => {
        updateShareButtonText();
    });

    // Share button (uses current mode)
    document.getElementById("share-button").addEventListener("click", () => {
        if (shareWithPaintMode) {
            shareWithPaint();
        } else {
            shareWithoutPaint();
        }
    });

    // Share dropdown toggle
    document.getElementById("share-options-button").addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent event from bubbling up
        const dropdown = document.getElementById("share-dropdown");
        dropdown.classList.toggle("hidden");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
        const dropdown = document.getElementById("share-dropdown");
        const button = document.getElementById("share-options-button");

        // Only close if dropdown is visible and click is outside dropdown and button
        if (!dropdown.classList.contains("hidden") &&
            !dropdown.contains(e.target) &&
            e.target !== button) {
            dropdown.classList.add("hidden");
        }
    });

    // Share with paint option
    document.getElementById("share-with-paint").addEventListener("click", () => {
        shareWithPaint();
        document.getElementById("share-dropdown").classList.add("hidden");
    });

    // Share without paint option
    document.getElementById("share-without-paint").addEventListener("click", () => {
        shareWithoutPaint();
        document.getElementById("share-dropdown").classList.add("hidden");
    });

    // Dataset selection
    document.getElementById("dataset").addEventListener("change", (e) => {
        const selectedDataset = e.target.value;
        AppState.preferences.convoSlug = selectedDataset;
        saveState("dataset", selectedDataset);
        loadAndRenderData(selectedDataset);
    });

    // Additive selection mode
    document.getElementById("toggle-additive").addEventListener("change", (e) => {
        const isAdditive = e.target.checked;
        AppState.preferences.isAdditive = isAdditive;
        saveState("additive", isAdditive);
    });

    // Include unpainted points
    document.getElementById("include-unpainted").addEventListener("change", (e) => {
        const includeUnpainted = e.target.checked;
        AppState.selection.includeUnpainted = includeUnpainted;
        saveState("includeUnpainted", includeUnpainted);
        updateLabelCounts();
        if (document.getElementById("auto-analyze-checkbox").checked) {
            applyGroupAnalysis();
        }
    });

    // Flip X axis
    document.getElementById("flip-x-checkbox").addEventListener("change", (e) => {
        AppState.preferences.flipX = e.target.checked;
        saveState("flipX", AppState.preferences.flipX);
        renderAllPlots();
    });

    // Flip Y axis
    document.getElementById("flip-y-checkbox").addEventListener("change", (e) => {
        AppState.preferences.flipY = e.target.checked;
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
        // Don't add to palette yet, just update the color picker value
        // The color will be added to the palette when a selection is made
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
        // Only trigger on number keys 0–9 and when not typing into an input field
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

        const index = parseInt(e.key, 10);

        if (!isNaN(index) && index < Config.colors[Config.activePalette].length) {
            const color = Config.colors[Config.activePalette][index];
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
        opacityValueLabel.textContent = AppState.ui.dotOpacity;
        renderAllPlots(); // Reapply to all plots
    });

    // Dot size slider
    const dotSizeSlider = document.getElementById("dot-size-slider");
    const dotSizeValueLabel = document.getElementById("dot-size-value");
    dotSizeSlider.addEventListener("input", () => {
        AppState.ui.dotSize = parseFloat(dotSizeSlider.value);
        dotSizeValueLabel.textContent = AppState.ui.dotSize;
        saveState("dotSize", AppState.ui.dotSize);
        renderAllPlots(); // Reapply to all plots
    });

    // Scale opacity with vote count checkbox
    document.getElementById("scale-opacity-checkbox").addEventListener("change", async (e) => {
        AppState.preferences.scaleOpacityWithVotes = e.target.checked;
        saveState("scaleOpacityWithVotes", AppState.preferences.scaleOpacityWithVotes);

        // Show loading spinner before rerendering
        showPlotLoader();

        // Use setTimeout to ensure the spinner is shown before the potentially blocking operations
        setTimeout(async () => {
            try {
                // If opacity scaling is enabled, ensure the database is loaded
                if (AppState.preferences.scaleOpacityWithVotes && !window.dbInstance) {
                    await loadVotesDB(AppState.preferences.convoSlug);
                }

                // Rerender all plots
                renderAllPlots();
            } finally {
                // Always hide the loader when done
                hidePlotLoader();
            }
        }, 10);
    });

    // Show group comparison checkbox
    document.getElementById("show-group-comparison-checkbox").addEventListener("change", (e) => {
        AppState.preferences.showGroupComparison = e.target.checked;
        saveState("showGroupComparison", AppState.preferences.showGroupComparison);

        // If analysis results are already displayed, rerun the analysis to update the display
        if (document.getElementById("rep-comments-output").innerHTML !== "") {
            applyGroupAnalysis();
        }
    });

    // Show group labels checkbox
    document.getElementById("show-group-labels-checkbox").addEventListener("change", (e) => {
        AppState.preferences.showGroupLabels = e.target.checked;
        saveState("showGroupLabels", AppState.preferences.showGroupLabels);
        renderAllPlots(); // Rerender plots to show/hide labels
    });

    // Run analysis button
    document.getElementById("run-analysis").addEventListener("click", applyGroupAnalysis);

    // K-means clustering buttons
    document.getElementById("apply-kmeans-pca").addEventListener("click", async () => {
        const clusteringResults = await loadClusteringResults(AppState.preferences.convoSlug, "kmeans", "pca");
        applyClusteringLabels(clusteringResults, "PCA");
    });

    document.getElementById("apply-kmeans-pacmap").addEventListener("click", async () => {
        const clusteringResults = await loadClusteringResults(AppState.preferences.convoSlug, "kmeans", "pacmap");
        applyClusteringLabels(clusteringResults, "PaCMAP");
    });

    document.getElementById("apply-kmeans-localmap").addEventListener("click", async () => {
        const clusteringResults = await loadClusteringResults(AppState.preferences.convoSlug, "kmeans", "localmap");
        applyClusteringLabels(clusteringResults, "LocalMAP");
    });

    // HDBSCAN clustering buttons
    document.getElementById("apply-hdbscan-pca").addEventListener("click", async () => {
        const clusteringResults = await loadClusteringResults(AppState.preferences.convoSlug, "hdbscan", "pca");
        applyClusteringLabels(clusteringResults, "PCA");
    });

    document.getElementById("apply-hdbscan-pacmap").addEventListener("click", async () => {
        const clusteringResults = await loadClusteringResults(AppState.preferences.convoSlug, "hdbscan", "pacmap");
        applyClusteringLabels(clusteringResults, "PaCMAP");
    });

    document.getElementById("apply-hdbscan-localmap").addEventListener("click", async () => {
        const clusteringResults = await loadClusteringResults(AppState.preferences.convoSlug, "hdbscan", "localmap");
        applyClusteringLabels(clusteringResults, "LocalMAP");
    });
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Render a single plot
 * @param {string} svgId - SVG element ID
 * @param {Array} data - Data points
 * @param {string} title - Plot title
 */
/**
 * Initialize tooltip functionality for the info icons
 */
function initializeTooltips() {
    // Define tooltip content for each projection type
    const tooltipContent = {
        "PCA": "Principal Component Analysis (PCA): The oldest technique (1903) that uses linear regression to find relationships in data. Used in Polis, it's good at capturing overall data variance but may miss complex non-linear relationships. PCA works by finding directions of maximum variance in the data.",
        "PaCMAP": "Pairwise Controlled Manifold Approximation and Projection (PaCMAP): A newer technique (2021) that preserves both local and global structure. It works like a physics simulation with attractive and repulsive forces between data points. Has a simpler loss function than comparable algorithms.",
        "LocalMAP": "LocalMAP: The newest technique (2024) that builds on PaCMAP. It uses graph structures to better preserve both local and global relationships in the data. Particularly good at maintaining the structure of local neighborhoods while showing overall patterns."
    };

    // Create a tooltip container if it doesn't exist
    if (!document.getElementById("tooltip-container")) {
        const tooltipContainer = document.createElement("div");
        tooltipContainer.id = "tooltip-container";
        tooltipContainer.className = "fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm hidden";
        tooltipContainer.style.transition = "opacity 150ms ease-in-out";
        tooltipContainer.style.opacity = "0";
        document.body.appendChild(tooltipContainer);
    }

    // Function to show tooltip
    function showTooltip(title, content, event) {
        const tooltip = document.getElementById("tooltip-container");

        // Update tooltip content
        tooltip.innerHTML = `
            <div class="flex justify-between items-center mb-2 border-b pb-2">
                <h3 class="font-bold text-gray-800">${title}</h3>
                <button id="close-tooltip" class="text-gray-500 hover:text-gray-700 focus:outline-none">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
            <div class="text-gray-600 text-sm">${content}</div>
        `;

        // Position the tooltip near the clicked element
        const rect = event.target.getBoundingClientRect();

        // Calculate position - prefer above the icon if there's room
        let left, top;

        // Horizontal positioning - center above/below the icon
        left = rect.left + (rect.width / 2) - 150; // Center tooltip (assuming ~300px width)

        // Make sure tooltip stays within viewport horizontally
        const viewportWidth = window.innerWidth;
        if (left < 10) left = 10; // Keep 10px from left edge
        if (left + 300 > viewportWidth - 10) left = viewportWidth - 310; // Keep 10px from right edge

        // Vertical positioning - prefer above the icon if there's room
        const tooltipHeight = 200; // Approximate height
        if (rect.top > tooltipHeight + 10) {
            // Enough room above - position above the icon
            top = window.scrollY + rect.top - tooltipHeight - 10;
        } else {
            // Not enough room above - position below the icon
            top = window.scrollY + rect.bottom + 10;
        }

        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";

        // Show the tooltip
        tooltip.classList.remove("hidden");
        setTimeout(() => {
            tooltip.style.opacity = "1";
        }, 10);

        // Add close button functionality
        document.getElementById("close-tooltip").addEventListener("click", hideTooltip);

        // Add click outside to close
        document.addEventListener("click", closeTooltipOnClickOutside);
    }

    // Function to hide tooltip
    function hideTooltip() {
        const tooltip = document.getElementById("tooltip-container");
        tooltip.style.opacity = "0";
        setTimeout(() => {
            tooltip.classList.add("hidden");
        }, 150);

        // Remove click outside listener
        document.removeEventListener("click", closeTooltipOnClickOutside);
    }

    // Function to close tooltip when clicking outside
    function closeTooltipOnClickOutside(e) {
        const tooltip = document.getElementById("tooltip-container");
        const isClickInsideTooltip = tooltip.contains(e.target);
        const isClickOnInfoIcon = e.target.id === "plot1-info" ||
            e.target.id === "plot2-info" ||
            e.target.id === "plot3-info";

        if (!isClickInsideTooltip && !isClickOnInfoIcon) {
            hideTooltip();
        }
    }

    // Add click handlers to all info icons
    document.getElementById("plot1-info").addEventListener("click", function (event) {
        event.stopPropagation();
        showTooltip("PCA", tooltipContent.PCA, event);
    });

    document.getElementById("plot2-info").addEventListener("click", function (event) {
        event.stopPropagation();
        showTooltip("PaCMAP", tooltipContent.PaCMAP, event);
    });

    document.getElementById("plot3-info").addEventListener("click", function (event) {
        event.stopPropagation();
        showTooltip("LocalMAP", tooltipContent.LocalMAP, event);
    });
}

function renderPlot(svgId, data, title) {
    const svg = d3.select(svgId);
    svg.attr("width", AppState.dimensions.width).attr("height", AppState.dimensions.height);
    const scales = getScales(data, AppState.dimensions.width, AppState.dimensions.height);
    svg.selectAll("*").remove();

    // Add light origin axes at x=0 and y=0 (if within domain)
    const [xMin, xMax] = d3.extent(data, d => d[0]);
    const [yMin, yMax] = d3.extent(data, d => d[1]);

    if (xMin < 0 && xMax > 0) {
        svg.append("line")
            .attr("x1", scales.x(0))
            .attr("x2", scales.x(0))
            .attr("y1", 0)
            .attr("y2", AppState.dimensions.height)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,2");
    }

    if (yMin < 0 && yMax > 0) {
        svg.append("line")
            .attr("x1", 0)
            .attr("x2", AppState.dimensions.width)
            .attr("y1", scales.y(0))
            .attr("y2", scales.y(0))
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,2");
    }

    svg
        .selectAll("circle")
        .data(data.map((d, i) => ({ d, i })))
        .enter()
        .append("circle")
        .attr("cx", ({ d }) => scales.x(d[0]))
        .attr("cy", ({ d }) => scales.y(d[1]))
        .attr("r", AppState.ui.dotSize)
        .attr("fill-opacity", AppState.ui.dotOpacity) // Start with default opacity
        .attr("fill", ({ i }) => AppState.selection.colorByIndex[i] || "rgba(0,0,0,0.5)")
        .attr("data-index", ({ i }) => i)
        // Show user vote history in console (for debug)
        .on("mouseover", function (event, d) {
            const i = d.i;
            this.hoverTimeout = setTimeout(() => {
                const pid = AppState.data.participants?.[i] || `#${i}`;
                console.log(`Participant ID: ${pid}`);
                console.log(getParticipantVoteSummary(pid));
            }, 100);
        })
        .on("mouseout", function () {
            clearTimeout(this.hoverTimeout);
        });

    svg.call(makeLassoDragHandler(svg, data, scales));

    svg.on("mousemove", function (event) {
        if (AppState.ui.isDragging) return;
        const [x, y] = d3.pointer(event, this);
        // Don't change radius with dotSize for now.
        const FORCE_RADIUS = 10
        AppState.ui.hoveredIndices = findIndicesWithinRadius(data, x, y, scales, FORCE_RADIUS);
        applyHoverStyles();
    });

    svg.on("mouseleave", () => {
        AppState.ui.hoveredIndices.clear();
        applyHoverStyles();
    });

    // Add custom label overlays for each group LAST to ensure they're on top
    addGroupLabelOverlays(svg, data, scales);
}

/**
 * Add custom label overlays to the SVG for each group
 * @param {Object} svg - D3 selection of the SVG element
 * @param {Array} data - Data points
 * @param {Object} scales - x and y scales
 */
function addGroupLabelOverlays(svg, data, scales) {
    // If group labels are disabled, don't add any labels
    if (!AppState.preferences.showGroupLabels) {
        return;
    }

    // Get unique colors with labels (custom or default)
    const colorGroups = {};

    // Group data points by color
    for (let i = 0; i < AppState.selection.colorByIndex.length; i++) {
        const color = AppState.selection.colorByIndex[i];
        if (color) {
            // Get the label - either custom label or default letter
            const colorIndex = AppState.selection.colorToLabelIndex[color];
            const label = AppState.selection.customLabels[color] || labelIndexToLetter(colorIndex);

            if (!colorGroups[color]) {
                colorGroups[color] = {
                    points: [],
                    label: label
                };
            }
            colorGroups[color].points.push(data[i]);
        }
    }

    // Create a temporary text element to measure text width accurately
    const textMeasurer = svg.append("text")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .style("opacity", 0); // Make it invisible

    // Function to measure text width accurately
    const getTextWidth = (text) => {
        textMeasurer.text(text);
        return textMeasurer.node().getComputedTextLength();
    };

    // Calculate label positions and dimensions for collision detection
    const labelPositions = [];
    const maxLabelWidth = 120; // Maximum width for text wrapping
    const lineHeight = 16; // Height of each line of text
    const svgWidth = AppState.dimensions.width;
    const svgHeight = AppState.dimensions.height;

    // First pass: calculate initial positions and prepare for collision detection
    Object.entries(colorGroups).forEach(([color, group]) => {
        if (group.points.length === 0) return;

        // Calculate center of the group
        const sumX = group.points.reduce((sum, point) => sum + point[0], 0);
        const sumY = group.points.reduce((sum, point) => sum + point[1], 0);
        const centerX = sumX / group.points.length;
        const centerY = sumY / group.points.length;

        // Split label into words for wrapping
        const words = group.label.split(/\s+/);
        const lines = [];
        let currentLine = words[0];

        // More accurate text wrapping algorithm using actual text measurements
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine + " " + word;
            const testWidth = getTextWidth(testLine);

            if (testWidth < maxLabelWidth) {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);

        // Calculate label height based on number of lines
        const labelHeight = lines.length * lineHeight;

        // Calculate actual width of the widest line
        let actualWidth = 0;
        lines.forEach(line => {
            const lineWidth = getTextWidth(line);
            actualWidth = Math.max(actualWidth, lineWidth);
        });

        // Store position and dimensions for collision detection
        labelPositions.push({
            x: scales.x(centerX),
            y: scales.y(centerY),
            width: actualWidth + 10, // Add some padding
            height: labelHeight,
            lines: lines,
            color: color,
            originalX: scales.x(centerX),
            originalY: scales.y(centerY),
            dataX: centerX,
            dataY: centerY,
            needsLeaderLine: false
        });
    });

    // Remove the temporary text measurer
    textMeasurer.remove();

    // Enhanced collision resolution with boundary constraints
    const resolveCollisions = () => {
        let hasCollision = true;
        const padding = 10; // Padding between labels
        const maxIterations = 100; // Prevent infinite loops
        let iterations = 0;

        // Boundary constraints (with some margin)
        const margin = 10;
        const minX = margin;
        const minY = margin;
        const maxX = svgWidth - margin;
        const maxY = svgHeight - margin;

        while (hasCollision && iterations < maxIterations) {
            hasCollision = false;
            iterations++;

            // Check each pair of labels for collision
            for (let i = 0; i < labelPositions.length; i++) {
                for (let j = i + 1; j < labelPositions.length; j++) {
                    const a = labelPositions[i];
                    const b = labelPositions[j];

                    // Rectangular collision detection
                    if (a.x - a.width / 2 < b.x + b.width / 2 + padding &&
                        a.x + a.width / 2 + padding > b.x - b.width / 2 &&
                        a.y - a.height / 2 < b.y + b.height / 2 + padding &&
                        a.y + a.height / 2 + padding > b.y - b.height / 2) {

                        hasCollision = true;

                        // Calculate vector between centers
                        const dx = a.x - b.x;
                        const dy = a.y - b.y;

                        // Normalize and apply adjustment
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        const moveX = (dx / dist) * Math.min(5, a.width / 4); // Limit movement
                        const moveY = (dy / dist) * Math.min(5, a.height / 4);

                        // Move labels apart
                        a.x += moveX;
                        a.y += moveY;
                        b.x -= moveX;
                        b.y -= moveY;
                    }
                }
            }

            // Keep labels within bounds
            for (const label of labelPositions) {
                // Check if label would go out of bounds
                if (label.x - label.width / 2 < minX) label.x = minX + label.width / 2;
                if (label.x + label.width / 2 > maxX) label.x = maxX - label.width / 2;
                if (label.y - label.height / 2 < minY) label.y = minY + label.height / 2;
                if (label.y + label.height / 2 > maxY) label.y = maxY - label.height / 2;

                // Check if label has moved significantly from its original position
                const dx = label.x - label.originalX;
                const dy = label.y - label.originalY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // If moved more than a threshold, mark for leader line
                if (distance > 30) {
                    label.needsLeaderLine = true;
                }
            }
        }
    };

    // Resolve collisions before rendering
    resolveCollisions();

    // Second pass: render labels with adjusted positions
    labelPositions.forEach(label => {
        // Create a group for the label to ensure it's on top
        const labelGroup = svg.append("g")
            .attr("class", "label-group")
            .attr("pointer-events", "none"); // Make entire group non-interactable

        // Add leader line if the label has been moved significantly
        if (label.needsLeaderLine) {
            labelGroup.append("line")
                .attr("x1", label.originalX)
                .attr("y1", label.originalY)
                .attr("x2", label.x)
                .attr("y2", label.y)
                .attr("stroke", label.color)
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,2")
                .attr("opacity", 0.7);

            // Add a small dot at the original position
            labelGroup.append("circle")
                .attr("cx", label.originalX)
                .attr("cy", label.originalY)
                .attr("r", 3)
                .attr("fill", label.color)
                .attr("opacity", 0.7);
        }

        // Add multi-line text with white stroke for better visibility against any background
        const text = labelGroup.append("text")
            .attr("x", label.x)
            .attr("y", label.y - (label.lines.length - 1) * lineHeight / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "black")
            .attr("stroke", "white")
            .attr("stroke-width", "3px")
            .attr("paint-order", "stroke")
            .attr("font-weight", "bold")
            .attr("font-size", "14px")
            .attr("user-select", "none");

        // Add each line as a tspan element
        label.lines.forEach((line, i) => {
            text.append("tspan")
                .attr("x", label.x)
                .attr("dy", i === 0 ? 0 : lineHeight)
                .text(line);
        });
    });
}

/**
 * Update opacity of all circles based on vote count
 */
async function updateOpacityBasedOnVotes() {
    if (!AppState.preferences.scaleOpacityWithVotes) {
        // Clear cache when disabled
        AppState.ui.opacityFactorCache = {};
        return;
    }

    // Ensure database is loaded
    if (!AppState.data.dbInstance) {
        try {
            await loadVotesDB(AppState.preferences.convoSlug);
        } catch (error) {
            console.error("Failed to load votes database:", error);
            return;
        }
    }

    // Calculate opacity for each participant and cache the results
    const opacityFactors = {};

    for (let i = 0; i < AppState.data.participants?.length || 0; i++) {
        const pid = AppState.data.participants[i];
        if (pid) {
            // Use cached value if available, otherwise calculate
            if (AppState.ui.opacityFactorCache[i] === undefined) {
                AppState.ui.opacityFactorCache[i] = await calculateOpacityScaleFactor(pid);
            }
            opacityFactors[i] = AppState.ui.opacityFactorCache[i];
        }
    }

    // Apply opacity to all circles
    d3.selectAll("circle").each(function () {
        const circle = d3.select(this);
        const index = +circle.attr("data-index");

        if (AppState.ui.hoveredIndices.has(index)) {
            // Don't change opacity for hovered circles
            return;
        }

        const factor = opacityFactors[index] || 1;
        const scaledOpacity = AppState.ui.dotOpacity * factor;

        // Store the scaled opacity as a data attribute for hover handling
        circle.attr("data-scaled-opacity", scaledOpacity);

        // Apply the scaled opacity
        circle.attr("fill-opacity", scaledOpacity);
    });
}

/**
 * Render all three projection plots
 */
function renderAllPlots() {
    AppState.updateDimensions();


    renderPlot("#plot1", AppState.data.X1, "PCA projection");
    renderPlot("#plot2", AppState.data.X2, "PaCMAP projection");
    renderPlot("#plot3", AppState.data.X3, "LocalMAP projection");

    // Update opacity based on vote count if enabled
    if (AppState.preferences.scaleOpacityWithVotes) {
        updateOpacityBasedOnVotes();
    }
}


function renderMetaInfo(meta) {
    const container = document.getElementById("meta-info");

    if (!meta) meta = {};

    const items = [
        {
            label: "About",
            url: meta.about_url,
        },
        {
            label: "Conversation",
            url: meta.conversation_url,
        },
        {
            label: "Report",
            url: meta.report_url,
        },
    ];

    container.innerHTML = items
        .map(({ label, url }) => {
            const isDisabled = !url;
            const buttonClass = isDisabled
                ? "inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-400 rounded-md border border-gray-300 cursor-not-allowed opacity-75"
                : "inline-flex items-center px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-md border border-gray-300 shadow-sm transition-colors";

            const content = isDisabled
                ? `<span class="inline-flex items-center">${label}</span>`
                : `<a href="${url}" target="_blank" class="inline-flex items-center">${label}</a>`;

            return `
          <button class="${buttonClass} mr-2 mb-2" ${isDisabled ? 'disabled' : ''}>
            <span class="mr-1.5">🔗</span>
            ${content}
          </button>
        `;
        })
        .join("");
}

/**
 * Get scales for plotting
 * @param {Array} X - Data points
 * @param {number} width - Plot width
 * @param {number} height - Plot height
 * @param {number} padding - Padding around plot
 * @returns {Object} - x and y scales
 */
function getScales(X, width, height, padding = 40) {
    // Use AppState dimensions if width/height not provided
    width = width || AppState.dimensions.width;
    height = height || AppState.dimensions.height;
    const xExtent = d3.extent(X, (d) => d[0]);
    const yExtent = d3.extent(X, (d) => d[1]);

    const xDomain = AppState.preferences.flipX ? [...xExtent].reverse() : xExtent;
    const yDomain = AppState.preferences.flipY ? [...yExtent].reverse() : yExtent;

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

/**
 * Create a lasso drag handler for selection
 * @param {Object} svg - D3 selection of SVG element
 * @param {Array} data - Data points
 * @param {Object} scales - x and y scales
 * @returns {Function} - D3 drag handler
 */
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
            AppState.ui.isDragging = true;
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
            const additive = AppState.preferences.isAdditive || modifierHeld;

            // Check if any points were selected
            let pointsSelected = false;

            if (!additive) {
                AppState.selection.colorByIndex.fill(null);
                AppState.selection.selectedIndices.clear();
            }

            svg.selectAll("circle").each(function (d) {
                // Check if d is defined before accessing properties
                if (d && d.d) {
                    const cx = scales.x(d.d[0]);
                    const cy = scales.y(d.d[1]);
                    if (pointInPolygon([cx, cy], coords)) {
                        AppState.selection.colorByIndex[d.i] = selectedColor;
                        AppState.selection.selectedIndices.add(d.i);
                        pointsSelected = true;
                    }
                }
            });

            // Only add the color to the palette if points were selected
            if (pointsSelected && !(selectedColor in AppState.selection.colorToLabelIndex)) {
                Config.colors[Config.activePalette].push(selectedColor); // Add to end
                AppState.selection.colorToLabelIndex[selectedColor] = Config.colors[Config.activePalette].length - 1;
                renderColorPalette(); // Refresh palette
            }

            AppState.ui.isDragging = false;
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

/**
 * Check if a point is inside a polygon
 * @param {Array} point - [x, y] coordinates
 * @param {Array} polygon - Array of [x, y] coordinates
 * @returns {boolean} - True if point is inside polygon
 */
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

/**
 * Apply hover styles to points
 * This is a simplified version that doesn't try to calculate opacity scaling
 * since that's handled by updateOpacityBasedOnVotes
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
            // Set the fill color
            circle.attr("fill", rawColor || "rgba(0,0,0,0.5)");

            // Restore the scaled opacity if opacity scaling is enabled
            if (AppState.preferences.scaleOpacityWithVotes) {
                // Get the stored scaled opacity from the data attribute
                const scaledOpacity = circle.attr("data-scaled-opacity");
                if (scaledOpacity) {
                    circle.attr("fill-opacity", scaledOpacity);
                } else {
                    // If no stored value, calculate from cache
                    const factor = AppState.ui.opacityFactorCache[index] || 1;
                    circle.attr("fill-opacity", AppState.ui.dotOpacity * factor);
                }
            } else {
                // Use default opacity if scaling is disabled
                circle.attr("fill-opacity", AppState.ui.dotOpacity);
            }
        }
    });

    // Always re-raise all label groups to ensure they stay on top
    d3.selectAll(".label-group").raise();
}


/**
 * Adjust color for hover effect
 * @param {string} hex - Hex color
 * @param {number} factor - Adjustment factor
 * @returns {string} - Adjusted color
 */
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

/**
 * Render the color palette
 */
function renderColorPalette() {
    const container = document.getElementById("color-palette");
    container.innerHTML = "";

    Config.colors[Config.activePalette].forEach((color, i) => {
        AppState.selection.colorToLabelIndex[color] = i; // Assign label
        const letter = labelIndexToLetter(i);

        const span = document.createElement("span");
        span.classList.add("palette-color");
        span.setAttribute("data-color", color); // Needed for selection logic
        span.setAttribute("translate", "no"); // Prevent automatic translation
        span.style = `
        display:inline-block; width:24px; height:24px;
        background:${color}; border:1px solid #888;
        margin-right:5px; cursor:pointer; text-align:center;
        line-height:22px; font-size:12px; color:white; font-family:sans-serif;
        border-radius:50%; /* Make it circular */
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


/**
 * Highlight the selected color in the palette
 * @param {string} color - Selected color
 */
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
                ([color, count]) => {
                    const labelIndex = AppState.selection.colorToLabelIndex[color];
                    const letter = labelIndex !== undefined ? labelIndexToLetter(labelIndex) : "";
                    return `
    <span style="margin-right: 12px;">
        <span translate="no" style="display:inline-block; width:18px; height:18px; background:${color}; border:1px solid #aaa; margin-right:5px; vertical-align:middle; border-radius:50%; text-align:center; line-height:17px; font-size:11px; color:white; font-family:sans-serif;">${letter}</span>
        <span style="vertical-align:middle;">${count}</span>
    </span > `;
                }
            )
            .join("") || "(No selections yet)";
}

/**
 * Create a compact bar chart for vote visualization
 * @param {Object} options - Chart options
 * @returns {HTMLElement} - Chart container
 */
function createCompactBarChart({ voteCounts, nMembers, voteColors, boldLargest = true }) {
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

    const agreeSaw = (agrees / sawTheComment) * 100 || 0;
    const disagreeSaw = (disagrees / sawTheComment) * 100 || 0;
    const passSaw = (passes / sawTheComment) * 100 || 0;

    const agreeString = `${Math.round(agreeSaw)}% `;
    const disagreeString = `${Math.round(disagreeSaw)}% `;
    const passString = `${Math.round(passSaw)}% `;

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
        label.innerHTML = `<span style="color: grey; margin-right: 4px;">Missing vote counts</span> `;
    } else {
        // Determine which value is largest
        let largestValue = Math.max(agreeSaw, disagreeSaw, passSaw);
        let agreeStyle = "";
        let disagreeStyle = "";
        let passStyle = "";

        if (boldLargest && sawTheComment > 0) {
            if (largestValue === agreeSaw && agrees > 0) {
                agreeStyle = "font-weight: bold;";
            } else if (largestValue === disagreeSaw && disagrees > 0) {
                disagreeStyle = "font-weight: bold;";
            } else if (largestValue === passSaw && passes > 0) {
                passStyle = "font-weight: bold;";
            }
        }

        label.innerHTML = `
    <span style="color: ${voteColors.agree}; margin-right: 6px; ${agreeStyle}"> ${agreeString}</span>
    <span style="color: ${voteColors.disagree}; margin-right: 6px; ${disagreeStyle}">${disagreeString}</span>
    <span style="color: #999; margin-right: 6px; ${passStyle}">${passString}</span>
    <span style="color: grey;">(${sawTheComment})</span>
  `;
    }

    container.appendChild(label);
    return container;
}

/**
 * Create a more compact bar chart for vote distributions
 * @param {Object} options - Configuration options
 * @param {Object} options.voteCounts - Vote counts (A: agree, D: disagree, S: saw)
 * @param {number} options.nMembers - Total number of members
 * @param {Object} options.voteColors - Colors for different vote types
 * @param {boolean} options.boldLargest - Whether to bold the largest percentage
 * @param {number} options.width - Width of the chart (default: 100)
 * @returns {HTMLElement} - Container element with the bar chart
 */
function createMoreCompactBarChart({ voteCounts, nMembers, voteColors, boldLargest = true, width = 40 }) {
    const container = document.createElement("div");
    container.style.display = "inline-block";
    container.style.verticalAlign = "middle";
    container.style.margin = "0 5px";

    let w = width;
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

    const agreeSaw = (agrees / sawTheComment) * 100 || 0;
    const disagreeSaw = (disagrees / sawTheComment) * 100 || 0;
    const passSaw = (passes / sawTheComment) * 100 || 0;

    const agreeString = `${Math.round(agreeSaw)}`;
    const disagreeString = `${Math.round(disagreeSaw)}`;
    const passString = `${Math.round(passSaw)}`;

    container.title = `${agreeString}% Agreed\n${disagreeString}% Disagreed\n${passString}% Passed\n${sawTheComment} Respondents`;

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
    label.style.display = "flex";
    label.style.flexWrap = "wrap";

    if (missingCounts) {
        label.innerHTML = `<span style="color: grey; margin-right: 4px;">Missing vote counts</span> `;
    } else {
        // Determine which value is largest
        let largestValue = Math.max(agreeSaw, disagreeSaw, passSaw);
        let agreeStyle = "";
        let disagreeStyle = "";
        let passStyle = "";

        if (boldLargest && sawTheComment > 0) {
            if (largestValue === agreeSaw && agrees > 0) {
                agreeStyle = "font-weight: bold;";
            } else if (largestValue === disagreeSaw && disagrees > 0) {
                disagreeStyle = "font-weight: bold;";
            } else if (largestValue === passSaw && passes > 0) {
                passStyle = "font-weight: bold;";
            }
        }

        // Create a wrapper div with the same width as the bar chart to ensure alignment
        label.innerHTML = `
    <div style="width: ${w + 1}px;">
      <div style="display: flex; justify-content: center; gap: 3px;">
        <span style="color: ${voteColors.agree}; ${agreeStyle}">${agreeString}</span>
        <span style="color: ${voteColors.disagree}; ${disagreeStyle}">${disagreeString}</span>
        <span style="color: #999; ${passStyle}">${passString}%</span>
      </div>
      <div style="width: ${w + 1}px; text-align: center; color: grey;">(${sawTheComment})</div>
    </div>
  `;
    }

    container.appendChild(label);
    return container;
}


/**
 * Render the representative comments table
 * @param {Object} repComments - Representative comments by group
 */
function renderRepCommentsTable(repComments) {
    // Store the repComments in AppState for reuse when updating labels
    if (repComments) {
        AppState.data.repComments = repComments;
    } else if (AppState.data.repComments) {
        // Use stored repComments if none provided
        repComments = AppState.data.repComments;
    }

    const container = document.getElementById("rep-comments-output");
    container.innerHTML = "";

    // Get all group colors sorted by their label index
    const allGroupColors = Object.keys(repComments).sort((a, b) => {
        const indexA = AppState.selection.colorToLabelIndex[a] ?? Infinity;
        const indexB = AppState.selection.colorToLabelIndex[b] ?? Infinity;
        return indexA - indexB;
    });

    // If no groups, show a message and return
    if (allGroupColors.length === 0) {
        container.innerHTML = "<p class='text-gray-500 italic'>No groups to display.</p>";
        return;
    }

    // Get group sizes for each color
    const groupSizes = {};
    allGroupColors.forEach(color => {
        groupSizes[color] = getLabelArrayWithOptionalUngrouped().filter(
            (label) => label === color
        ).length;
    });

    // Create tab container
    const tabContainer = document.createElement("div");
    tabContainer.className = "mb-6";

    // Create tab navigation with wrapper for tabs and edit button
    const tabNavWrapper = document.createElement("div");
    tabNavWrapper.className = "flex justify-between items-center";
    tabContainer.appendChild(tabNavWrapper);

    // Create tab navigation
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-gray-200";
    tabNavWrapper.appendChild(tabNav);

    // Create edit button
    const editButton = document.createElement("button");
    editButton.className = "ml-2 p-1 text-gray-500 hover:text-primary-600 focus:outline-none";
    editButton.title = "Edit group labels";
    editButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    `;
    editButton.addEventListener("click", () => openLabelEditor(allGroupColors));
    tabNavWrapper.appendChild(editButton);

    // Create tab content container
    const tabContent = document.createElement("div");
    tabContent.className = "mt-4 relative";
    tabContainer.appendChild(tabContent);

    // Track the active tab
    let activeTabId = null;

    // Array to store all content panels for height calculation
    const contentPanels = [];

    // Function to switch tabs
    const switchTab = (tabId) => {
        // Hide all tab contents
        tabContent.querySelectorAll('[role="tabpanel"]').forEach(panel => {
            panel.classList.add('hidden');
        });

        // Show the selected tab content
        const selectedPanel = document.getElementById(tabId);
        if (selectedPanel) {
            selectedPanel.classList.remove('hidden');
        }

        // Update tab styles
        tabNav.querySelectorAll('[role="tab"]').forEach(tab => {
            if (tab.id === `tab-${tabId}`) {
                tab.classList.remove('border-transparent', 'hover:border-gray-300');
                tab.classList.add('border-primary-500', 'text-primary-600');
                tab.setAttribute('aria-selected', 'true');
            } else {
                tab.classList.remove('border-primary-500', 'text-primary-600');
                tab.classList.add('border-transparent', 'hover:border-gray-300');
                tab.setAttribute('aria-selected', 'false');
            }
        });

        // Update active tab ID
        activeTabId = tabId;
    };

    // Process each group
    allGroupColors.forEach((labelColor, index) => {
        const comments = repComments[labelColor];
        const UNGROUPED_LABEL = "Ungrouped";

        const labelIndex = AppState.selection.colorToLabelIndex[labelColor];
        const letter = labelIndex !== undefined
            ? labelIndexToLetter(labelIndex)
            : UNGROUPED_LABEL;

        const groupSize = groupSizes[labelColor];
        const tabId = `group-tab-${labelColor.replace('#', '')}`;
        const contentId = `group-content-${labelColor.replace('#', '')}`;

        // Create tab button
        const tab = document.createElement("button");
        tab.id = `tab-${contentId}`;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", contentId);
        tab.setAttribute("aria-selected", index === 0 ? "true" : "false");
        tab.className = `flex items-center px-4 py-2 font-medium text-sm border-b-2 focus:outline-none ${index === 0
            ? 'border-primary-500 text-primary-600'
            : 'border-transparent text-gray-500 hover:border-gray-300'
            }`;

        // Create colored circle for tab
        const circle = document.createElement("span");
        circle.className = "inline-block w-3 h-3 rounded-full mr-2";
        circle.style.backgroundColor = labelColor;
        circle.style.border = "1px solid #999";

        // Add tab text
        const tabText = document.createElement("span");

        // Check if there's a custom label for this color
        const customLabel = AppState.selection.customLabels[labelColor];

        if (customLabel) {
            // Display custom label with group letter
            tabText.innerHTML = `${letter}: ${customLabel} (${groupSize})`;
        } else {
            // Display default label
            tabText.innerHTML = `<span class="hidden sm:inline">Group </span>${letter} (${groupSize})`;
        }

        tab.appendChild(circle);
        tab.appendChild(tabText);

        // Add click event to switch tabs
        tab.addEventListener("click", () => switchTab(contentId));

        // Add tab to navigation
        tabNav.appendChild(tab);

        // Create tab content panel
        const contentPanel = document.createElement("div");
        contentPanel.id = contentId;
        contentPanel.setAttribute("role", "tabpanel");
        contentPanel.setAttribute("aria-labelledby", `tab-${contentId}`);
        contentPanel.className = index === 0 ? "" : "hidden";

        // Create table for this group
        const table = document.createElement("table");
        table.className = "w-full border-collapse";

        // Create header row
        const headerRow = document.createElement("tr");

        // Basic columns
        const basicHeaders = ["ID", "Type", "%"];
        basicHeaders.forEach((h) => {
            const th = document.createElement("th");
            th.textContent = h;
            th.className = "border-b-2 border-gray-200 py-2 px-3 text-left font-medium text-gray-600";
            headerRow.appendChild(th);
        });

        // Add group comparison columns if enabled
        if (AppState.preferences.showGroupComparison) {
            allGroupColors.forEach(color => {
                const groupIndex = AppState.selection.colorToLabelIndex[color];
                const groupLetter = groupIndex !== undefined
                    ? labelIndexToLetter(groupIndex)
                    : UNGROUPED_LABEL;

                const th = document.createElement("th");
                th.className = "border-b-2 border-gray-200 py-2 px-3 text-center font-medium text-gray-600";

                // Create a container for the circle and text
                const container = document.createElement("div");
                container.className = "flex items-center justify-center gap-1";

                // Create colored circle similar to section header
                const circle = document.createElement("span");
                circle.className = "inline-block w-3 h-3 rounded-full";
                circle.style.backgroundColor = color;
                circle.style.border = "1px solid #999";

                // Create text element
                const text = document.createElement("span");
                text.setAttribute("translate", "no"); // Prevent automatic translation
                text.textContent = `${groupLetter}`;

                // Add circle and text to container
                container.appendChild(circle);
                container.appendChild(text);

                // Add container to header cell
                th.appendChild(container);

                // Highlight the current group's column
                if (color === labelColor) {
                    th.classList.add("font-bold", "bg-gray-100");
                } else {
                    th.style.opacity = "0.8";
                }

                headerRow.appendChild(th);
            });
        } else {
            // Just add a single chart column if comparison is disabled
            const th = document.createElement("th");
            th.textContent = "";
            th.className = "border-b-2 border-gray-200 py-2 px-3 text-left font-medium text-gray-600";
            headerRow.appendChild(th);
        }

        // Statement column
        const thStatement = document.createElement("th");
        thStatement.textContent = "Statement";
        thStatement.className = "border-b-2 border-gray-200 py-2 px-3 text-left font-medium text-gray-600";
        headerRow.appendChild(thStatement);

        table.appendChild(headerRow);

        // Create rows for each comment
        comments.forEach((c) => {
            const tr = document.createElement("tr");
            const repColor =
                c.repful_for === "agree"
                    ? "green"
                    : c.repful_for === "disagree"
                        ? "red"
                        : "#333";

            const match = AppState.data.commentTextMap?.[c.tid];
            const isModerated = match?.mod === "-1" || match?.mod === -1;
            const includeModerated = document.getElementById("include-moderated-checkbox")?.checked;

            // Add "(moderated)" text and apply red styling to moderated statements when included
            let commentText = match?.txt || "<em>Missing</em>";
            if (isModerated && includeModerated) {
                commentText = `<span style="color: red;">${commentText}(moderated)</span>`;
            }

            const metaLine = `<div class="text-sm text-gray-500 mt-1">
                Agree: ${c.n_agree}, Disagree: ${c.n_disagree}, Pass: ${c.n_pass}, Total: ${c.n_trials}
            </div>`;

            // Comment ID
            const tdId = document.createElement("td");
            tdId.textContent = c.tid;
            tdId.className = "py-2 px-3 border-b border-gray-200";
            tr.appendChild(tdId);

            // Rep Type
            const tdRep = document.createElement("td");
            tdRep.innerHTML = `<span style="color: ${repColor}; font-weight: bold;">${c.repful_for}</span>`;
            tdRep.className = "py-2 px-3 border-b border-gray-200";
            tr.appendChild(tdRep);

            // % Support
            const tdPct = document.createElement("td");
            tdPct.textContent = `${Math.round((c.n_success / c.n_trials) * 100)}%`;
            tdPct.className = "py-2 px-3 border-b border-gray-200";
            tr.appendChild(tdPct);

            // Add bar charts for each group if comparison is enabled
            if (AppState.preferences.showGroupComparison) {
                // Find vote data for this comment across all groups
                const commentId = c.tid;
                const groupVoteData = {};

                // First, use the current comment's data for the current group
                // This ensures consistency with the statement summary
                groupVoteData[labelColor] = {
                    agrees: c.n_agree,
                    disagrees: c.n_disagree,
                    passes: c.n_pass,
                    total: c.n_trials
                };

                // For other groups, try to find the comment in their representative comments first
                allGroupColors.forEach(color => {
                    if (color === labelColor) return; // Skip current group, already handled

                    // Default values
                    groupVoteData[color] = {
                        agrees: 0,
                        disagrees: 0,
                        passes: 0,
                        total: 0
                    };

                    // First try to find this comment in the other group's representative comments
                    if (repComments[color]) {
                        const groupComment = repComments[color].find(gc => gc.tid === commentId);
                        if (groupComment) {
                            groupVoteData[color] = {
                                agrees: groupComment.n_agree,
                                disagrees: groupComment.n_disagree,
                                passes: groupComment.n_pass,
                                total: groupComment.n_trials
                            };
                            return; // Found in rep comments, no need to calculate from raw data
                        }
                    }

                    // If not found in rep comments, calculate from raw vote data
                    if (AppState.data.groupVotes && AppState.data.groupVotes[color]) {
                        const groupMatrix = AppState.data.groupVotes[color];
                        let agrees = 0, disagrees = 0, passes = 0, total = 0;

                        Object.values(groupMatrix).forEach(participantVotes => {
                            const vote = participantVotes[commentId];
                            if (vote !== undefined) {
                                total++;
                                if (vote === 1) agrees++;
                                else if (vote === -1) disagrees++;
                                else passes++;
                            }
                        });

                        if (total > 0) {
                            groupVoteData[color] = {
                                agrees,
                                disagrees,
                                passes,
                                total
                            };
                        }
                    }
                });

                // Create a bar chart for each group
                allGroupColors.forEach(color => {
                    const tdChart = document.createElement("td");
                    tdChart.className = "py-2 px-3 border-b border-gray-200 text-center";

                    const voteData = groupVoteData[color];

                    // Create bar chart for this group
                    const barChart = createMoreCompactBarChart({
                        voteCounts: {
                            A: voteData.agrees,
                            D: voteData.disagrees,
                            S: voteData.total
                        },
                        nMembers: groupSizes[color],
                        voteColors: Config.voteColors
                    });

                    // Highlight current group's column
                    if (color === labelColor) {
                        tdChart.classList.add("bg-gray-100");
                    } else {
                        tdChart.style.opacity = "0.7";
                    }

                    tdChart.appendChild(barChart);
                    tr.appendChild(tdChart);
                });
            } else {
                // Just add a single chart if comparison is disabled
                const tdChart = document.createElement("td");
                tdChart.className = "py-2 px-3 border-b border-gray-200";

                const barChart = createCompactBarChart({
                    voteCounts: {
                        A: c.n_agree,
                        D: c.n_disagree,
                        S: c.n_trials,
                    },
                    nMembers: groupSize,
                    voteColors: Config.voteColors
                });

                tdChart.appendChild(barChart);
                tr.appendChild(tdChart);
            }

            // Statement + meta
            const tdStatement = document.createElement("td");
            tdStatement.innerHTML = `<div class="comment-text" lang="und">${commentText}</div>${metaLine}`;
            tdStatement.className = "py-2 px-3 border-b border-gray-200";
            tr.appendChild(tdStatement);

            table.appendChild(tr);
        });

        contentPanel.appendChild(table);
        tabContent.appendChild(contentPanel);

        // Store the panel for later height calculation
        contentPanels.push(contentPanel);

        // Set the first tab as active
        if (index === 0) {
            activeTabId = contentId;
        }
    });

    // Add the tab container to the main container
    container.appendChild(tabContainer);

    // Set a consistent height for the tab content area to prevent jumping
    // We need to do this after all panels are added to the DOM
    setTimeout(() => {
        // Make all panels visible temporarily to measure their heights
        contentPanels.forEach(panel => {
            panel.classList.remove('hidden');
            panel.style.position = 'absolute';
            panel.style.visibility = 'hidden';
            panel.style.display = 'block';
        });

        // Find the tallest panel
        let maxHeight = 0;
        contentPanels.forEach(panel => {
            const height = panel.offsetHeight;
            maxHeight = Math.max(maxHeight, height);
        });

        // Reset visibility and apply the consistent height
        contentPanels.forEach(panel => {
            panel.style.position = '';
            panel.style.visibility = '';
            panel.style.display = '';

            // Hide all panels except the active one
            if (panel.id !== activeTabId) {
                panel.classList.add('hidden');
            }
        });

        // Set minimum height on the tab content container
        if (maxHeight > 0) {
            tabContent.style.minHeight = `${maxHeight}px`;
        }
    }, 0);
}

/**
 * Find indices of points within a radius of a mouse position
 * @param {Array} data - Data points
 * @param {number} mouseX - Mouse X coordinate
 * @param {number} mouseY - Mouse Y coordinate
 * @param {Object} scales - x and y scales
 * @param {number} radius - Detection radius
 * @returns {Set} - Set of indices
 */
function findIndicesWithinRadius(data, mouseX, mouseY, scales, radius = null) {
    // Use the current dot size for hover detection if no radius is specified
    const hoverRadius = radius || Math.max(AppState.ui.dotSize + 5, 10);
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

// Track the current share mode
let shareWithPaintMode = true;

/**
 * Share the current state with painted labels
 */
function shareWithPaint() {
    // Update the button text if needed
    if (!shareWithPaintMode) {
        shareWithPaintMode = true;
        updateShareButtonText();
    }

    const encoded = encodeShareState(true);
    const url = `${location.origin}${location.pathname}#${encoded}`;
    const input = document.getElementById("share-url");
    input.value = url;
    input.select();
    document.execCommand("copy");

    // Show a temporary tooltip or notification
    showShareNotification("Link copied with paint data!");
}

/**
 * Share the current state without painted labels
 */
function shareWithoutPaint() {
    // Update the button text if needed
    if (shareWithPaintMode) {
        shareWithPaintMode = false;
        updateShareButtonText();
    }

    const encoded = encodeShareState(false);
    const url = `${location.origin}${location.pathname}#${encoded}`;
    const input = document.getElementById("share-url");
    input.value = url;
    input.select();
    document.execCommand("copy");

    // Show a temporary tooltip or notification
    showShareNotification("Link copied without paint data!");
}

/**
 * Update the share button text based on the current mode
 */
function updateShareButtonText() {
    const shareButton = document.getElementById("share-button");
    shareButton.textContent = shareWithPaintMode ? "Share with paint" : "Share without paint";
}

/**
 * Show a temporary notification after sharing
 * @param {string} message - The notification message
 */
function showShareNotification(message) {
    // Check if a notification already exists and remove it
    const existingNotification = document.getElementById("share-notification");
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create a new notification
    const notification = document.createElement("div");
    notification.id = "share-notification";
    notification.className = "fixed bottom-4 right-4 bg-primary-600 text-white px-4 py-2 rounded-md shadow-lg z-50";
    notification.textContent = message;

    // Add to the document
    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.add("opacity-0", "transition-opacity", "duration-500");
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// For testing purposes, export objects and functions
/**
 * Open the label editor dialog
 * @param {Array} groupColors - Array of group colors to edit
 */
function openLabelEditor(groupColors) {
    // Remove any existing dialog
    const existingDialog = document.getElementById("label-editor-dialog");
    if (existingDialog) {
        existingDialog.remove();
    }

    // Create dialog backdrop
    const backdrop = document.createElement("div");
    backdrop.className = "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center";
    backdrop.id = "label-editor-backdrop";

    // Create dialog
    const dialog = document.createElement("div");
    dialog.className = "bg-white rounded-lg shadow-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto";
    dialog.id = "label-editor-dialog";

    // Create dialog header
    const header = document.createElement("div");
    header.className = "flex justify-between items-center mb-4";

    const title = document.createElement("h3");
    title.className = "text-lg font-bold text-gray-900";
    title.textContent = "Edit Group Labels";
    header.appendChild(title);

    const closeButton = document.createElement("button");
    closeButton.className = "text-gray-500 hover:text-gray-700";
    closeButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
    `;
    closeButton.addEventListener("click", () => {
        backdrop.remove();
    });
    header.appendChild(closeButton);

    dialog.appendChild(header);

    // Create form
    const form = document.createElement("form");
    form.className = "space-y-4";
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        saveLabels();
    });

    // Add input fields for each group
    groupColors.forEach(color => {
        const labelIndex = AppState.selection.colorToLabelIndex[color];
        if (labelIndex === undefined) return;

        const letter = labelIndexToLetter(labelIndex);
        const currentLabel = AppState.selection.customLabels[color] || "";

        const formGroup = document.createElement("div");
        formGroup.className = "flex items-center space-x-3";

        // Color circle
        const colorCircle = document.createElement("div");
        colorCircle.className = "w-6 h-6 rounded-full flex-shrink-0";
        colorCircle.style.backgroundColor = color;
        colorCircle.style.border = "1px solid #999";
        formGroup.appendChild(colorCircle);

        // Group letter
        const groupLetter = document.createElement("span");
        groupLetter.className = "font-medium w-6";
        groupLetter.textContent = letter;
        formGroup.appendChild(groupLetter);

        // Input field
        const input = document.createElement("input");
        input.type = "text";
        input.className = "flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500";
        input.placeholder = `Label for Group ${letter}`;
        input.value = currentLabel;
        input.dataset.color = color;
        input.id = `group-label-${color.replace('#', '')}`;
        formGroup.appendChild(input);

        // Clear button
        if (currentLabel) {
            const clearButton = document.createElement("button");
            clearButton.type = "button";
            clearButton.className = "text-gray-400 hover:text-gray-600";
            clearButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            `;
            clearButton.addEventListener("click", () => {
                input.value = "";
            });
            formGroup.appendChild(clearButton);
        }

        form.appendChild(formGroup);
    });

    // Add buttons
    const buttons = document.createElement("div");
    buttons.className = "flex justify-end space-x-3 mt-6";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => {
        backdrop.remove();
    });
    buttons.appendChild(cancelButton);

    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700";
    saveButton.textContent = "Save";
    buttons.appendChild(saveButton);

    form.appendChild(buttons);
    dialog.appendChild(form);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    // Function to save labels
    function saveLabels() {
        const newLabels = {};

        groupColors.forEach(color => {
            const input = document.getElementById(`group-label-${color.replace('#', '')}`);
            if (input && input.value.trim()) {
                newLabels[color] = input.value.trim();
            }
        });

        // Update AppState
        AppState.selection.customLabels = newLabels;

        // Save to session storage
        saveState("customLabels", newLabels);

        // Update the plots to show the new labels
        renderAllPlots();

        // Update the UI without running analysis again
        renderRepCommentsTable(); // This will use the stored repComments

        // Close dialog
        backdrop.remove();
    }
}

// For testing purposes, export objects and functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AppState,
        loadState,
        saveState,
        getScales,
        pointInPolygon,
        updateDimensions,
        openLabelEditor,
        // Add other functions you want to test
    };
}
