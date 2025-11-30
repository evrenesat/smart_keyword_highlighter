# Walkthrough - Dynamic Highlighting (Overlay Approach)

I have updated `bolder.user.js` to use a robust "overlay" approach for highlighting, ensuring compatibility with Firefox's CSS Highlight API.

## Changes

1.  **Overlay Approach**: Instead of calculating specific colors and using CSS variables (which had compatibility issues in `::highlight`), the script now uses two static highlight registries:
    -   `bolder-darken`: Applies a semi-transparent black background (`rgba(0, 0, 0, 0.1)`).
    -   `bolder-lighten`: Applies a semi-transparent white background (`rgba(255, 255, 255, 0.25)`).
2.  **Background Color Detection**: The script still detects the effective background color of the text's container.
3.  **Dynamic Selection**:
    -   If the background is **Light** (luminance > 0.5), it uses the `bolder-darken` highlight (creating a subtle dark tint).
    -   If the background is **Dark** (luminance <= 0.5), it uses the `bolder-lighten` highlight (creating a subtle light tint).
4.  **Performance**: This approach is more performant as it avoids setting inline styles on every element.

## Testing

I created `debug_colors_overlay.html` to verify this specific logic.
-   **Light Section**: Should show a darkened highlight.
-   **Dark Section**: Should show a lightened highlight.

To test:
1.  Open `test_colors.html` (or `debug_colors_overlay.html`) in Firefox with the userscript enabled.
2.  Verify that "IMPORTANT" words are highlighted appropriately against their background.

## Files
-   `bolder.user.js`: Updated userscript.
-   `test_colors.html`: Original test case (still valid).
-   `debug_colors_overlay.html`: Debug file for the overlay approach.
