const express = require('express');
const router = express.Router();
const scraperController = require('../controllers/scraper.controller');

// Cào bài viết từ group
router.post('/scrape', scraperController.scrape);

// Lấy danh sách bài đã cào
router.get('/posts', scraperController.getPosts);

// Lấy danh sách lĩnh vực
router.get('/categories', scraperController.getCategories);

// Toggle bookmark
router.put('/posts/:id/bookmark', scraperController.toggleBookmark);

// Xóa bài đã cào
router.delete('/posts/:id', scraperController.deletePost);

// ==== Cấu Hình Cào Ngầm ====
router.get('/targets', scraperController.getTargets);
router.post('/targets', scraperController.createTarget);
router.put('/targets/:id', scraperController.updateTarget);
router.delete('/targets/:id', scraperController.deleteTarget);

module.exports = router;
