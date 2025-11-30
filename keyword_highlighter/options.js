const defaultSettings = {
    defaultEnabled: true,
    siteList: []
};

function saveOptions() {
    const defaultEnabled = document.getElementById('defaultEnabled').checked;
    const siteListRaw = document.getElementById('siteList').value;
    const siteList = siteListRaw.split('\n').map(s => s.trim()).filter(s => s);

    browser.storage.local.set({
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
    browser.storage.local.get(defaultSettings).then((result) => {
        document.getElementById('defaultEnabled').checked = result.defaultEnabled;
        document.getElementById('siteList').value = result.siteList.join('\n');
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('defaultEnabled').addEventListener('change', saveOptions);
document.getElementById('siteList').addEventListener('input', saveOptions);
