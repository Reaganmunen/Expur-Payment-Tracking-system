const router = require('express').Router();
const c = require('../controllers/userController');

// Whole router is admin-only (enforced in routes/index.js)
router.route('/').get(c.list).post(c.create);
router.put('/:id', c.update);
router.put('/:id/password', c.resetPassword);

module.exports = router;
