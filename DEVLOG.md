# Devlog

## 2026-02-03
Summary: Scanned the extension codebase and documented architecture.

Observed regression: Some first words of sentences are highlighted when they should be suppressed.

Notes
- Sentence-start suppression is controlled by a global `atSentenceStart` flag in `content.js`.
- Block-start detection uses `isFirstWordInBlock`, and sentence boundary detection uses a terminator set plus minimal abbreviation checks.
- The keyword registry can override sentence-start suppression if the word was previously discovered in a non-sentence-start position.

Hypotheses to test
- `atSentenceStart` is global across text nodes, so sentence-start state may leak across blocks or nodes and cause false positives.
- Tokenization/terminator handling might skip a boundary when punctuation is split into adjacent tokens or includes unexpected characters.
- Retroactive registry logic may be adding words that should not be considered for sentence-start highlighting.

Next steps
- Add targeted logging around sentence-start transitions and block-start detection.
- Create a minimal HTML fixture to reproduce the bug.
- Identify the feature change that introduced the regression (registry/retroactive or excluded tag configuration changes are likely suspects).

## 2026-02-03 (continued)
- Work
  - Updated sentence-start state handling to track punctuation inside excluded tags (e.g., links) without highlighting them.
- Rationale
  - Excluding tags like `A` can hide sentence terminators, which makes the next sentence’s first word look mid-sentence and get highlighted.
- Change
  - `content.js`: added `getSkipReason`, `isSentenceTerminator`, and `updateSentenceStateFromText` to preserve sentence boundaries across excluded tags.
- Next
  - Verify on a page with a sentence ending inside an `<a>` tag and confirm the following sentence starter is no longer highlighted.

## 2026-02-03 (continued 2)
- Work
  - Added block-boundary reset for sentence-start tracking.
  - Introduced a minimum length gate for registry-based sentence-start highlighting to reduce false positives.
- Files
  - `keyword_highlighter/content.js`
- Notes
  - `REGISTRY_MIN_LEN` default set to 5; short words won’t be stored or highlighted from the registry at sentence/block start.

## 2026-02-03 (continued 3)
- Work
  - Tightened registry-based sentence/block start highlighting to exclude plain Capitalized words.
- Rationale
  - Sentence starters in normal sentence case (e.g., “Finance”) should not be highlighted even if the word exists in the registry.
- Files
  - `keyword_highlighter/content.js`

## 2026-02-03 (continued 4)
- Work
  - Made per-site enable/disable more reliable by clearing highlight registries on disable and sending an explicit toggle message from background to content scripts.
  - Added a cleanup interval guard so it starts even if a site is enabled after initial load.
- Files
  - `keyword_highlighter/content.js`
  - `keyword_highlighter/background.js`

## 2026-02-03 (continued 5)
- Work
  - Added an optional setting to skip auto-detect highlights on short metadata-like lines (comma/parenthesis-heavy, Title Case, no sentence terminator).
- Files
  - `keyword_highlighter/content.js`
  - `keyword_highlighter/options.html`
  - `keyword_highlighter/options.js`
  - `ARCHITECTURE.md`
