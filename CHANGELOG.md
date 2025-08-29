# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Added basic Google Analytics tracking.
- Added a minimum vote threshold for the group analysis, to help filter out insignificant statements in larger conversations.
- Added checkbox to bring any colored participants (painted or voted, depending on mode) to the top layer, so they're not hidden behind black inactive participants.
- Add loading indicators for when plot freezes to redraw with votes, etc.
- Only reload plots when sliders are released from being dragged.
- :tada: Added ability to show arbitary plots and have it take up full screen width.
- When arriving fresh on mobile, just show the LocalMAP plot.
- Use a bar chart for overall comparison for each statement in group analysis.
- Ensure minimum vote value filters consensus tab statements too.
- Disable and reset vote color mode when changing datasets.
- Enable statement ID input even when "show votes" checkbox unchecked.
- Add datasets for Worchester City Plan, Louisville Civic Assembly, and Ministry of Canadian Heritage.
- Remove limits on number of statements shown on consensus and group-representative tabs.

### Fixed
- Updated the BG2050 dataset to work with vote color mode.
- Upstream `keep_participant_ids` bugfix to red-dwarf and using bugfix branch.
- Ensure "Hightlight pass votes" checkbox state is included in share link.
- Fix bug in "Show moderated statements" that was preventing them from displaying.
- Ensure "auto-analyze" checkbox affects all report checkboxes properly.
- Ensure statement ID can't below 0. Ensure proper number input comes up on iOS.

## [0.12.0] - 2025-08-24

### Added
- Vote visualization mode showing participant votes by statement
- Second color scheme that highlights pass votes
- Button to put votes onto the plot
- Statement text below checkbox for viewing vote
- Consensus analysis tab
- Roo help documentation

### Changed
- Made barchart more compact
- Remember which tab was active when re-rendering the analysis table
- Save more UI config in session state (dotOpacity, dotSize, vote color settings)

### Fixed
- SVG icon issue and grayed out statement ID input when disabled
- Off-by-one error in vote color display for some datasets
- Dataset directory name issue

## [0.11.0] - 2025-07-10

### Added
- UNDP youth conversations datasets
- Audrey documentary dataset

### Changed
- Updated to use run_pipeline() for data processing
- More clearly document when using active participant IDs from platform vs recalculating
- Updated red-dwarf to use main edge branch
- Removed internal code in favor of run_pipeline()

## [0.10.0] - 2025-06-27

### Added
- Nepalese datasets (bandh, vehicle tax)
- Cuba peace march dataset
- Custom n_neighbors configuration in meta.json

### Changed
- Updated 5-dimensions scaling dataset multiple times
- Updated nl-digital-society dataset
- Updated index.html

## [0.9.0] - 2025-06-12

### Added
- Humanitarian rethink dataset
- Datasets for bajour FC, oprah, and #TransportNewNormal
- San Juan land bank dataset
- Toronto bike lanes dataset
- Plural research experiment data
- zKe datasets (participation, tax law, youth bill)
- Polis meta dataset
- 5-dimensions scaling deliberation dataset

### Changed
- Better compression of data in share url hash
- Allow selection of unpainted group to be stored in hash state
- Updated README images
- Clean up roadmap todos

## [0.8.0] - 2025-05-30

### Added
- Mobile prototype (mobile-test.html)
- Origin lines for better visualization
- Link to mobile prototype in mobile warning

### Changed
- Fix selection when zoomed
- Keep circle size consistent when zooming
- Allow dataset selection, reset zoom, change select style
- Bigger font on mobile-test
- Lock max zoom and extend origin axes
- Allow closer zoom for large conversations
- Updated DUST poland dataset

## [0.7.0] - 2025-05-26

### Added
- More datasets to the collection
- Items to roadmap

### Changed
- Continued automated dataset updates for nl-digital-society

## [0.6.0] - 2025-05-15

### Added
- NL Digital Society dataset with automated updates
- Automated dataset update system via GitHub Actions
- Environment variable configuration for dataset slugs
- EditorConfig for consistent formatting

### Changed
- Script improvements: allow update using just slug, accept multiple slugs
- JSON formatting updates
- Small dataset as default
- Fixed GitHub Actions workflow issues

### Fixed
- Dataset update to ignore changes to votes.db
- Various GitHub Actions configuration issues

## [0.5.0] - 2025-05-14

### Added
- NL Sexting dataset
- Roadmap item for selection widgets
- UI TODO items

### Changed
- Allow saving labels in shared state
- Add labels to plots with collision detection and smart layout
- Store group label show/hide state in hash
- Persist custom colors in shares
- Only add custom color to palette once used

### Fixed
- Bug with painting on labels
- Sporadic bugs with label handling

## [0.4.0] - 2025-05-12

### Added
- Undo/redo functionality
- Greenbelt dataset
- Auckland transport dataset
- Explanation of painting functionality
- Option to show/hide group labels
- Multi-type button to share with or without paint
- Tooltips for dimensional reduction algorithms

### Changed
- Move dataset select to top
- Move titles out of SVG
- Improve DR algorithm tooltip text
- Make roadmap collapsible
- Don't send label data when nothing is selected

## [0.3.0] - 2025-05-11

### Added
- Comprehensive test coverage for config.js and data.js
- Tabbed interface for groups
- More compact horizontal bar chart
- Canadian Electoral Reform dataset
- Yoronchizu data
- Loading spinner for new stats

### Changed
- Fix label center on group count label
- Make headers more compact
- Ensure constant height when switching group tabs
- Make tab names short on mobile
- Store opacity and dotsize in share URLs
- Prevent auto-translation of letter-labels by Google Translate

### Fixed
- Path for generated data
- Spinner functionality

## [0.2.0] - 2025-05-10

### Added
- Test suite with coverage checking
- GitHub Actions workflow for automated testing
- Test summary in UI
- Tests for zSig90 and twoPropTest functions

### Changed
- Split main.js into separate files with documentation
- Update GitHub Action versions

### Fixed
- One failing test resolved

## [0.1.0] - 2025-05-09

### Added
- Group comparison functionality with statistical analysis
- Colors to group label columns in comparison table
- Letters for label counts
- First comprehensive test suite
- Compression TODO item

### Changed
- Make palette colors circle instead of square
- Center palette letter labels
- Default group comparison to enabled
- Convert links to buttons
- Remove legacy backward-compatibility globals
- Updated roadmap and README

### Fixed
- Comparison barcharts to use same data source
- Bold styling for biggest proportion in bar chart
- Bug when loading from share state
- Auto-analyze on arrival when enabled

---

*This changelog follows semantic versioning and is generated from git commit messages.*
