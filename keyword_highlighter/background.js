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

// Helper: Check if enabled for a given URL
function isSiteEnabled(url, settings) {
    if (!url) return false;
    try {
        const hostname = new URL(url).hostname;
        const inList = settings.siteList.some(site => hostname.includes(site));

        if (settings.defaultEnabled) {
            return !inList;
        } else {
            return inList;
        }
    } catch (e) {
        return false;
    }
}

// Helper: Update icon based on state
function updateIcon(tabId, isEnabled) {
    const path = isEnabled ? "icons/icon.png" : "icons/icon_disabled.png";
    browser.action.setIcon({ tabId, path });
    // Optional: Update title
    const title = isEnabled ? "Smart Keyword Highlighter: ON" : "Smart Keyword Highlighter: OFF";
    browser.action.setTitle({ tabId, title });
}

// Helper: Get settings
async function getSettings() {
    return await storageGet(defaultSettings);
}

// Update icon when tab is updated or activated
async function updateTabIcon(tabId, url) {
    if (!url) return;
    const settings = await getSettings();
    const enabled = isSiteEnabled(url, settings);
    updateIcon(tabId, enabled);
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        updateTabIcon(tabId, tab.url);
    }
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await browser.tabs.get(activeInfo.tabId);
    if (tab.url) {
        updateTabIcon(activeInfo.tabId, tab.url);
    }
});

// Handle Click
browser.action.onClicked.addListener(async (tab) => {
    if (!tab.url) return;

    try {
        const hostname = new URL(tab.url).hostname;
        const settings = await getSettings();
        const inListIndex = settings.siteList.findIndex(site => hostname.includes(site));

        let newSiteList = [...settings.siteList];

        if (inListIndex > -1) {
            // Remove from list
            newSiteList.splice(inListIndex, 1);
        } else {
            // Add to list
            newSiteList.push(hostname);
        }

        await storageSet({ siteList: newSiteList });

        // Icon update will happen via storage listener or we can force it here
        // But let's rely on storage change to keep it synced or just update immediately for responsiveness
        const newSettings = { ...settings, siteList: newSiteList };
        const enabled = isSiteEnabled(tab.url, newSettings);
        updateIcon(tab.id, enabled);
        try {
            await browser.tabs.sendMessage(tab.id, { type: 'bolder-site-enabled-changed', enabled });
        } catch (e) {
            // Ignore if the content script is not available for this tab.
        }

    } catch (e) {
        console.error("Error toggling site:", e);
    }
});

// Listen for storage changes to update active tab icon
browser.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local') {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0) {
            updateTabIcon(tabs[0].id, tabs[0].url);
        }
    }
});
