const router = require('express').Router();
const c = require('../controllers/reportController');
const { authorize } = require('../middleware/auth');

router.get('/my-sales', c.mySales);              // any logged-in user, own numbers only

router.use(authorize('admin'));                  // everything below: admin only
router.get('/dashboard', c.dashboard);
router.get('/sales-by-user', c.salesByUser);
router.get('/monthly-pnl', c.monthlyPnl);
router.get('/expenses-by-category', c.expensesByCategory);
router.get('/outstanding-by-customer', c.outstandingByCustomer);
router.get('/overdue', c.overdue);
router.get('/product-profitability', c.productProfitability);
router.get('/loss-making', c.lossMaking);

module.exports = router;
