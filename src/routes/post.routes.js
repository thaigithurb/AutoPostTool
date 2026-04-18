const express = require('express');
const router = express.Router();
const postController = require('../controllers/post.controller');

// Route /scheduled phải đặt TRƯỚC /:id để tránh conflict
router.get('/scheduled', postController.getScheduled);

router.post('/', postController.create);
router.get('/', postController.getAll);
router.get('/:id', postController.getById);
router.put('/:id', postController.update);
router.delete('/:id', postController.delete);

module.exports = router;
