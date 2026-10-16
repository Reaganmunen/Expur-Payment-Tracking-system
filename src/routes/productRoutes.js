const router = require('express').Router();
const c = require('../controllers/productController');
const { authorize } = require('../middleware/auth');

router.route('/').get(c.list).post(authorize('admin'), c.create);
router.route('/:id').get(c.get).put(authorize('admin'), c.update).delete(authorize('admin'), c.remove);

module.exports = router;
