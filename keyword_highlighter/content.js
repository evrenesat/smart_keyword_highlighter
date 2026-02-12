(function () {
    'use strict';

    // --- Polyfill & Helpers ---
    const browser = (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined")
        ? globalThis.chrome
        : globalThis.browser;

    function storageGet(keys) {
        return new Promise((resolve, reject) => {
            try {
                const result = browser.storage.local.get(keys, (data) => {
                    if (browser.runtime.lastError) {
                        // If it was a promise-based API that failed, or callback error
                        // But if it's promise based, this callback might not be used or it behaves differently.
                        // Actually, Firefox supports callbacks too.
                        // Let's try to use the return value check.
                    }
                    resolve(data);
                });
                // If result is a promise (Firefox), wait for it.
                if (result && typeof result.then === 'function') {
                    result.then(resolve, reject);
                }
            } catch (e) {
                reject(e);
            }
        });
    }

    // --- Storage & Init ---
    const defaultSettings = {
        defaultEnabled: true,
        siteList: [],
        minWordsInBlock: 10,
        bolderDarkenBg: 'rgba(0, 0, 0, 0.1)',
        bolderLightenBg: 'rgba(255, 255, 255, 0.25)',
        customHighlights: '',
        disableAutoDetect: false,
        registryConfig: '1000: *.*',
        excludedTagsConfig: '*.*: SCRIPT, STYLE, NOSCRIPT, TEXTAREA, INPUT, SELECT, OPTION, CODE, PRE, IFRAME, SVG, CANVAS, KBD, VAR, A',
        skipShortMetadataLines: false,
        debugLogging: false,
        debugWords: ''
    };

    let isEnabled = false;

    function checkEnabled(settings) {
        const hostname = window.location.hostname;
        const inList = settings.siteList.some(site => hostname.includes(site));

        if (settings.defaultEnabled) {
            // Enabled by default: Run UNLESS in list (Exclusion list)
            return !inList;
        } else {
            // Disabled by default: Run ONLY IF in list (Inclusion list)
            return inList;
        }
    }

    function init() {
        console.log('Bolder: Script started');

        try {
            // Check for CSS Custom Highlight API support
            if (typeof CSS === 'undefined' || !CSS.highlights) {
                console.warn('Bolder: CSS Custom Highlight API is not supported in this browser.');
                return;
            }

            if (typeof Highlight === 'undefined') {
                console.warn('Bolder: Highlight API is not supported (Highlight constructor missing).');
                return;
            }

            console.log('Bolder: CSS Custom Highlight API is supported.');

            // --- Configuration --- 
            const CONFIG = {
                minUppercaseLen: 2,
                minCapitalizedLen: 3,
                minWordsInBlock: currentSettings.minWordsInBlock,
                shortMetadataMaxWords: 8,
                terminators: new Set(['.', '!', '?', '…', ':', ';', '-', '–', '—', '•', '●', '*', '■']),
                blockTags: new Set([
                    'DIV', 'P', 'LI', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                    'HEADER', 'FOOTER', 'SECTION', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'FIGCAPTION',
                    'STRONG', 'B'
                ]),
                excludedTags: new Set(),
                excludedAttrs: ['contenteditable']
            };

            function parseExcludedTagsConfig() {
                const configStr = currentSettings.excludedTagsConfig;
                if (!configStr) {
                    // Fallback default
                    CONFIG.excludedTags = new Set([
                        'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
                        'CODE', 'PRE', 'IFRAME', 'SVG', 'CANVAS', 'KBD', 'VAR', 'A'
                    ]);
                    return;
                }

                const lines = configStr.split('\n');
                const hostname = window.location.hostname;
                let bestMatch = null;
                let bestMatchLen = -1;

                lines.forEach(line => {
                    const parts = line.split(':');
                    if (parts.length < 2) return;

                    const domain = parts[0].trim();
                    // Calculate match specificity
                    let matchLen = 0;
                    if (domain === '*.*') {
                        matchLen = 0; // Lowest priority
                    } else if (hostname === domain || hostname.endsWith('.' + domain)) {
                        matchLen = domain.length; // Priority by length
                    } else {
                        return; // No match
                    }

                    // If this match is better (more specific) than previous best
                    if (matchLen > bestMatchLen || bestMatch === null) {
                        bestMatchLen = matchLen;
                        bestMatch = parts[1];
                    }
                });

                if (bestMatch) {
                    const tags = bestMatch.split(',').map(t => t.trim().toUpperCase()).filter(t => t);
                    CONFIG.excludedTags = new Set(tags);
                } else {
                    // Should theoretically not happen if *.* exists, but good safety
                    // If no match, maybe empty set? or default?
                    // Plan said "use that tag list". If no match found, use empty set (nothing excluded).
                    CONFIG.excludedTags = new Set();
                }
            }
            parseExcludedTagsConfig();

            /*
                 excludedTags: new Set([
                    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
                    'CODE', 'PRE', 'IFRAME', 'SVG', 'CANVAS', 'KBD', 'VAR', 'A'
                ]),
            */

            // --- Regex ---
            const RE_UPPERCASE = new RegExp(`^\\b[A-Z]{${CONFIG.minUppercaseLen},}\\b$`);
            const RE_CAPITALIZED = new RegExp(`^\\b[A-Z][a-z]{${CONFIG.minCapitalizedLen - 1},}\\b$`);
            const RE_MIXED_CASE = /^\b([A-Z][a-z]*[A-Z][a-zA-Z]*|[a-z]+[A-Z][a-zA-Z]*)\b$/;
            const RE_HYPHENATED = /^\b(?=.*[A-Z])[A-Za-z]+-[A-Za-z]+\b$/;

            // --- Highlight Registry ---
            const highlightDarken = new Highlight();
            const highlightLighten = new Highlight();
            CSS.highlights.set('bolder-darken', highlightDarken);
            CSS.highlights.set('bolder-lighten', highlightLighten);

            // --- Custom Highlights Setup ---
            let customRules = []; // Array of { regex, highlightName }

            function updateCustomRules() {
                // Clear old custom highlights from CSS registry if any? 
                // We'll just overwrite them or keys will be reused.
                // But we need to cleanup activeRanges that use old custom rules?
                // For now, let's just parse.
                customRules = [];
                const lines = currentSettings.customHighlights.split('\n');
                let ruleIndex = 0;

                lines.forEach(line => {
                    const parts = line.split(':');
                    if (parts.length < 2) return;

                    const color = parts[0].trim();
                    const keywords = parts[1].split(',').map(k => k.trim()).filter(k => k);
                    if (!keywords.length) return;

                    const highlightName = `bolder-custom-${ruleIndex++}`;
                    const highlight = new Highlight();
                    highlight.priority = 1; // Prioritize custom highlights over default bionic reading
                    CSS.highlights.set(highlightName, highlight);

                    // Create CSS rule
                    // We need to append or update style block. 
                    // Let's rely on a separate style update function or append here.

                    // Regex construction: case-insensitive, whole word
                    // escaped keywords
                    const pattern = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                    const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');

                    customRules.push({
                        regex,
                        highlightName,
                        color
                    });
                });
            }
            updateCustomRules();

            // Track which registry a range belongs to for cleanup
            const activeRanges = new Map(); // Map<Range, Highlight>

            // --- CSS Injection ---
            const style = document.createElement('style');

            function updateStyles() {
                let css = `
                    ::highlight(bolder-darken) {
                        background-color: ${currentSettings.bolderDarkenBg}; /* Darken tint for light backgrounds */
                        color: inherit;
                        text-decoration: none;
                    }
                    ::highlight(bolder-lighten) {
                        background-color: ${currentSettings.bolderLightenBg}; /* Lighten tint for dark backgrounds */
                        color: inherit;
                        text-decoration: none;
                    }
                `;

                customRules.forEach(rule => {
                    css += `
                        ::highlight(${rule.highlightName}) {
                            background-color: ${rule.color};
                            color: inherit;
                        }
                    `;
                });

                style.textContent = css;
            }
            updateStyles();
            function injectStyleElement() {
                if (document.head) {
                    document.head.appendChild(style);
                } else {
                    const headPoll = setInterval(() => {
                        if (document.head) {
                            clearInterval(headPoll);
                            document.head.appendChild(style);
                        }
                    }, 50);
                }
            }
            injectStyleElement();

            let wordCountCache = new WeakMap();
            let lightBgCache = new WeakMap();

            // --- Color Helpers ---
            function parseRgb(rgbStr) {
                const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                if (!match) return null;
                return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
            }

            function getLuminance(r, g, b) {
                // Relative luminance formula
                const a = [r, g, b].map(v => {
                    v /= 255;
                    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
                });
                return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
            }

            function getEffectiveBackgroundColor(element) {
                let current = element;
                while (current && current !== document) {
                    const style = window.getComputedStyle(current);
                    const bg = style.backgroundColor;
                    if (bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
                        return bg;
                    }
                    current = current.parentElement;
                }
                return 'rgb(255, 255, 255)'; // Default to white
            }

            function isLightBackground(element) {
                if (lightBgCache.has(element)) {
                    return lightBgCache.get(element);
                }

                const bgStr = getEffectiveBackgroundColor(element);
                const rgb = parseRgb(bgStr);
                let isLight = true;
                if (rgb) {
                    const lum = getLuminance(rgb.r, rgb.g, rgb.b);
                    isLight = lum > 0.5;
                }

                lightBgCache.set(element, isLight);
                return isLight;
            }

            // --- State Management ---
            let atSentenceStart = true;
            let lastBlockParent = null;
            const REGISTRY_MIN_LEN = 5;
            let cleanupIntervalId = null;
            let initialTraversalDone = false;
            const STARTUP_RETRY_MAX = 5;
            const STARTUP_RETRY_BASE_MS = 500;
            let startupRetryCount = 0;
            let startupRetryTimer = null;

            function resetTraversalState() {
                atSentenceStart = true;
                lastBlockParent = null;
            }

            // --- Registry Management ---
            let registry = new Set();
            let registryMaxSize = 1000;
            let registryStorageKey = null;
            let skippedCandidates = new Map(); // Map<word, Array<{node, offset, length}>>

            function parseRegistryConfig() {
                const hostname = window.location.hostname;
                const lines = currentSettings.registryConfig.split('\n');
                let matched = false;

                for (const line of lines) {
                    const parts = line.split(':');
                    if (parts.length < 2) continue;
                    const size = parseInt(parts[0].trim(), 10) || 1000;
                    const domains = parts[1].split(',').map(d => d.trim());

                    // Check if current hostname includes any of the specified domains
                    if (domains.some(d => hostname.includes(d))) {
                        registryMaxSize = size;
                        registryStorageKey = `bolder_registry_${hostname}`; // We use hostname for key to separate subdomains if needed, or we could use the matched domain?
                        // User requested per domain registry.
                        // If user configures "evren.io", and we obey, we should probably use "evren.io" as key part?
                        // But if multiple domains map to same key?
                        // "maxKeywordSize: domain1.com, domain2.com"
                        // This syntax usually implies separate limits/rules. 
                        // But if they share a line, do they share a registry? 
                        // "This per domain keyword registry..."
                        // Let's assume unique key per hostname for safety, OR unique key per matched config rule?
                        // "1000: *.*" -> one global registry.
                        // "1000: a.com, b.com" -> do they share?
                        // The user said: "This configuration can bi similar to "customHighlights" textbox... maxKeywordSize: domain1.com, domain2.com"
                        // If I use `hostname` as key, then `a.com` and `b.com` get separate keys: `bolder_registry_a.com` and `bolder_registry_b.com`.
                        // This seems correct for "per domain".

                        registryStorageKey = `bolder_registry_${hostname}`;
                        matched = true;
                        break;
                    }
                }

                if (!matched) {
                    // Check for global fallback *.*
                    for (const line of lines) {
                        if (line.includes('*.*')) {
                            const size = parseInt(line.split(':')[0].trim(), 10) || 1000;
                            registryMaxSize = size;
                            registryStorageKey = `bolder_registry_global`;
                            matched = true;
                            break;
                        }
                    }
                }
            }

            function processRetroactive(word) {
                // word comes from registry, so it is lowercase
                if (skippedCandidates.has(word)) {
                    const candidates = skippedCandidates.get(word);
                    candidates.forEach(cand => {
                        if (cand.node.isConnected) {
                            const range = new Range();
                            range.setStart(cand.node, cand.offset);
                            range.setEnd(cand.node, cand.offset + cand.length);

                            let candRegistry = highlightDarken;
                            if (cand.node.parentElement) {
                                if (isLightBackground(cand.node.parentElement)) candRegistry = highlightDarken;
                                else candRegistry = highlightLighten;
                            }
                            candRegistry.add(range);
                            activeRanges.set(range, candRegistry);
                        }
                    });
                    skippedCandidates.delete(word);
                }
            }

            function loadRegistry() {
                if (!registryStorageKey) return;
                storageGet(registryStorageKey).then(data => {
                    const list = data[registryStorageKey] || [];
                    // Merge loaded list into existing registry
                    list.forEach(word => {
                        const lowerWord = word.toLowerCase();

                        if (!registry.has(lowerWord)) {
                            registry.add(lowerWord);
                        }
                        // CRITICAL: Check if we skipped this word while waiting for load
                        // So we should iterate skippedCandidates? Or store skippedCandidates with lowercase keys?
                        // Storing lowercase keys seems 1:N mapping (one key "make" -> "Make", "MAKE").
                        // Let's change skippedCandidates to Map<lowercaseWord, Array<...>>
                        processRetroactive(lowerWord);
                    });

                    if (registry.size > registryMaxSize) {
                        const excess = registry.size - registryMaxSize;
                        const arr = Array.from(registry);
                        const keep = arr.slice(excess);
                        registry = new Set(keep);
                    }
                }).catch(err => console.error('Bolder: Registry load failed', err));
            }

            // Debounced save
            let saveTimeout;
            function saveRegistry() {
                if (!registryStorageKey) return;
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    const list = Array.from(registry);
                    let saveData = {};
                    saveData[registryStorageKey] = list;
                    browser.storage.local.set(saveData);
                }, 1000);
            }

            function addToRegistry(word) {
                if (!registryStorageKey) return;
                if (word.length < REGISTRY_MIN_LEN) return;
                const lowerWord = word.toLowerCase(); // Store lowercase for case-insensitive matching
                if (registry.has(lowerWord)) return;

                registry.add(lowerWord);
                if (registry.size > registryMaxSize) {
                    // Primitive FIFO: delete first item
                    const first = registry.values().next().value;
                    registry.delete(first);
                }
                saveRegistry();
            }

            parseRegistryConfig();
            loadRegistry();

            let debugWords = [];
            let debugWordsRegex = null;
            const DEBUG_SKIP_LOG_THROTTLE_MS = 3000;
            const debugSkipLogTimes = new WeakMap();

            function escapeRegExp(value) {
                return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            }

            function parseDebugWords(value) {
                if (!value) return [];
                return value
                    .split(/[,\n]/)
                    .map(word => word.trim().toLowerCase())
                    .filter(Boolean);
            }

            function updateDebugWords(value) {
                debugWords = parseDebugWords(value);
                if (!debugWords.length) {
                    debugWordsRegex = null;
                    return;
                }
                try {
                    debugWordsRegex = new RegExp(debugWords.map(escapeRegExp).join('|'), 'i');
                } catch (error) {
                    console.warn('Bolder: Failed to compile debug-word regex.', error);
                    debugWordsRegex = null;
                }
            }

            function shouldLogForText(matchText, force) {
                if (!currentSettings.debugLogging) return false;
                if (force) return true;
                if (!debugWords.length) return true;
                if (!matchText) return false;
                if (debugWordsRegex) {
                    return debugWordsRegex.test(matchText);
                }
                const haystack = matchText.toLowerCase();
                for (const word of debugWords) {
                    if (haystack.includes(word)) {
                        return true;
                    }
                }
                return false;
            }

            function shouldLogSkippedNode(textNode) {
                if (!currentSettings.debugLogging) return false;
                if (!shouldLogForText(textNode.nodeValue, false)) return false;
                const now = Date.now();
                const last = debugSkipLogTimes.get(textNode) || 0;
                if (now - last < DEBUG_SKIP_LOG_THROTTLE_MS) return false;
                debugSkipLogTimes.set(textNode, now);
                return true;
            }

            function debugLog(label, options) {
                const matchText = options && options.matchText ? options.matchText : '';
                const force = Boolean(options && options.force);
                if (!shouldLogForText(matchText, force)) return;

                if (options && typeof options.data === 'function') {
                    console.log(label, options.data());
                } else {
                    console.log(label);
                }
            }

            function summarizeText(text, maxLen = 120) {
                if (!text) return '';
                const normalized = text.replace(/\s+/g, ' ').trim();
                if (normalized.length <= maxLen) return normalized;
                return `${normalized.slice(0, maxLen)}…`;
            }

            function describeElement(el) {
                if (!el) return 'null';
                let desc = el.tagName || 'UNKNOWN';
                if (el.id) desc += `#${el.id}`;
                if (el.classList && el.classList.length) {
                    desc += `.${Array.from(el.classList).slice(0, 3).join('.')}`;
                }
                return desc;
            }

            updateDebugWords(currentSettings.debugWords);
            debugLog('Bolder: Debug logging enabled.', { force: true });


            // --- Helper Functions ---

            function isBlockElement(node) {
                return node.nodeType === Node.ELEMENT_NODE && CONFIG.blockTags.has(node.tagName);
            }

            function getBlockParent(node) {
                let current = node.parentElement;
                while (current) {
                    if (isBlockElement(current)) return current;
                    if (current === document.body) return current;
                    current = current.parentElement;
                }
                return document.body;
            }

            function getSkipReason(node) {
                let current = node.parentElement;
                while (current) {
                    if (CONFIG.excludedTags.has(current.tagName)) return 'excluded-tag';
                    if (current.isContentEditable) return 'contenteditable';
                    if (current.getAttribute('aria-hidden') === 'true') return 'aria-hidden';
                    if (current.style.display === 'none' || current.style.visibility === 'hidden' || current.style.opacity === '0') return 'hidden-style';
                    current = current.parentElement;
                }
                return null;
            }

            function shouldSkipNode(node) {
                return getSkipReason(node) !== null;
            }

            function hasVisibleText(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    return /[a-zA-Z]/.test(node.nodeValue);
                }
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (shouldSkipNode(node)) return false;
                    return node.innerText && /[a-zA-Z]/.test(node.innerText);
                }
                return false;
            }

            function isFirstWordInBlock(textNode, blockParent) {
                let current = textNode;
                while (current) {
                    if (current === blockParent) return true;

                    let sibling = current.previousSibling;
                    while (sibling) {
                        if (sibling.nodeName === 'BR') return true;
                        if (hasVisibleText(sibling)) return false;
                        sibling = sibling.previousSibling;
                    }

                    current = current.parentElement;
                    if (current === blockParent) return true;
                }
                return true;
            }

            function getWordCount(element) {
                if (wordCountCache.has(element)) {
                    return wordCountCache.get(element);
                }
                const text = element.innerText || '';
                const count = text.trim().split(/\s+/).length;
                wordCountCache.set(element, count);
                return count;
            }

            function shouldSkipAutoDetectForBlock(blockParent) {
                if (!currentSettings.skipShortMetadataLines) return false;

                const text = (blockParent.innerText || '').trim();
                if (!text) return false;

                const wordCount = getWordCount(blockParent);
                if (wordCount > CONFIG.shortMetadataMaxWords) return false;

                // If it looks like a sentence, keep auto-detect.
                if (/[.!?]/.test(text)) return false;

                // Metadata lines often use commas/parentheses (locations, tags).
                if (!/[,()]/.test(text)) return false;

                const tokens = text.split(/[^A-Za-z-]+/).filter(Boolean);
                if (tokens.length < 2) return false;

                let titleCaseCount = 0;
                tokens.forEach(token => {
                    if (/^[A-Z][a-z]/.test(token) || /^[A-Z]{2,}$/.test(token)) {
                        titleCaseCount += 1;
                    }
                });

                if (titleCaseCount / tokens.length < 0.6) return false;

                return true;
            }

            function isSentenceTerminator(token, tokens, i) {
                if (!CONFIG.terminators.has(token)) return false;

                if (token !== '.') {
                    return true;
                }

                // Check for common abbreviations to avoid resetting sentence start
                // e.g. (e . g .) -> look back 3
                if (i >= 3 && tokens[i - 1] === 'g' && tokens[i - 2] === '.' && tokens[i - 3] === 'e') return false;
                if (i >= 3 && tokens[i - 1] === 'e' && tokens[i - 2] === '.' && tokens[i - 3] === 'i') return false;
                // etc. vs. ex. (word .) -> look back 1
                if (i >= 1 && ['etc', 'vs', 'ex', 'approx'].includes(tokens[i - 1].toLowerCase())) return false;

                return true;
            }

            function normalizeToken(token) {
                if (!token) return null;
                const leadingMatch = token.match(/^[^A-Za-z]+/);
                const trailingMatch = token.match(/[^A-Za-z]+$/);
                const leadingTrim = leadingMatch ? leadingMatch[0].length : 0;
                const trailingTrim = trailingMatch ? trailingMatch[0].length : 0;
                const trimmed = token.slice(leadingTrim, token.length - trailingTrim);
                if (!trimmed) return null;
                const normalizedValue = trimmed.replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, '');
                if (!normalizedValue) return null;
                return {
                    value: trimmed,
                    normalizedValue,
                    offsetDelta: leadingTrim
                };
            }

            function updateSentenceStateFromText(text) {
                if (!text || !text.trim()) return;

                const tokens = text.split(/([.!?…:;]|\s+|[^a-zA-Z\-.!?…:;\s]+)/).filter(t => t);
                tokens.forEach((token, i) => {
                    if (isSentenceTerminator(token, tokens, i)) {
                        debugLog('Bolder: Excluded text contained sentence terminator', {
                            matchText: text,
                            data: () => ({
                                token,
                                text: summarizeText(text)
                            })
                        });
                        atSentenceStart = true;
                        return;
                    }

                    const normalized = normalizeToken(token);
                    if (!normalized || !/^[A-Za-z\-]+$/.test(normalized.normalizedValue)) {
                        return;
                    }

                    if (atSentenceStart) {
                        debugLog('Bolder: Excluded text consumed sentence start', {
                            matchText: text,
                            data: () => ({
                                token: normalized.normalizedValue,
                                text: summarizeText(text)
                            })
                        });
                        atSentenceStart = false;
                    }
                });
            }

            function handleSkippedTextNode(textNode, skipReason) {
                if (!skipReason) return false;

                if (skipReason === 'excluded-tag') {
                    // Preserve sentence boundaries across excluded tags (e.g., links),
                    // so sentence-start suppression remains accurate.
                    updateSentenceStateFromText(textNode.nodeValue);
                }

                if (shouldLogSkippedNode(textNode)) {
                    debugLog('Bolder: Skipping text node', {
                        matchText: textNode.nodeValue,
                        data: () => ({
                            reason: skipReason,
                            text: summarizeText(textNode.nodeValue)
                        })
                    });
                }

                return true;
            }

            function processTextNode(textNode) {
                if (!isEnabled) return; // Stop if disabled

                const skipReason = getSkipReason(textNode);
                if (handleSkippedTextNode(textNode, skipReason)) return;

                const text = textNode.nodeValue;
                if (!text.trim()) return;

                const blockParent = getBlockParent(textNode);
                if (blockParent !== lastBlockParent) {
                    debugLog('Bolder: Block parent changed', {
                        matchText: text,
                        data: () => ({
                            from: describeElement(lastBlockParent),
                            to: describeElement(blockParent),
                            text: summarizeText(blockParent.innerText)
                        })
                    });
                    atSentenceStart = true;
                    lastBlockParent = blockParent;
                }

                // Check word count of the block
                let minWords = CONFIG.minWordsInBlock;
                const bulletChars = new Set(['-', '–', '—', '•', '●', '*', '■']);
                const textContent = blockParent.innerText || '';
                const firstChar = textContent.trim()[0];

                if (blockParent.tagName === 'LI' || blockParent.tagName === 'TD' || bulletChars.has(firstChar)) {
                    minWords = 3;
                }

                const blockWordCount = getWordCount(blockParent);
                const nodeWordCount = text.trim().split(/\s+/).filter(Boolean).length;

                if (blockWordCount < minWords && nodeWordCount < minWords) {
                    return;
                }

                const skipAutoDetectForBlock = shouldSkipAutoDetectForBlock(blockParent);

                // Cleanup existing ranges for this node
                for (const [range, registry] of activeRanges) {
                    if (range.commonAncestorContainer === textNode) {
                        registry.delete(range);
                        activeRanges.delete(range);
                    }
                }

                // Determine highlight registry based on background
                let targetRegistry = highlightDarken; // Default
                if (textNode.parentElement) {
                    if (isLightBackground(textNode.parentElement)) {
                        targetRegistry = highlightDarken;
                    } else {
                        targetRegistry = highlightLighten;
                    }
                }

                // Apply Custom Highlights
                customRules.forEach(rule => {
                    let match;
                    rule.regex.lastIndex = 0; // Reset regex
                    while ((match = rule.regex.exec(text)) !== null) {
                        const range = new Range();
                        range.setStart(textNode, match.index);
                        range.setEnd(textNode, match.index + match[0].length);

                        const registry = CSS.highlights.get(rule.highlightName);
                        if (registry) {
                            registry.add(range);
                            activeRanges.set(range, registry);
                        }
                    }
                });

                if (currentSettings.disableAutoDetect || skipAutoDetectForBlock) {
                    return;
                }
                // console.log('Bolder: Auto-detect active.');

                // Tokenize
                const tokens = text.split(/([.!?…:;]|\s+|[^a-zA-Z\-.!?…:;\s]+)/).filter(t => t);
                // console.log('Bolder: Tokens:', tokens.slice(0, 5));

                let isBlockStartNode = isFirstWordInBlock(textNode, blockParent);
                debugLog('Bolder: Block-start check', {
                    matchText: text,
                    data: () => ({
                        block: describeElement(blockParent),
                        isBlockStartNode,
                        atSentenceStart,
                        nodeText: summarizeText(text)
                    })
                });
                let currentOffset = 0;

                // Debug logging for first few tokens
                // if (tokens.length > 0) {
                //     console.log(`Bolder: Processing ${tokens.length} tokens. First: "${tokens[0]}", SentenceStart: ${atSentenceStart}`);
                // }

                function isRegistryStartCandidate(token) {
                    // Avoid highlighting plain Capitalized words at sentence/block start,
                    // which are often just sentence case.
                    return RE_UPPERCASE.test(token) || RE_MIXED_CASE.test(token) || RE_HYPHENATED.test(token);
                }

                tokens.forEach((token, i) => {
                    if (isSentenceTerminator(token, tokens, i)) {
                        debugLog('Bolder: Sentence terminator found', {
                            matchText: token,
                            data: () => ({
                                token,
                                block: describeElement(blockParent),
                                nodeText: summarizeText(text)
                            })
                        });
                        atSentenceStart = true;
                        isBlockStartNode = false;
                        currentOffset += token.length;
                        return;
                    }

                    const normalized = normalizeToken(token);
                    if (!normalized || !/^[A-Za-z\-]+$/.test(normalized.normalizedValue)) {
                        currentOffset += token.length;
                        return;
                    }

                    const tokenValue = normalized.normalizedValue;
                    const tokenOffset = currentOffset + normalized.offsetDelta;
                    const tokenLength = normalized.value.length;

                    const isBlockStart = isBlockStartNode;
                    if (isBlockStart) {
                        isBlockStartNode = false;
                    }

                    const isSentenceStart = atSentenceStart;
                    if (isSentenceStart) {
                        atSentenceStart = false;
                    }

                    let shouldBold = false;
                    const isAllCaps = RE_UPPERCASE.test(tokenValue);
                    const isAutoDetectCandidate = isAllCaps || RE_CAPITALIZED.test(tokenValue) || RE_MIXED_CASE.test(tokenValue) || RE_HYPHENATED.test(tokenValue);

                    if (!isBlockStart && !isSentenceStart) {
                        if (isAutoDetectCandidate) {
                            shouldBold = true;
                        }
                    } else if (isAllCaps) {
                        // Allow all-caps acronyms even at sentence/block start.
                        shouldBold = true;
                    }

                    if (isAutoDetectCandidate || isAllCaps) {
                        debugLog('Bolder: Token decision', {
                            matchText: tokenValue,
                            data: () => ({
                                token: tokenValue,
                                shouldBold,
                                isBlockStart,
                                isSentenceStart,
                                isAllCaps,
                                block: describeElement(blockParent),
                                nodeText: summarizeText(text)
                            })
                        });
                    }

                    if (shouldBold) {
                        const range = new Range();
                        range.setStart(textNode, tokenOffset);
                        range.setEnd(textNode, tokenOffset + tokenLength);
                        targetRegistry.add(range);
                        activeRanges.set(range, targetRegistry);

                        // If it's a valid keyword (long enough etc), add to registry for future start-of-sentence highlighting
                        // We use the same regex/logic as the check "shouldBold" used.
                        // Assuming shouldBold implies it met the criteria.
                        addToRegistry(tokenValue);

                        // Retroactive: Check if we skipped this word earlier
                        // processRetroactive expects lowercase key
                        processRetroactive(tokenValue.toLowerCase());
                    } else if (isSentenceStart || isBlockStart) {
                        // Check if it's in registry
                        const lowerToken = tokenValue.toLowerCase();
                        if (tokenValue.length >= REGISTRY_MIN_LEN && registry.has(lowerToken) && isRegistryStartCandidate(tokenValue)) {
                            const range = new Range();
                            range.setStart(textNode, tokenOffset);
                            range.setEnd(textNode, tokenOffset + tokenLength);
                            targetRegistry.add(range);
                            activeRanges.set(range, targetRegistry);
                        } else {
                            // Candidate for retroactive highlighting
                            // Only if it *would* be highlighted if it wasn't at start
                            // Re-check criteria (uppercase, capitalized etc)
                            if (RE_UPPERCASE.test(tokenValue) || RE_CAPITALIZED.test(tokenValue) || RE_MIXED_CASE.test(tokenValue) || RE_HYPHENATED.test(tokenValue)) {
                                if (tokenValue.length >= REGISTRY_MIN_LEN) {
                                    const lowerToken = tokenValue.toLowerCase();
                                    if (!skippedCandidates.has(lowerToken)) {
                                        skippedCandidates.set(lowerToken, []);
                                    }
                                    skippedCandidates.get(lowerToken).push({
                                        node: textNode,
                                        offset: tokenOffset,
                                        length: tokenLength
                                    });
                                }
                            }
                        }
                    } else {
                        // Automatic Highlight Logic
                        if (RE_UPPERCASE.test(token)) {
                            // Match found
                        } else if (RE_CAPITALIZED.test(token)) {
                            // Match found
                        }
                    }

                    currentOffset += token.length;
                });
            }

            // --- Traversal ---
            const PROCESS_BUDGET_MS = 8;
            const MAX_NODES_PER_CHUNK = 300;
            const MUTATION_WINDOW_MS = 500;
            const MUTATION_THRESHOLD = 120;
            const MUTATION_PAUSE_MS = 700;
            const pendingTasks = [];
            const pendingTextNodeSet = new Set();
            let flushScheduled = false;
            let flushHandle = null;
            let flushHandleType = null;
            let pendingCleanup = false;
            let pauseUntil = 0;
            let resumeTimer = null;
            let needsRescan = false;
            let mutationWindowStart = 0;
            let mutationCount = 0;

            function clearQueues() {
                pendingTasks.length = 0;
                pendingTextNodeSet.clear();
                pendingCleanup = false;
                if (flushScheduled) {
                    if (flushHandleType === 'idle' && typeof window.cancelIdleCallback === 'function') {
                        window.cancelIdleCallback(flushHandle);
                    } else if (flushHandleType === 'timeout') {
                        clearTimeout(flushHandle);
                    }
                    flushScheduled = false;
                    flushHandle = null;
                    flushHandleType = null;
                }
            }

            function isPaused() {
                return Date.now() < pauseUntil;
            }

            function scheduleResume() {
                if (resumeTimer) return;
                const delay = Math.max(0, pauseUntil - Date.now());
                resumeTimer = setTimeout(() => {
                    resumeTimer = null;
                    if (!isEnabled) return;
                    if (isPaused()) {
                        scheduleResume();
                        return;
                    }
                    if (needsRescan && document.body) {
                        needsRescan = false;
                        traverse(document.body);
                    }
                }, delay);
            }

            function enterPause() {
                if (isPaused()) return;
                pauseUntil = Date.now() + MUTATION_PAUSE_MS;
                needsRescan = true;
                clearQueues();
                scheduleResume();
                debugLog('Bolder: Mutation storm detected; pausing processing.', { force: true });
            }

            function registerMutations(count) {
                if (!initialTraversalDone) return;
                const now = Date.now();
                if (now - mutationWindowStart > MUTATION_WINDOW_MS) {
                    mutationWindowStart = now;
                    mutationCount = 0;
                }
                mutationCount += count;
                if (mutationCount >= MUTATION_THRESHOLD) {
                    mutationCount = 0;
                    mutationWindowStart = now;
                    enterPause();
                }
            }

            function getTimeRemaining(deadline) {
                if (deadline && typeof deadline.timeRemaining === 'function') {
                    return deadline.timeRemaining();
                }
                return PROCESS_BUDGET_MS;
            }

            function scheduleFlush() {
                if (flushScheduled || !isEnabled || isPaused()) return;
                flushScheduled = true;
                if (typeof window.requestIdleCallback === 'function') {
                    flushHandleType = 'idle';
                    flushHandle = window.requestIdleCallback(processQueue, { timeout: 200 });
                } else {
                    flushHandleType = 'timeout';
                    flushHandle = setTimeout(() => processQueue(), 0);
                }
            }

            function enqueueTextNode(node) {
                if (!node || node.nodeType !== Node.TEXT_NODE) return;
                if (pendingTextNodeSet.has(node)) return;
                if (isPaused()) {
                    needsRescan = true;
                    scheduleResume();
                    return;
                }
                pendingTextNodeSet.add(node);
                pendingTasks.push({ type: 'text', node });
                scheduleFlush();
            }

            function enqueueRoot(root) {
                if (!isEnabled || !root) return;
                if (isPaused()) {
                    needsRescan = true;
                    scheduleResume();
                    return;
                }
                const walker = document.createTreeWalker(
                    root,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                pendingTasks.push({ type: 'walker', walker });
                scheduleFlush();
            }

            function processQueue(deadline) {
                flushScheduled = false;
                flushHandle = null;
                flushHandleType = null;

                if (!isEnabled) {
                    clearQueues();
                    return;
                }
                if (isPaused()) {
                    scheduleResume();
                    return;
                }

                let processed = 0;
                while (processed < MAX_NODES_PER_CHUNK && getTimeRemaining(deadline) > 1) {
                    const task = pendingTasks[0];
                    if (!task) break;

                    if (task.type === 'text') {
                        pendingTasks.shift();
                        pendingTextNodeSet.delete(task.node);
                        if (task.node && task.node.isConnected) {
                            processTextNode(task.node);
                        }
                        processed += 1;
                        continue;
                    }

                    if (task.type === 'walker') {
                        const nextNode = task.walker.nextNode();
                        if (!nextNode) {
                            pendingTasks.shift();
                            continue;
                        }
                        if (nextNode.isConnected) {
                            processTextNode(nextNode);
                        }
                        processed += 1;
                        continue;
                    }

                    pendingTasks.shift();
                }

                if (pendingCleanup && getTimeRemaining(deadline) > 1) {
                    pendingCleanup = false;
                    for (const [range, registry] of activeRanges) {
                        if (!range.commonAncestorContainer.isConnected || range.commonAncestorContainer.nodeType !== Node.TEXT_NODE) {
                            registry.delete(range);
                            activeRanges.delete(range);
                        }
                    }
                }

                if (pendingTasks.length > 0 || pendingCleanup) {
                    scheduleFlush();
                } else if (!initialTraversalDone) {
                    initialTraversalDone = true;
                    console.log('Bolder: Initial traversal completed.');
                    scheduleStartupCheck();
                }
            }

            function requestCleanup() {
                pendingCleanup = true;
                scheduleFlush();
            }

            function traverse(root) {
                enqueueRoot(root);
            }

            // --- Cleanup ---
            function cleanupHighlights() {
                clearQueues();
                if (highlightDarken && typeof highlightDarken.clear === 'function') {
                    highlightDarken.clear();
                }
                if (highlightLighten && typeof highlightLighten.clear === 'function') {
                    highlightLighten.clear();
                }
                customRules.forEach(rule => {
                    const registry = CSS.highlights.get(rule.highlightName);
                    if (registry && typeof registry.clear === 'function') {
                        registry.clear();
                    }
                });
                activeRanges.clear();
                wordCountCache = new WeakMap();
                lightBgCache = new WeakMap();
            }

            function ensureCleanupInterval() {
                if (cleanupIntervalId !== null) return;
                cleanupIntervalId = setInterval(() => {
                    if (!isEnabled) return;
                    for (const [range, registry] of activeRanges) {
                        if (!range.commonAncestorContainer.isConnected || range.commonAncestorContainer.nodeType !== Node.TEXT_NODE) {
                            registry.delete(range);
                            activeRanges.delete(range);
                        }
                    }
                }, 5000);
            }

            let observedRoot = null;
            let bodyWaitObserver = null;

            function attachToRoot(root) {
                if (!root) return false;
                if (observedRoot !== root) {
                    console.log('Bolder: Attaching to new root node.');
                    cleanupHighlights();
                    resetTraversalState();
                    observedRoot = root;
                }
                observer.disconnect();
                observer.observe(root, { childList: true, subtree: true, characterData: true });
                return true;
            }

            function ensureBodyAvailable() {
                if (document.body) return true;
                console.log('Bolder: document.body not ready. Waiting for body before first traverse.');
                if (!bodyWaitObserver) {
                    bodyWaitObserver = new MutationObserver(() => {
                        if (document.body && observedRoot !== document.body) {
                            console.log('Bolder: document.body detected via mutation observer.');
                            bodyWaitObserver.disconnect();
                            bodyWaitObserver = null;
                            if (isEnabled) {
                                attachToRoot(document.body);
                                traverse(document.body);
                                ensureCleanupInterval();
                            }
                        }
                    });
                    bodyWaitObserver.observe(document.documentElement, { childList: true });
                }
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => {
                        if (document.body && observedRoot !== document.body && isEnabled) {
                            console.log('Bolder: document.body detected on DOMContentLoaded.');
                            attachToRoot(document.body);
                            traverse(document.body);
                            ensureCleanupInterval();
                        }
                    }, { once: true });
                }
                const BODY_POLL_INTERVAL_MS = 100;
                const BODY_POLL_MAX_ATTEMPTS = 50;
                let bodyPollCount = 0;
                const bodyPollTimer = setInterval(() => {
                    bodyPollCount += 1;
                    if (document.body && isEnabled && observedRoot !== document.body) {
                        clearInterval(bodyPollTimer);
                        console.log('Bolder: document.body detected via polling.');
                        if (bodyWaitObserver) {
                            bodyWaitObserver.disconnect();
                            bodyWaitObserver = null;
                        }
                        attachToRoot(document.body);
                        traverse(document.body);
                        ensureCleanupInterval();
                    } else if (bodyPollCount >= BODY_POLL_MAX_ATTEMPTS) {
                        clearInterval(bodyPollTimer);
                    }
                }, BODY_POLL_INTERVAL_MS);
                return false;
            }

            function applyEnabledState(newEnabled) {
                if (newEnabled === isEnabled) return false;
                isEnabled = newEnabled;
                resetTraversalState();
                pauseUntil = 0;
                needsRescan = false;
                if (resumeTimer) {
                    clearTimeout(resumeTimer);
                    resumeTimer = null;
                }
                if (isEnabled) {
                    console.log('Bolder: Enabled by settings change.');
                    if (ensureBodyAvailable()) {
                        attachToRoot(document.body);
                        traverse(document.body);
                        ensureCleanupInterval();
                    }
                } else {
                    console.log('Bolder: Disabled by settings change.');
                    cleanupHighlights();
                    observer.disconnect();
                }
                return true;
            }

            // --- MutationObserver ---
            const observer = new MutationObserver((mutations) => {
                if (!isEnabled) return;
                registerMutations(mutations.length);
                if (isPaused()) return;
                let shouldCleanup = false;
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        if (mutation.removedNodes.length > 0) {
                            shouldCleanup = true;
                        }
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                traverse(node);
                            } else if (node.nodeType === Node.TEXT_NODE) {
                                const skipReason = getSkipReason(node);
                                if (!handleSkippedTextNode(node, skipReason)) {
                                    enqueueTextNode(node);
                                }
                            }
                        });
                    } else if (mutation.type === 'characterData') {
                        const skipReason = getSkipReason(mutation.target);
                        if (!handleSkippedTextNode(mutation.target, skipReason)) {
                            enqueueTextNode(mutation.target);
                        }
                    }
                });

                if (shouldCleanup) {
                    requestCleanup();
                }
            });

            const bodySwapObserver = new MutationObserver(() => {
                if (!isEnabled) return;
                if (!document.body) return;
                if (observedRoot !== document.body) {
                    console.log('Bolder: document.body replaced. Reattaching observers.');
                    attachToRoot(document.body);
                    traverse(document.body);
                    ensureCleanupInterval();
                }
            });
            bodySwapObserver.observe(document.documentElement, { childList: true });

            function hasPageText() {
                if (!document.body) return false;
                const text = (document.body.innerText || '').trim();
                return text.length > 100;
            }

            function scheduleStartupCheck() {
                if (startupRetryTimer) return;
                if (startupRetryCount >= STARTUP_RETRY_MAX) return;
                const delay = STARTUP_RETRY_BASE_MS * Math.pow(2, startupRetryCount);
                startupRetryTimer = setTimeout(() => {
                    startupRetryTimer = null;
                    if (!isEnabled) return;
                    if (activeRanges.size > 0) {
                        console.log('Bolder: Startup verified — highlights active.');
                        return;
                    }
                    if (!hasPageText()) {
                        console.log('Bolder: Startup check — page has no significant text yet, skipping retry.');
                        return;
                    }
                    startupRetryCount += 1;
                    console.log(`Bolder: Startup retry #${startupRetryCount} — no highlights found, re-traversing.`);
                    initialTraversalDone = false;
                    cleanupHighlights();
                    resetTraversalState();
                    if (document.body) {
                        attachToRoot(document.body);
                        traverse(document.body);
                    }
                }, delay);
            }

            // Start logic
            isEnabled = checkEnabled(currentSettings);
            if (isEnabled) {
                resetTraversalState();
                if (ensureBodyAvailable()) {
                    attachToRoot(document.body);
                    traverse(document.body);
                    ensureCleanupInterval();
                }
            } else {
                console.log('Bolder: Disabled on this site by settings.');
            }

            // Listen for changes
            browser.storage.onChanged.addListener((changes, area) => {
                try {
                    if (area === 'local') {
                        let needsTraverse = false;
                        let needsCleanup = false;

                        // 1. Update Settings
                        if (changes.defaultEnabled) currentSettings.defaultEnabled = changes.defaultEnabled.newValue;
                        if (changes.siteList) currentSettings.siteList = changes.siteList.newValue;

                        if (changes.minWordsInBlock) {
                            currentSettings.minWordsInBlock = changes.minWordsInBlock.newValue;
                            CONFIG.minWordsInBlock = currentSettings.minWordsInBlock;
                            if (isEnabled) {
                                console.log('Bolder: minWordsInBlock changed, re-evaluating...');
                                needsCleanup = true;
                                needsTraverse = true;
                            }
                        }

                        if (changes.bolderDarkenBg) currentSettings.bolderDarkenBg = changes.bolderDarkenBg.newValue;
                        if (changes.bolderLightenBg) currentSettings.bolderLightenBg = changes.bolderLightenBg.newValue;
                        if (changes.bolderDarkenBg || changes.bolderLightenBg) {
                            updateStyles();
                        }

                        if (changes.customHighlights) {
                            currentSettings.customHighlights = changes.customHighlights.newValue;
                            updateCustomRules();
                            updateStyles();
                            needsCleanup = true;
                            needsTraverse = true;
                        }

                        if (changes.registryConfig) {
                            currentSettings.registryConfig = changes.registryConfig.newValue;
                            parseRegistryConfig();
                            loadRegistry();
                            needsCleanup = true;
                            needsTraverse = true;
                        }

                        if (changes.excludedTagsConfig) {
                            currentSettings.excludedTagsConfig = changes.excludedTagsConfig.newValue;
                            parseExcludedTagsConfig();
                            needsCleanup = true;
                            needsTraverse = true;
                        }

                        if (changes.disableAutoDetect) {
                            currentSettings.disableAutoDetect = changes.disableAutoDetect.newValue;
                            needsCleanup = true;
                            needsTraverse = true;
                        }

                        if (changes.skipShortMetadataLines) {
                            currentSettings.skipShortMetadataLines = changes.skipShortMetadataLines.newValue;
                            needsCleanup = true;
                            needsTraverse = true;
                        }

                        if (changes.debugLogging) {
                            currentSettings.debugLogging = changes.debugLogging.newValue;
                            debugLog('Bolder: Debug logging enabled.');
                        }

                        if (changes.debugWords) {
                            currentSettings.debugWords = changes.debugWords.newValue;
                            updateDebugWords(currentSettings.debugWords);
                        }

                        // 2. Handle Enable/Disable State
                        const newEnabled = checkEnabled(currentSettings);
                        if (applyEnabledState(newEnabled)) {
                            needsCleanup = false;
                            needsTraverse = false;
                        }

                        // 3. Apply updates if needed and still enabled
                        if (isEnabled) {
                            if (needsCleanup) cleanupHighlights();
                            if (needsTraverse) traverse(document.body);
                        }
                    }
                } catch (e) {
                    console.error('Bolder: Error in storage listener', e);
                }
            });

            browser.runtime.onMessage.addListener((message) => {
                try {
                    if (!message || message.type !== 'bolder-site-enabled-changed') return;
                    if (typeof message.enabled !== 'boolean') return;
                    applyEnabledState(message.enabled);
                } catch (e) {
                    console.error('Bolder: Error handling message', e);
                }
            });

        } catch (e) {
            console.error('Bolder: Fatal error initializing script:', e);
        }
    }

    let currentSettings = defaultSettings;

    if (typeof browser !== 'undefined' && browser.storage) {

        storageGet(defaultSettings).then((result) => {

            currentSettings = result || defaultSettings; // Handle undefined result
            init();
        }).catch(err => {
            console.error('Bolder: Storage failed:', err);
            // Fallback to init anyway?
            init();
        });
    } else {
        // Fallback for testing without extension context if needed, or just fail gracefully
        console.warn('Bolder: browser.storage not available, using defaults.');
        init();
    }
})();
