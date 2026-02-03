# Project Architecture: Keyword Highlighter

## Overview
Keyword Highlighter is a browser extension (Manifest V3) that applies highlight overlays to words in web pages. It uses the CSS Custom Highlight API to avoid DOM mutation while tracking ranges and updates highlights on live DOM changes.

## High-Level Flow
1. Content script loads settings from `browser.storage.local`.
2. Content script scans text nodes, tokenizes them, and applies highlight ranges via the Custom Highlight API.
3. Background script updates toolbar icon state and sends an explicit message to the content script when per-site enablement is toggled.
4. Options page updates settings, which trigger content script listeners to re-scan and re-render.

## Components
- `keyword_highlighter/content.js` — main highlight engine; reads settings, applies custom styles, manages highlight ranges, and watches DOM mutations.
- `keyword_highlighter/background.js` — tracks tab URLs, toggles per-site enablement, updates the toolbar icon, and signals content scripts on toggle.
- `keyword_highlighter/options.html` — options UI markup.
- `keyword_highlighter/options.js` — options UI logic; validates and persists settings, provides registry reset.
- `keyword_highlighter/options.css` — options UI styles.
- `keyword_highlighter/manifest.json` — MV3 manifest; declares content script, permissions, and background script.

## Highlight Pipeline (content.js)
1. Settings load into `currentSettings` and initialize `CONFIG`.
2. CSS Custom Highlight API registers `Highlight` objects for `bolder-darken` and `bolder-lighten`.
3. Custom highlight rules are parsed and associated with per-rule `Highlight` objects.
4. A TreeWalker collects text nodes and `processTextNode` handles each node.
5. `processTextNode` skips excluded/hidden nodes, checks min word count, applies custom rules, tokenizes text, and applies sentence-start/block-start suppression for auto-detect.
6. Ranges are tracked in `activeRanges` for cleanup; a MutationObserver re-processes changed nodes.

## Settings and Storage
- Settings stored in `browser.storage.local` include enablement, auto-detect configuration, colors, custom rules, registry config, and excluded tags.
- Registry stored per-domain or globally as `bolder_registry_<hostname>` or `bolder_registry_global`.
- Retroactive highlighting uses `skippedCandidates` to apply highlight if a token later becomes known.

## Key Data Structures
- `CONFIG` — runtime parameters like terminators, excluded tags, and block tags.
- `activeRanges` — `Map<Range, Highlight>` to support removal and cleanup.
- `registry` — `Set<string>` of discovered keywords.
- `skippedCandidates` — `Map<lowercaseWord, Array<{node, offset, length}>>` for retroactive highlight.

## Notable Behaviors
- Sentence and block starts are suppressed from auto-detect highlighting, except for registry hits.
- Excluded tags are resolved by most-specific domain match in `excludedTagsConfig`.
- Background luminance determines which highlight style to apply (darken vs lighten).

## Build and Dev
- `npm run dev:chrome` and `npm run dev:firefox` for development.
- No bundling; source is used directly in the extension.
