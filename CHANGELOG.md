# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-02-06

### Changed
- **Rebranding**: Renamed the extension to **Smart Keyword Highlighter** across all platforms and documentation.
- **Improved Stability**: Hardened initialization to better handle Single Page Applications (SPAs) like LinkedIn where the page body may be replaced dynamically.
- **Privacy**: Removed unnecessary `activeTab` permission to follow the principle of least privilege.
- **Store Presence**: Optimized extension description and titles for better clarity.

### Fixed
- Improved highlight re-attachment logic when the web page body is swapped during site navigation.

### Added
- Updated documentation and new screenshots in the options page and README.

## [1.0.0] - 2025-12-01

### Added
- Initial release of Smart Keyword Highlighter.
- Highlights uppercase and capitalized words on web pages.
- **Configurable Preferences**:
    - **Minimum Words in Block**: Set the minimum number of words required in a block for highlighting to occur (default: 10).
    - **Background Colors**: Customize the background colors for "darken" (light backgrounds) and "lighten" (dark backgrounds) styles using a color picker and opacity slider.
- **Site List**: Enable or disable the extension on specific sites (allowlist/blocklist mode).
- **CSS Custom Highlight API**: Uses the modern CSS Custom Highlight API for high performance and no DOM interference.
