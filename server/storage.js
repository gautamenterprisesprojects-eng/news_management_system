const path = require('path');

const projectRoot = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : projectRoot;
const uploadsDir = path.join(dataDir, 'uploads');
const avatarsDir = process.env.DATA_DIR
    ? path.join(uploadsDir, 'avatars')
    : path.join(projectRoot, 'public', 'uploads', 'avatars');
const pdfsDir = path.join(uploadsDir, 'pdfs');

function resolveUpload(urlPath) {
    if (typeof urlPath !== 'string' || !urlPath.startsWith('/uploads/')) {
        throw new Error('Invalid upload path');
    }
    const isAvatar = urlPath.startsWith('/uploads/avatars/');
    const root = isAvatar ? avatarsDir : uploadsDir;
    const prefix = isAvatar ? '/uploads/avatars/' : '/uploads/';
    const target = path.resolve(root, urlPath.slice(prefix.length));
    if (!target.startsWith(root + path.sep)) throw new Error('Invalid upload path');
    return target;
}

module.exports = { dataDir, uploadsDir, avatarsDir, pdfsDir, resolveUpload };
