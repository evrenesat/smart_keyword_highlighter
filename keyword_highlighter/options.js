const DEFAULT_EXCLUDED_TAGS_CONFIG = `*.*: SCRIPT, STYLE, NOSCRIPT, TEXTAREA, INPUT, SELECT, OPTION, CODE, PRE, IFRAME, SVG, CANVAS, KBD, VAR, A`;

const defaultSettings = {
    defaultEnabled: true,
    siteList: [],
    minWordsInBlock: 10,
    bolderDarkenBg: 'rgba(0, 0, 0, 0.1)',
    bolderLightenBg: 'rgba(255, 255, 255, 0.25)',
    customHighlights: '',
    disableAutoDetect: false,
    registryConfig: '1000: *.*',
    skipShortMetadataLines: false
};

function rgbaToHexOpacity(rgba) {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return { hex: '#000000', opacity: 1 };

    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    const opacity = match[4] !== undefined ? parseFloat(match[4]) : 1;

    return { hex: `#${r}${g}${b}`, opacity };
}

function hexOpacityToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function updateColorDisplay(prefix) {
    const opacity = document.getElementById(`${prefix}Opacity`).value;
    const color = document.getElementById(`${prefix}Color`).value;
    document.getElementById(`${prefix}OpacityVal`).textContent = opacity;
    document.getElementById(`${prefix}Hex`).textContent = color;
}

function saveOptions() {
    const defaultEnabled = document.getElementById('defaultEnabled').checked;
    const siteListRaw = document.getElementById('siteList').value;
    const siteList = siteListRaw.split('\n').map(s => s.trim()).filter(s => s);
    const minWordsInBlock = parseInt(document.getElementById('minWordsInBlock').value, 10);

    const bolderDarkenBg = hexOpacityToRgba(
        document.getElementById('bolderDarkenColor').value,
        document.getElementById('bolderDarkenOpacity').value
    );
    const bolderLightenBg = hexOpacityToRgba(
        document.getElementById('bolderLightenColor').value,
        document.getElementById('bolderLightenOpacity').value
    );

    const excludedTagsInput = document.getElementById('excludedTagsConfig').value;

    // Validation
    if (!excludedTagsInput.includes('*.*')) {
        const confirmed = confirm('Warning: Your excluded tags configuration is missing the global wildcard (*.*). This might cause unexpected behavior on undefined sites. Are you sure you want to save?');
        if (!confirmed) {
            return; // Abort save
        }
    }

    const customHighlights = document.getElementById('customHighlights').value;
    const registryConfig = document.getElementById('registryConfig').value;
    const disableAutoDetect = document.getElementById('disableAutoDetect').checked;
    const skipShortMetadataLines = document.getElementById('skipShortMetadataLines').checked;

    browser.storage.local.set({
        defaultEnabled,
        siteList,
        minWordsInBlock,
        bolderDarkenBg,
        bolderLightenBg,
        customHighlights,
        disableAutoDetect,
        registryConfig,
        excludedTagsConfig: excludedTagsInput,
        skipShortMetadataLines
    }).then(() => {
        const status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(() => {
            status.textContent = '';
        }, 750);
    });
}

function restoreOptions() {
    browser.storage.local.get(defaultSettings).then((result) => {
        document.getElementById('defaultEnabled').checked = result.defaultEnabled || false;
        document.getElementById('siteList').value = result.siteList.join('\n');
        document.getElementById('minWordsInBlock').value = result.minWordsInBlock;
        document.getElementById('customHighlights').value = result.customHighlights || '';
        document.getElementById('disableAutoDetect').checked = result.disableAutoDetect || false;
        document.getElementById('registryConfig').value = result.registryConfig || '1000: *.*';
        document.getElementById('excludedTagsConfig').value = result.excludedTagsConfig || DEFAULT_EXCLUDED_TAGS_CONFIG;
        document.getElementById('skipShortMetadataLines').checked = result.skipShortMetadataLines || false;

        const darken = rgbaToHexOpacity(result.bolderDarkenBg);
        document.getElementById('bolderDarkenColor').value = darken.hex;
        document.getElementById('bolderDarkenOpacity').value = darken.opacity;
        updateColorDisplay('bolderDarken');

        const lighten = rgbaToHexOpacity(result.bolderLightenBg);
        document.getElementById('bolderLightenColor').value = lighten.hex;
        document.getElementById('bolderLightenOpacity').value = lighten.opacity;
        updateColorDisplay('bolderLighten');
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('defaultEnabled').addEventListener('change', saveOptions);
document.getElementById('siteList').addEventListener('input', saveOptions);
document.getElementById('minWordsInBlock').addEventListener('input', saveOptions);
document.getElementById('customHighlights').addEventListener('input', saveOptions);
document.getElementById('disableAutoDetect').addEventListener('change', saveOptions);
document.getElementById('registryConfig').addEventListener('input', saveOptions);
document.getElementById('excludedTagsConfig').addEventListener('input', saveOptions);
document.getElementById('skipShortMetadataLines').addEventListener('change', saveOptions);

document.getElementById('resetExcludedTags').addEventListener('click', () => {
    document.getElementById('excludedTagsConfig').value = DEFAULT_EXCLUDED_TAGS_CONFIG;
    saveOptions();
});

['bolderDarken', 'bolderLighten'].forEach(prefix => {
    document.getElementById(`${prefix}Color`).addEventListener('input', (e) => {
        updateColorDisplay(prefix);
        saveOptions();
    });
    document.getElementById(`${prefix}Opacity`).addEventListener('input', (e) => {
        updateColorDisplay(prefix);
        saveOptions();
    });
});

document.getElementById('clearRegistries').addEventListener('click', () => {
    browser.storage.local.get(null).then((items) => {
        const keysToRemove = Object.keys(items).filter(key => key.startsWith('bolder_registry_'));
        if (keysToRemove.length > 0) {
            browser.storage.local.remove(keysToRemove).then(() => {
                const status = document.getElementById('status');
                status.textContent = `Cleared ${keysToRemove.length} registry entries.`;
                setTimeout(() => {
                    status.textContent = '';
                }, 1500);
            });
        } else {
            const status = document.getElementById('status');
            status.textContent = 'No registries found to clear.';
            setTimeout(() => {
                status.textContent = '';
            }, 1500);
        }
    });
});
