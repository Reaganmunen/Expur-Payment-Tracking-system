const router = require('express').Router();
const c = require('../controllers/paymentController');
const { authorize } = require('../middleware/auth');

router.route('/').get(c.list).post(c.create);
router.delete('/:id', authorize('admin'), c.remove);

module.exports = router;
