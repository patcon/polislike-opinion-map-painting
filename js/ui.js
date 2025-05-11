
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
    document.getElementById("include-unpainted").checked = loadState("includeUnpainted", false);
    document.getElementById("auto-analyze-checkbox").checked = loadState("autoAnalyze", true);
    document.getElementById("include-moderated-checkbox").checked = loadState("includeModerated", false);
    document.getElementById("scale-opacity-checkbox").checked = AppState.preferences.scaleOpacityWithVotes;
    document.getElementById("flip-x-checkbox").checked = AppState.preferences.flipX;
    document.getElementById("flip-y-checkbox").checked = AppState.preferences.flipY;
    document.getElementById("show-group-comparison-checkbox").checked = AppState.preferences.showGroupComparison;

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

    // Run analysis button
    document.getElementById("run-analysis").addEventListener("click", applyGroupAnalysis);
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
        "PCA": "Principal Component Analysis (PCA): A dimensionality reduction technique that finds the directions (principal components) of maximum variance in the data. It's useful for visualizing high-dimensional data in a lower-dimensional space while preserving as much variance as possible.",
        "PaCMAP": "Pairwise Controlled Manifold Approximation and Projection (PaCMAP): A dimensionality reduction algorithm that preserves both local and global structure of the data. It balances the preservation of local neighborhoods with the overall data distribution.",
        "LocalMAP": "LocalMAP: A dimensionality reduction technique that focuses on preserving local relationships between data points. It's particularly effective at maintaining the structure of local neighborhoods in the data."
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

            if (!additive) {
                AppState.selection.colorByIndex.fill(null);
                AppState.selection.selectedIndices.clear();
            }

            svg.selectAll("circle").each(function ({ d, i }) {
                const cx = scales.x(d[0]);
                const cy = scales.y(d[1]);
                if (pointInPolygon([cx, cy], coords)) {
                    AppState.selection.colorByIndex[i] = selectedColor;
                    AppState.selection.selectedIndices.add(i);
                }
            });

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

    Config.colors.tab10.forEach((color, i) => {
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

    // Create tab navigation
    const tabNav = document.createElement("div");
    tabNav.className = "flex flex-wrap border-b border-gray-200";
    tabContainer.appendChild(tabNav);

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
        tabText.innerHTML = `<span class="hidden sm:inline">Group </span>${letter} (${groupSize})`;

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
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AppState,
        loadState,
        saveState,
        getScales,
        pointInPolygon,
        updateDimensions,
        // Add other functions you want to test
    };
}
