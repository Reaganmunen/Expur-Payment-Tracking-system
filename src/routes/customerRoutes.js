const router = require('express').Router();
const c = require('../controllers/customerController');
const { authorize } = require('../middleware/auth');

router.route('/').get(c.list).post(c.create);
router.route('/:id').get(c.get).put(c.update).delete(authorize('admin'), c.remove);

module.exports = router;
