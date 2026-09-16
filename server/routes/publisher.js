const express = require('express');
const router = express.Router();
const { requireGeneratorApiAuth } = require('../middleware/generatorApiAuth');
const {
    getConfiguredPublisherId,
    buildPublisherProfileResponse
} = require('../services/publisherProfile');

/**
 * GET /api/publisher/profile/:publisherId
 * Used by newspaper generator CliffFrontEditorRail8A on launch.
 */
router.get('/profile/:publisherId', requireGeneratorApiAuth, (req, res) => {
    try {
        const requestedId = String(req.params.publisherId || '').trim();
        const configuredId = getConfiguredPublisherId();
        if (!requestedId || requestedId !== configuredId) {
            return res.status(404).json({ error: 'Publisher profile not found.' });
        }

        res.json(buildPublisherProfileResponse(requestedId, req));
    } catch (err) {
        console.error('Publisher profile GET error:', err);
        res.status(500).json({ error: 'Failed to load publisher profile.' });
    }
});

module.exports = router;
