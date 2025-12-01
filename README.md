# Keyword Highlighter

**Keyword Highlighter** is a browser extension that improves reading focus by automatically highlighting uppercase and capitalized words on web pages.

## Features

*   **Smart Highlighting**: Automatically detects and highlights:
    *   Uppercase words (e.g., "IMPORTANT")
    *   Capitalized words (e.g., "Keyword")
    *   Mixed case and hyphenated words
*   **CSS Custom Highlight API**: Uses the modern CSS Custom Highlight API for high performance and native-feeling highlights without cluttering the DOM.
*   **Adaptive Contrast**: Intelligently adjusts highlight colors based on the background color (light or dark) to ensure readability.
*   **Smart Exclusions**:
    *   Ignores sentence starters to prevent over-highlighting.
    *   Skips specific tags like scripts, styles, inputs, and code blocks.
    *   Respects `contenteditable` elements.
*   **Customizable**:
    *   Toggle extension on/off globally or per-site.
    *   Manage site exclusions/inclusions via the options page.
    *   **Advanced Settings**:
        *   **Minimum Words in Block**: Configure the minimum word count for a block to be highlighted (default: 10).
        *   **Custom Colors**: Adjust the background highlight colors and opacity for both light and dark modes.

## Configuration

You can access the configuration page by right-clicking the extension icon and selecting **Options**, or via the extension management page.

### Options
*   **Enable by default**: Choose whether the extension runs on all sites (except excluded ones) or only on specific sites.
*   **Site List**: A list of domains to exclude (if enabled by default) or include (if disabled by default).
*   **Advanced Settings**:
    *   **Minimum Words in Block**: Prevents highlighting on short snippets of text (e.g., navigation menus, buttons) by setting a minimum word threshold.
    *   **Darken Background Color**: Sets the highlight color for text on light backgrounds. Use the color picker and opacity slider to customize.
    *   **Lighten Background Color**: Sets the highlight color for text on dark backgrounds. Use the color picker and opacity slider to customize.

## Installation

### Chrome (Developer Mode)

1.  Clone or download this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the `keyword_highlighter` directory (the folder containing `manifest.json`).

### Firefox (Temporary Add-on)

1.  Clone or download this repository.
2.  Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3.  Click **Load Temporary Add-on...**.
4.  Select the `manifest.json` file (or any file in the extension directory).
    *   *Note: For Firefox development, you may need to use `manifest.firefox.json`. See Development section.*

## Development

### Prerequisites

*   [Node.js](https://nodejs.org/) and npm

### Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

### Build

To build the project (if applicable for future steps, currently scripts are direct):
```bash
npm run build
```

### Running in Development

**Chrome:**
This command launches a fresh Chrome instance with the extension loaded:
```bash
npm run dev:chrome
```

**Firefox:**
This command prepares the manifest for Firefox and runs it using `web-ext`:
```bash
npm run dev:firefox
```

## License

MIT
