const express = require('express');
const router = express.Router();
const c = require('../controllers/chequeController');
const { authorize } = require('../middleware/auth');
const scanLimiter = require('../middleware/scanLimiter');

// The photo arrives as the raw request body (Content-Type: image/jpeg), so no upload library is needed.
router.post('/scan', scanLimiter, express.raw({ type: () => true, limit: '6mb' }), c.scan);
router.post('/match', c.match);                      // must stay above '/:id'

router.get('/', c.list);
router.get('/:id', c.get);
router.get('/:id/image', c.image);
router.post('/:id/rescan', scanLimiter, c.rescan);
router.post('/:id/record', c.record);
router.post('/:id/void', authorize('admin'), c.void);
router.delete('/:id', c.discard);

module.exports = router;
