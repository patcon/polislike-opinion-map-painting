# d3-painting-polis-like

This project explores a data painting interface for exploring various participant "opinion maps" derived from data collected in a wikisurvey system like Polis.

Demo: https://patcon.github.io/polislike-opinion-map-painting

| Custom paint full graph | Custom paint area of interest |
|---|---|
| <img width="1420" alt="Screenshot 2025-05-02 at 3 07 07 AM" src="https://github.com/user-attachments/assets/601dada2-2555-4fd9-a878-cd42965c9517" /> | <img width="1421" alt="Screenshot 2025-05-02 at 2 53 33 AM" src="https://github.com/user-attachments/assets/76cc1d0e-85cf-4d93-b82c-875e44687c92" />

## Goals
- Explore subtle differences and alignments in groups
- Build intuition around stats algorithms that surface "diverse consensus" and "group representative" statements
    - Not just whole group clusters found via KMeans, but manual exploration of islands of data
- Build intuition for how different dimensional reduction algorithms surface and hide certain structure in the data

## Roadmap
- [x] Render demo data
- [x] Support painting clusters
- [x] Support painting with multiple colors at once
- [x] Show counts of participants in each painted cluster
- [x] Document how to load own data
- [x] Add lasso selection UX, to avoid rectangular selection constraint
- [x] Add hover "active" effect for participants under mouse to help see shape across projections before selecting
    - [x] Improve selection code performance ("painting" experiments are slow)
- [x] Allow selection from multiple datasets
- [ ] Allow loading of own dataset into browser memory of hosted app
- [x] Dynamically show representative (differentiating) statements for painted groups.
    - [ ] fix bug in code
    - [ ] extract [`osccai-simulation`](https://github.com/raykyri/osccai-simulation/blob/main/src/utils/repness.ts) statistical functions into library
- [ ] Dynamically show diverse consensus statements between painted groups.
- [x] Add toggle to include unpainted participants as a "rest of world" group, for purpose of above stats
- [ ] Clean up interface
- [ ] Add option to view side-by-side vs single large view
- [ ] Add feature to animate transitions between algo projects in single view mode.
- [ ] Add true "paint" style selection.

## Usage

### Explore existing data

1. Open the hosted demo link: https://patcon.github.io/polislike-opinion-map-painting
2. Choose a color
3. Drag selection boxes to highlight participants. Cmd+click for additive select
4. Change the color. Cmd-drag to paint with multiple colors
5. Notice the counts on the bottom, showing you have many participants are in each color.
6. Explore!
    - Move along "coasts" of map, or across ismuths.
    - See how "dense" some regions are with participants, while some are diffuse and sparsely populated. 
    - Notice how one algorithm might see structure or relationship differently than another.
8. FUTURE: Paint regions with different colors, and see which statements across which they differ and over which statements they align.

### Generate your own data

1. Load this notebook in Google CoLab via the badge: https://gist.github.com/patcon/0fe7e07ff9dae3a01b2ad49798d98306
2. Replace the `REPORT_ID` (preferred) or `CONVO_ID` with your own.
3. Search `RANDOM_SEED_DEFAULT` and `RANDOM_SEED_KMEANS_OVERRIDE` and comment out the specific values, so we get different values each run.
4. Run all cells in notebook (Select menu item `Runtime > Run all`)
5. Inspect "Generate Plots" section.
6. Regenerate results a few times to see how the shapes of islands change (LocalMAP). (Ignore color for now.)
    - Place the cursor in "Run dimensional reduction algorithms" code section
    - Select `Runtime > Run cell and below` to run subsequent steps
7. Once you have a sense of structure, look for the printed output that shows the randomly generated seed. When you see a shape of the LocalMAP plot that looks to have some variety, copy the seed into `RANDOM_SEED_DEFAULT`. Re-running will now always give the same shape and same colored clusters.
8. You have now generated the projection data you need! You're ready to download the data:
    - Set `DO_GENERATE_DATA_DOWNLOAD_BUTTONS=True`
    - Re-run that cell, to generate the download buttons.
    - Download the data to your machine.
    - Optional: If you wish to save the notebook and share it publicly, you'll need to follow the instructions in that cell to delete the buttons again.
  
### Use your own data in the app

1. Open the app in code sandbox (see link below)
2. create a new directory in `data/`
3. create 3 empty files: `pca.json`, `pacmap.json` and `localmap.json`
4. Copy the contents of each file you just downloaded into those files.
5. In `index.html` set `convo_slug` variable to your newly create folder name.
6. In the bottom of the lower window, click the "PORTS" tab.
7. In the list, there should be a row called "start (5000)"
8. Click the url (e.g. `https://xxxxxx-5000.csb.app/`) to open it in a new window.
9. Explore your data!

## CodeSandbox

This project was built quickly with CodeSandbox and ChatGPT.

Code Sandbox IDE: https://codesandbox.io/p/github/patcon/polislike-opinion-map-painting
Code Sandbox Preview: https://cx3p47-5000.csb.app/
