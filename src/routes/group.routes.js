const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group.controller');

router.post('/', groupController.create);
router.get('/', groupController.getAll);
router.get('/:id', groupController.getById);
router.put('/:id', groupController.update);
router.delete('/:id', groupController.delete);

module.exports = router;
