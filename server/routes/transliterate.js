const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const text = req.query.text;
        const response = await fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=hi-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8&app=test`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to transliterate' });
    }
});

module.exports = router;
