const router = require('express').Router();
const c = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const loginLimiter = require('../middleware/loginLimiter');

router.post('/login', loginLimiter, c.login);
router.get('/me', authenticate, c.me);
router.post('/change-password', authenticate, c.changePassword);

module.exports = router;
