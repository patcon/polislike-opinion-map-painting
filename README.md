# PolisLike Opinion Landscape Painting

This project explores a data painting interface for exploring various participant "opinion maps" derived from data collected in a wikisurvey system like Polis.
<p align="center"><img src="https://imgur.com/A7Oj2ig.png" width="50%" /></p>

Demo (with labels): [`https://patcon.github.io/polislike-opinion-map-painting/#pako:...`][label-example]

| Global cluster paint [🔗][global-example] | Hyper-local feature paint [🔗][local-example] | Group difference paint [🔗][diff-example] |
|--------------|-------------|------------------|
| <img src="https://imgur.com/KowKhk5.png" /> | <img src="https://imgur.com/uwzUu3J.png" /> | <img src="https://imgur.com/Lqprw6L.png" /> |
| <img src="https://imgur.com/sKgGcvE.png" /> | <img src="https://imgur.com/xcJ6MtK.png" /> | <img src="https://imgur.com/rnGH9Rl.png" /> |

## Goals

- Explore subtle differences and alignments in groups
- Build intuition around stats algorithms that surface "diverse consensus" and "group representative" statements
  - Not just whole group clusters found via KMeans, but manual exploration of islands of data
- Build intuition for how different dimensional reduction algorithms surface and hide certain structure in the data

## Roadmap

<details>

<summary>Click to show roadmap items...</summary>

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
  - [x] fix bug in code
  - [x] extract [`osccai-simulation`](https://github.com/raykyri/osccai-simulation/blob/main/src/utils/repness.ts) statistical functions into library
- [ ] Dynamically show diverse consensus statements between painted groups.
- [x] Add toggle to include unpainted participants as a "rest of world" group, for purpose of above stats
- [x] Add ability to share label sets through link
- [x] Remember toggles/settings in same browser session
- import script
  - [x] Add script to generate new datasets
  - [ ] add random seed generation by default
  - [ ] add ability to hardcode seed for projection algo
  - [ ] add ability to hardcode seed for clustering algo
  - [ ] add pre-calculated cluster label sets for PCA/PaCMAP/LocalMAP
- [x] add links to Polis convo and report when applicable
- [x] Clean up interface
- [x] Add columns to more easily compare statement stats between groups
- [x] Allow setting custom per-dataset `n_neighbors`.
- [ ] add option to scale opacity with arbitrary values:
    - [x] vote count (proxy for engagement)
    - [ ] "% finished at last vote" (better proxy for engagement)
    - [ ] participant ID (proxy for time of arrival)
    - [ ] "% passed", to see spectators who aren't thinking
    - [ ] "% agree", to see straight-voters (not real)
    - [ ] "% disagree", to see straight-voters (not real)
    - [ ] "% agree/disagree", to see how opinionated
- [ ] allow inclusion of groups who are representative for "pass"?
    - Group is confused or disengaged by something in a statement.
- [ ] allow ability to submit new topologies or map layers
- [ ] add option to render scaling as color gradient (not just opacity)
- [ ] add option to invert scaling factor
- [x] Add slider for max opacity and dot size (adjustment allows suitability for large and small convos)
- [x] allow toggling inclusion of moderated statements in analysis
- [ ] BUG: fix group stats for moderated statements
- [ ] BUG: Investigate why #5 statement in oprah convo has group A/B reversed.
    - http://localhost:5000/#eyJkYXRhc2V0Ijoib3ByYWgtZm9yLXByZXoiLCJmbGlwWCI6ZmFsc2UsImZsaXBZIjpmYWxzZSwic2hvd0dyb3VwTGFiZWxzIjpmYWxzZSwib3BhY2l0eSI6MSwiZG90U2l6ZSI6NSwiY3VzdG9tTGFiZWxzIjp7fSwibGFiZWxJbmRpY2VzIjpbMCwxLDEsMiwyLDMsMywyLDIsMiwyLDAsMiwxLDIsMCwyLDAsMiwwLDIsMCwzLDMsMywyLDEsMiwxLDIsMCwwLDMsMCwwLDAsMSwyLDMsMCwzLDAsMSwyLDAsMSwyLDIsMSwxLDMsMywyLDIsMywxLDMsMywzLDIsMiwwLDIsMywxLDEsMywzLDIsMCwyLDAsMiwzLDEsMywwLDAsMywzLDIsMywyLDIsMiwwLDAsMCwxLDEsMywwLDAsMCwyLDIsMCwyLDIsMiwyLDIsMSwzLDAsMiwwLDIsMSwyLDIsMywyLDIsMSwyLDIsMSwxLDMsMiwyLDIsMiwyLDIsMiwzLDAsMiwyLDEsMCwzLDAsMCwyLDAsMSwyLDIsMiwwLDIsMywyLDEsMiwxLDIsMywwLDMsMSwwLDIsMywyLDIsMCwxLDIsMywwLDIsMCwwLDAsMywyLDMsMywwLDMsMSwzLDIsMiwyLDMsMywzLDIsMiwyLDEsMywwLDEsMSwzLDAsMywzLDIsMSwzLDMsMSwzLDAsMiwxLDMsMSwzLDIsM119
- [ ] Add option to view side-by-side vs single large view
- [ ] Add feature to animate transitions between algo projects in single view mode.
- [ ] Add true "paint" style selection.
- [ ] Get group selection working on mobile
- [ ] add report option to set limit of number to select
- [ ] add report option to ignore statements below a certain vote threshold
- [ ] add report option to sort by column
- [ ] investigate navigating from sqlite to duckdb for in-browser database
- [x] better compression of data for shorter share urls
- Sliders to reveal proportion of participants
  - [ ] uniformly with participant ID (first vote order)
  - [ ] uniformly with time (first vote time order)
- "include moderated statements" checkbox
  - [ ] auto-refresh report
  - [ ] save to "share" state
- [ ] opacity slider at 100% should be fully opaque
- [ ] Add an "eraser" color to unselect
- [ ] Add undo/redo buttons
- [x] Add group labels to plot
- [x] Add ability to share custom label names
- [x] BUG: Only show labels in UI after used once
- [ ] BUG: why disagree type showing for Group D [here](https://patcon.github.io/polislike-opinion-map-painting/#eyJkYXRhc2V0IjoiNXI3Y2J3YjljdiIsImZsaXBYIjpmYWxzZSwiZmxpcFkiOmZhbHNlLCJvcGFjaXR5IjoxLCJkb3RTaXplIjozLCJsYWJlbEluZGljZXMiOltudWxsLG51bGwsbnVsbCxudWxsLDMsbnVsbCwyLDEsMiwxLG51bGwsMixudWxsLDIsMCxudWxsLDIsMywwLG51bGwsMCwzLDAsMiwyLDIsMiwxLDIsMiwzLDEsMywzLDMsMiwxLDIsMSwyLDEsMywzLDEsMywzLDEsMixudWxsLG51bGwsMCwzLDIsMCwyLDAsMSwxLDEsMiwxLDIsMCwzLDMsMywyLDIsMSwzLDIsMiwzLDMsMSwyLDMsMSwzLDIsMiwyLDIsMywwLDIsMCwwLDMsMCwyLDIsMiwyLDIsMywyLDIsMSwzLDMsMSwyLDIsMiwyLDMsMCwyLDIsMSwzLDMsMiwyLDEsMiwyLDIsMSwzLDIsMSwzLDIsMiwzLDIsMiwzLDMsMSwyLDIsMiwyLDIsbnVsbCwyLDAsMCwxLDIsMywyLDIsMiwyLDIsMSwyLDEsMiwwLDIsMiwyLDJdfQ==)?
- [ ] Show two empty tabs until groups selected.
- [ ] add auto-group widgets
- [ ] Fix lasso select bug when labels aren't disappearing when there's an url hash

</details>

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
7. Paint regions with different colors, and see across which statements they differ and over which statements they align.

### Generate and use your own data

1. Run these commands:

   ```sh
   # 1. Install python dependencies
   uv sync

   # 2. Generate dataset from report URL (faster, recommended)
   uv run python generate.py --url https://pol.is/report/r7cwmiaxczyj8te9rzdmx --slug demdis-eu-9usurb2mmh

   # Alternatively...

   # Directory "slug" named from detected conversation ID: data/9usurb2mmh/
   uv run python generate.py --url https://pol.is/report/r7cwmiaxczyj8te9rzdmx

   # Import from conversation URL (slower)
   uv run python generate.py --url https://pol.is/9usurb2mmh --slug demdis-eu-9usurb2mmh

   # Import from another Polis deployment
   uv run python generate.py --url https://polis.tw/report/r7xrbjj7brcxmcfmeun2u --slug vtaiwan
   ```

2. An entry will be automatically added to `datasets.json`. (Edit "label" as desired.)
3. Run in terminal: `npm install` and `npm start`
4. Open `https://localhost:5000` (may need to open you browser's Developer Tools to force cache clearing)

Other CLI features:

- custom Polis base urls
- custom SSL certs
- dump downloaded data in directory
- load downloaded data from directory

See all options by running `uv run python generate --help`

You can find an exploratory data science notebook here: https://gist.github.com/patcon/0fe7e07ff9dae3a01b2ad49798d98306

## Testing

This project uses Jest for testing. The following commands are available:

```sh
# Run tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with coverage in watch mode
npm run test:coverage:watch
```

The coverage report will be generated in the `coverage` directory.

The project is currently in the early stages of implementing test coverage. We've started with low threshold values to establish a baseline, with the goal of gradually increasing coverage over time to reach at least 70% for branches, functions, lines, and statements.

### Coverage Monitoring

To help maintain and improve test coverage, the project includes:

1. A GitHub Actions workflow that runs tests with coverage on every push and pull request, with results displayed directly in the GitHub interface
2. A script to check if coverage has decreased compared to the previous run:

```sh
# Run the coverage check script
npm run check-coverage
```

This script will compare the current coverage with the previous run and alert if coverage has decreased.

## CodeSandbox

This project was built quickly with CodeSandbox and ChatGPT.

Code Sandbox IDE: https://codesandbox.io/p/github/patcon/polislike-opinion-map-painting
Code Sandbox Preview: https://cx3p47-5000.csb.app/

## Gratitude

- [Computational Democracy Project][compdem] for creating Polis.
- [Collective Intelligence Project][cip] ([@raykyri][raymondz] & [@evanhadfield][evanhadfield]) for [Javascript port][repness-js] of Polis' "representative statement" code.

<!-- Link -->

[compdem]: https://compdemocracy.org/
[cip]: https://www.cip.org/
[raymondz]: https://github.com/raykyri
[evanhadfield]: https://github.com/evanhadfield
[repness-js]: https://github.com/raykyri/osccai-simulation/blob/main/src/utils/repness.ts
[label-example]: https://patcon.github.io/polislike-opinion-map-painting/#pako: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
[global-example]: https://patcon.github.io/polislike-opinion-map-painting/#pako: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
[local-example]: https://patcon.github.io/polislike-opinion-map-painting/#pako:eJztHMuO00DsX3LuYfPgkP4AQuKGkECIQ7fNQqXQVttUCFb77xTYZpOOx4+xZ5ouaCVvmkw8Htvj17h9yFaLbrFvumye3X4pbl7dZLPsrl3vPmTz7v7Q/P3w8fRh/3X7/fX99rB7u7ht2n02v1u0++P97W6xXHc/snk+y1bb7t36Z5PNi1m2POy77bfT4IfHWbbeLNvDqnm/2S3Wm65Z9Sja34PebFbrZXMc+mlzaNvZMyhG18NPXBDyzn9AgVz6qJwA0TFXfXX6NxQIvK789C9k2RT7QtjCpyPMVJgKzVF4e0WwkgtMaOFOUknpo3XHec5i09NbdRRNrDHydBqUC7Bel7GJOfMQt501MhDylQG+jITeWmKYX4Q8UIcZcyukZk3CsO3CEWJCziIKMtUwOdjT2jMLCFxNqQtRhMux50qEjzC19FzDGOAR2kBw+h5HDQpskUKXpWOXIyx49mCZwugkd7kgxFqHzChkReXOJNHzmMas8FwPqbucMTXWa1Ps8UAZmIT/44DPo1yp0kzFYk2CmKy+7uMLufjmjiLFSr+cglRq2xHiAUolqeVI6rAuMNWEksO124GaW8xzHsHSGbMe4Y6DD56brwOpE0OHMqH3MtiICHth7IV06smkbdEJqU9CBIxP6rgEjQFxMCSVtSMMto3jY7ROh5kLW4OwzBl5zpJdPWKXeIc62OxSrhAitFbRQHTBLhlZb02irjyvw3cRrlBHiFaWEJlHeIpZjl4Yi0JhCsoIRh91i450hZpUj/7lvNfhQRUjFCvwYiBfiCEbxplaZ5gpEiSVA3qv6rQlMqik208oyLDMk4W6gvYs0CURSTBWuViJzdTvbng8wpsL6NJLBoogmRII0EIRYgr4IjduolEDh/LyT5g6vF0HEW2cI2srRHwOo91KDs+0BSydsQDK1VcByrMIymF8LdB3PgtrVyWY3ZF0slN6iEHQowrH4qJDChAdITRrAMJ1ccSIGmhqBv4G94mIC9C6ZeXeEqoUNXwKFbq4hzdTApWT5FFrQ/feM4gYuuOAWkHIvjCVqENA3+dCk16lPBVQFTsoIaKVp7Mb4uAmoTRh2vkUi936hVYERDI4QL9FIJbTuJsF7Sdi1hvgQb5UucDerEi0QnkLbZRV0qRTo7jZYXGSz/TrDvSxi7gePWQb62XUmYiNlE4PfL1GdGOKjgywjF9ilMYDtec6jQRsgHDb9nmIjhwTgzpkvi+nhVEGbxJx7FQErSc/c1M9u2E8U8hNjIubUYBJbmty3uzwwPg0JX3/3NiPUfNbSR6N2pLmDQWJU1xlYZap0Jhcoa00Lt9A1hKEBkOyT+BBQAY6jvFZrpBeLF3t6tOuyvutZYo7LFoRN2dSpEGQlMe/se9DS7rinxSozmSnUy6YQHG7dFpgd0oF5MS0AQ8x4dqmJ5PvN9Vn4WJYkwifFNQb+BprTPqr6PObYNRAIxlFMrN7BqhJxSi86aSnBiYVwmBWP80utCB2vXiTA7UmsEgLJJrji9iik2g/j/iXqsJ6jJ+ByQ//2GkVU0OtdAdmcbS0zXlE9zYAB1k+NeybFcbnoSH6AQSq2rPJSEYFSM7o6rEzYgoWz4okbdKto9cX6fnGpCoo05XTiQBxs4wjTyBNRI8AIwPFr9vBvOAs4PPjL+ucGkY=
[diff-example]: https://patcon.github.io/polislike-opinion-map-painting/#pako:eJzVmVFrE1EQhf/LPudBu/iSPyCCbyIo4kOabDWwJqHZIFr6361IsSZ3Zr4z925BCku7e/fOzJkzZ2Zv77rNalodh6lbdtdfrl68etEtuptxe/jQLafb0/Dnj4+Pfxy/7r+/vt2fDm9X18N47JY3q/H4cH9/WK23049u+XLRbfbTu+3PoVteLbr16Tjtvz0uvrtfdNvdejxthve7w2q7m4bN487j7zVvdpvtenhY+Wl3GsfF30v/z+9P/6KXvublWS7P7ciFvQoYCcJ9OlP9000yrpaX9yKNwjiUu01T3lMn2tHdAANiCNPu8jRIqhwqe7NgXKODZfoSULNyiIOMqrEG0NpzSUAe2jwqwRGg6O0BJSSQK/mRxikjcIOtxoOM89m0VmCQ03R3Q1YEcsAEZUUNQ9rOkzeDRTjEeDvXh6ItPfdpeoiLsOzN5N9Mb7cyVVRZN9ky9Pj33F0RBFLxTVPTThj/70uRXQqBVMmWRimFdolPoYRKNR/2PWTs9gGTkyZwONOlUfBaYqI3WnmC+cUMyDErq2It5obADwzizJcKIbYH1dlmoQrazzXpPzPa2eLEBFQghIiFQ7NclJeShaMimqDNZZm8J7QSYuLmyuja+UPMAH3C4sQUoHAkkzhcESUg6eRlQRobJ9/WOP9KouHaRkMQjtXKHmvj9CTyWeW/qodWdRlvdKpvmVjGPL3QpsJkI6iX7HPsCMnkeAKXS8eGIcIBNYpbx3gHr9mrScd20yqmTKaTVzsJrw3eAPzVIQFFSkJHrxOPQKH7/xqwaRdHFwNCGG84TSBljd0oc49CbkjaMBFAqZScTEDPZa8ulUwbxaz2wPD8Rho6lFYTR6a84jPL5UD438aEfokwSPWWBla/sK+EOg9azrGeyuJIxLJrMQKTxpvOLj6+0Nryk/CJQnDTTDRjfJSaYTm3gSVyHmfJkHLyTry0MatUlgRplksmulu0mJiczo5LaM9QU2fkM5zHsq0h2DgwX8k20uGTuoLHE00dYsqzkEX7sdnkJjbmMuIQLXEnrIHn6xOshJSu2lnZzfWtvruWtMx1lJ6haMps2W4Ec1iRxBfoUKLV450DiOFMR6got2D+hWvdN7oNrI2L1uxtbVsPb4XlwkAg4wekuaaO0JRwYtKMToUkIr8bXlhzl2cVcLASs0KDkj8PO382+9B6oXJpV7Jdd47CdFJiajQgqZJeJkKyx4nofFwFtmlZtnanzQf0hRxYYuaJXfJQmA/8NmhjHUeZYqXld34gAbwUU8U2knIgMsq1aG1vJ8gGPfJB7x+u/5oR1hvYuwQhMTWy4Oe7vl6tcizevFPu2RhBZUYX5lHLGPHEJgTRytiyIJbFx17NykKZQlEGgASfIJztlf2WnlvckZHX7pa4sbrO9Bfu2PaKNokUYeUNQlPVinUswmG/jtA3XkAgyBtkH9IycMb9whLqw6BNSo5ZnM0+i3UPlBsh54JWj3ZyIWDNpri4CLuRC2Fgi9TJjSqgqDN1hAw13LF1waOO05Y408MRxfLMrE8AX/AECprLIiuSNPkBL2yM0lbRc0FMCd2srQlLeRTljnhWY9GET0cwUw8qiFaRNb+ArdwZkkO7aqNmRkZGwpnLxD78fL7/BZcZJLY=
