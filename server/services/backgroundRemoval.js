const fs = require('fs');
const path = require('path');

let removeBackgroundFn = null;
function loadRemoveBackground() {
    if (!removeBackgroundFn) {
        removeBackgroundFn = require('@imgly/background-removal-node').removeBackground;
    }
    return removeBackgroundFn;
}

const MIME_BY_EXT = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.jfif': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.avif': 'image/avif',
};

/**
 * Runs AI background removal on an uploaded image and replaces it in place
 * with a transparent PNG (same directory, same base filename, .png
 * extension) so PageMint can composite the cutout directly. Takes several
 * seconds -- this is meant for the rare "set my profile photo" action, not
 * a high-frequency path.
 *
 * Never throws: an unsupported format or a model failure just keeps the
 * original upload untouched, because a broken cutout must not block the
 * upload itself.
 */
async function removeBackgroundInPlace(absoluteFilePath) {
    try {
        const removeBackground = loadRemoveBackground();
        const inputBuffer = fs.readFileSync(absoluteFilePath);
        const mimeType = MIME_BY_EXT[path.extname(absoluteFilePath).toLowerCase()] || 'image/jpeg';
        const resultBlob = await removeBackground(new Blob([inputBuffer], { type: mimeType }));
        const outputBuffer = Buffer.from(await resultBlob.arrayBuffer());

        const dir = path.dirname(absoluteFilePath);
        const base = path.basename(absoluteFilePath, path.extname(absoluteFilePath));
        const outputPath = path.join(dir, `${base}.png`);

        fs.writeFileSync(outputPath, outputBuffer);
        if (outputPath !== absoluteFilePath) {
            fs.unlinkSync(absoluteFilePath);
        }
        return { path: outputPath, removed: true };
    } catch (err) {
        console.error('[background removal] failed, keeping original upload:', err.message);
        return { path: absoluteFilePath, removed: false };
    }
}

module.exports = { removeBackgroundInPlace };
