const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');

router.post('/', accountController.create);
router.get('/', accountController.getAll);
router.get('/:id', accountController.getById);
router.put('/:id', accountController.update);
router.delete('/:id', accountController.delete);
router.post('/bulk-delete', accountController.deleteMultiple);
router.post('/:id/check-health', accountController.checkHealth);
router.post('/:id/sync-targets', accountController.syncTargets);

module.exports = router;
