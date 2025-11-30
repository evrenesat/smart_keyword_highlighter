const browser = (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined")
    ? globalThis.chrome
    : globalThis.browser;

function storageGet(keys) {
    return new Promise((resolve, reject) => {
        const result = browser.storage.local.get(keys, (data) => {
            resolve(data);
        });
        if (result && typeof result.then === 'function') {
            result.then(resolve, reject);
        }
    });
}

function storageSet(items) {
    return new Promise((resolve, reject) => {
        const result = browser.storage.local.set(items, () => {
            resolve();
        });
        if (result && typeof result.then === 'function') {
            result.then(resolve, reject);
        }
    });
}

const defaultSettings = {
    defaultEnabled: true,
    siteList: []
};

function saveOptions() {
    const defaultEnabled = document.getElementById('defaultEnabled').checked;
    const siteListRaw = document.getElementById('siteList').value;
    const siteList = siteListRaw.split('\n').map(s => s.trim()).filter(s => s);

    storageSet({
        defaultEnabled,
        siteList
    }).then(() => {
        const status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(() => {
            status.textContent = '';
        }, 1500);
    });
}

function restoreOptions() {
    storageGet(defaultSettings).then((result) => {
        document.getElementById('defaultEnabled').checked = result.defaultEnabled;
        document.getElementById('siteList').value = result.siteList.join('\n');
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('defaultEnabled').addEventListener('change', saveOptions);
document.getElementById('siteList').addEventListener('input', saveOptions);
