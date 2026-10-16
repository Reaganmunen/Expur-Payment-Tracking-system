const router = require('express').Router();
const c = require('../controllers/expenseController');
const { authorize } = require('../middleware/auth');

const admin = authorize('admin');

// Categories must be declared before '/:id'
router.route('/categories').get(c.listCategories).post(admin, c.createCategory);
router.route('/').get(c.list).post(c.create);
router.route('/:id').get(c.get).put(admin, c.update).delete(admin, c.remove);

module.exports = router;
