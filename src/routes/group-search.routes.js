const express = require('express');
const router = express.Router();
const groupSearchController = require('../controllers/group-search.controller');

// POST /api/group-search/search
router.post('/search', groupSearchController.search);

module.exports = router;
