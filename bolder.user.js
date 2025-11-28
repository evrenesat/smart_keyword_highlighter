// ==UserScript==
// @name         Bolder
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Bolds uppercase and capitalized words, excluding sentence starts and block starts.
// @author       You
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // --- Configuration ---
    const CONFIG = {
        minUppercaseLen: 2,
        minCapitalizedLen: 3,
        terminators: new Set(['.', '!', '?', '…']),
        blockTags: new Set([
            'DIV', 'P', 'LI', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
            'HEADER', 'FOOTER', 'SECTION', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'FIGCAPTION'
        ]),
        excludedTags: new Set([
            'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
            'CODE', 'PRE', 'IFRAME', 'SVG', 'CANVAS', 'KBD', 'VAR', 'B-B'
        ]),
        excludedAttrs: ['contenteditable']
    };

    // --- Regex ---
    // Uppercase: All caps, length >= 2. e.g. NASA
    const RE_UPPERCASE = new RegExp(`^\\b[A-Z]{${CONFIG.minUppercaseLen},}\\b$`);
    // Capitalized: First cap, rest lower, length >= 3. e.g. Python
    const RE_CAPITALIZED = new RegExp(`^\\b[A-Z][a-z]{${CONFIG.minCapitalizedLen - 1},}\\b$`);

    // --- State Management ---
    let atSentenceStart = true;

    // --- CSS Injection ---
    const style = document.createElement('style');
    style.textContent = `
        b-b {
            font-weight: 700 !important;
            color: inherit;
        }
    `;
    document.head.appendChild(style);

    // --- Helper Functions ---

    function isBlockElement(node) {
        return node.nodeType === Node.ELEMENT_NODE && CONFIG.blockTags.has(node.tagName);
    }

    function getBlockParent(node) {
        let current = node.parentElement;
        while (current) {
            if (isBlockElement(current)) return current;
            if (current === document.body) return current; // Fallback
            current = current.parentElement;
        }
        return document.body;
    }

    function shouldSkipNode(node) {
        let current = node.parentElement;
        while (current) {
            if (CONFIG.excludedTags.has(current.tagName)) return true;
            if (current.isContentEditable) return true;
            if (current.getAttribute('aria-hidden') === 'true') return true;
            // Check visibility (simplified)
            if (current.style.display === 'none' || current.style.visibility === 'hidden' || current.style.opacity === '0') return true;
            current = current.parentElement;
        }
        return false;
    }

    function hasVisibleText(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.nodeValue.trim().length > 0;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (shouldSkipNode(node)) return false;
            // Use innerText to respect visibility, but be careful of performance.
            // For a userscript, correctness is key.
            return node.innerText && node.innerText.trim().length > 0;
        }
        return false;
    }

    function isFirstWordInBlock(textNode, blockParent) {
        // Walk backwards from textNode until we hit blockParent start or find visible text.
        let current = textNode;
        while (current) {
            if (current === blockParent) return true; // Should not happen if we start from child

            // Check previous sibling
            let sibling = current.previousSibling;
            while (sibling) {
                if (hasVisibleText(sibling)) return false;
                sibling = sibling.previousSibling;
            }

            // Move up to parent
            current = current.parentElement;
            if (current === blockParent) return true;
            // If we moved up, we already checked left siblings of the child.
            // Now we need to check left siblings of the parent.
        }
        return true;
    }

    function processTextNode(textNode) {
        if (shouldSkipNode(textNode)) return;

        const text = textNode.nodeValue;
        if (!text.trim()) return; // Skip pure whitespace

        const blockParent = getBlockParent(textNode);

        const tokens = text.split(/([.!?…]|\s+|[^a-zA-Z.!?…\s]+)/).filter(t => t);

        const fragment = document.createDocumentFragment();
        let modified = false;

        // Determine if this node starts the block
        let isBlockStartNode = isFirstWordInBlock(textNode, blockParent);

        tokens.forEach(token => {
            // Check if token is a terminator
            if (CONFIG.terminators.has(token)) {
                atSentenceStart = true;
                fragment.appendChild(document.createTextNode(token));
                isBlockStartNode = false; // Subsequent tokens are not block start
                return;
            }

            // Check if token is whitespace or other non-word
            if (!/^[a-zA-Z]+$/.test(token)) {
                fragment.appendChild(document.createTextNode(token));
                return;
            }

            // It's a word
            const isBlockStart = isBlockStartNode;
            if (isBlockStart) {
                isBlockStartNode = false; // Only the first word is block start
            }

            const isSentenceStart = atSentenceStart;
            if (isSentenceStart) {
                atSentenceStart = false;
            }

            // Decision Logic
            let shouldBold = false;
            if (!isBlockStart && !isSentenceStart) {
                if (RE_UPPERCASE.test(token) || RE_CAPITALIZED.test(token)) {
                    shouldBold = true;
                }
            }

            if (shouldBold) {
                const b = document.createElement('b-b');
                b.textContent = token;
                fragment.appendChild(b);
                modified = true;
            } else {
                fragment.appendChild(document.createTextNode(token));
            }
        });

        if (modified) {
            textNode.replaceWith(fragment);
        }
    }

    // --- Traversal ---
    function traverse(root) {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const nodes = [];
        let node;
        while ((node = walker.nextNode())) {
            nodes.push(node);
        }

        nodes.forEach(processTextNode);
    }

    // --- Initialization ---
    // Initial run
    traverse(document.body);

    // --- MutationObserver ---
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    traverse(node);
                } else if (node.nodeType === Node.TEXT_NODE) {
                    processTextNode(node);
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
