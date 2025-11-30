const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

async function build() {
    // 1. Clean dist
    await fs.remove(DIST_DIR);
    await fs.ensureDir(DIST_DIR);

    // 2. Define source files to copy
    const filesToCopy = [
        'background.js',
        'content.js',
        'options.js',
        'options.html',
        'options.css',
        'icons'
    ];

    // 3. Build for Firefox
    console.log('Building for Firefox...');
    await createPackage('firefox', 'manifest.firefox.json', filesToCopy);

    // 4. Build for Chrome
    console.log('Building for Chrome...');
    await createPackage('chrome', 'manifest.chrome.json', filesToCopy);

    console.log('Build complete! Check dist/ folder.');
}

async function createPackage(browser, manifestName, files) {
    const browserDir = path.join(DIST_DIR, browser);
    await fs.ensureDir(browserDir);

    // Copy common files
    for (const file of files) {
        await fs.copy(path.join(ROOT_DIR, file), path.join(browserDir, file));
    }

    // Copy manifest
    await fs.copy(path.join(ROOT_DIR, manifestName), path.join(browserDir, 'manifest.json'));

    // Zip it
    const output = fs.createWriteStream(path.join(DIST_DIR, `keyword-highlighter-${browser}.zip`));
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(browserDir, false);
    await archive.finalize();
}

build().catch(console.error);
