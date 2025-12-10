const defaultSettings = {
    defaultEnabled: true,
    siteList: [],
    minWordsInBlock: 10,
    bolderDarkenBg: 'rgba(0, 0, 0, 0.1)',
    bolderLightenBg: 'rgba(255, 255, 255, 0.25)',
    customHighlights: '',
    disableAutoDetect: false,
    registryConfig: '1000: *.*'
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
    document.getElementById(`${prefix}OpacityVal`).textContent = opacity;
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

    browser.storage.local.set({
        defaultEnabled,
        siteList,
        minWordsInBlock,
        bolderDarkenBg,
        bolderLightenBg,
        customHighlights: document.getElementById('customHighlights').value,
        disableAutoDetect: document.getElementById('disableAutoDetect').checked,
        registryConfig: document.getElementById('registryConfig').value
    }).then(() => {
        const status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(() => {
            status.textContent = '';
        }, 1500);
    });
}

function restoreOptions() {
    browser.storage.local.get(defaultSettings).then((result) => {
        document.getElementById('defaultEnabled').checked = result.defaultEnabled;
        document.getElementById('siteList').value = result.siteList.join('\n');
        document.getElementById('minWordsInBlock').value = result.minWordsInBlock;
        document.getElementById('customHighlights').value = result.customHighlights || '';
        document.getElementById('disableAutoDetect').checked = result.disableAutoDetect || false;
        document.getElementById('registryConfig').value = result.registryConfig || '1000: *.*';

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

['bolderDarken', 'bolderLighten'].forEach(prefix => {
    document.getElementById(`${prefix}Color`).addEventListener('input', saveOptions);
    document.getElementById(`${prefix}Opacity`).addEventListener('input', (e) => {
        updateColorDisplay(prefix);
        saveOptions();
    });
});

document.getElementById('clearRegistry').addEventListener('click', () => {
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
