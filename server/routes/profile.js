const express = require('express');
const router = express.Router();
const { avatarsDir, resolveUpload } = require('../storage');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb, queryGet, queryRun } = require('../db/init');
const { verifyToken } = require('../middleware/auth');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = avatarsDir;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'), false);
        }
    }
});

// GET /api/profile
// Get current user profile
router.get('/', verifyToken, (req, res) => {
    try {
        const user = queryGet("SELECT id, username, full_name, name_hi, name_en, post, avatar_path, role, email, phone, city FROM users WHERE id = ?", [req.user.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ success: true, profile: user });
    } catch (err) {
        console.error('Error fetching profile:', err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// PUT /api/profile
// Update current user profile
router.put('/', verifyToken, upload.single('avatar'), (req, res) => {
    try {
        const { full_name, name_hi, name_en, post, email, phone, city } = req.body;
        
        let updateSql = "UPDATE users SET full_name = COALESCE(?, full_name), name_hi = ?, name_en = ?, post = ?, email = ?, phone = ?, city = ? WHERE id = ?";
        let params = [full_name, name_hi, name_en, post, email, phone, city, req.user.id];

        let avatar_path = null;
        if (req.file) {
            avatar_path = '/uploads/avatars/' + req.file.filename;
            updateSql = "UPDATE users SET full_name = COALESCE(?, full_name), name_hi = ?, name_en = ?, post = ?, email = ?, phone = ?, city = ?, avatar_path = ? WHERE id = ?";
            params = [full_name, name_hi, name_en, post, email, phone, city, avatar_path, req.user.id];
            
            // Delete old avatar if exists
            const oldUser = queryGet("SELECT avatar_path FROM users WHERE id = ?", [req.user.id]);
            if (oldUser && oldUser.avatar_path) {
                const oldPath = resolveUpload(oldUser.avatar_path);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
        }

        queryRun(updateSql, params);
        
        const updatedUser = queryGet("SELECT id, username, full_name, name_hi, name_en, post, avatar_path, role, email, phone, city FROM users WHERE id = ?", [req.user.id]);
        res.json({ success: true, profile: updatedUser });
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ error: err.message || 'Failed to update profile' });
    }
});

module.exports = router;
