const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');

router.use('/auth', require('./authRoutes'));   // login is public

router.use(authenticate);                        // everything below needs a valid token
router.use('/users', authorize('admin'), require('./userRoutes'));
router.use('/customers', require('./customerRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/invoices', require('./invoiceRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/cheques', require('./chequeRoutes'));
router.use('/expenses', require('./expenseRoutes'));
router.use('/reports', require('./reportRoutes'));

module.exports = router;
