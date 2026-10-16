const router = require('express').Router();
const c = require('../controllers/invoiceController');
const { authorize } = require('../middleware/auth');

const admin = authorize('admin');

router.route('/').get(c.list).post(c.create);
router.route('/:id').get(c.get).put(admin, c.update).delete(admin, c.remove);
router.route('/:id/write-off').post(admin, c.writeOff).delete(admin, c.reverseWriteOff);

module.exports = router;
