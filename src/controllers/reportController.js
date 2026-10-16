const Report = require('../models/reportModel');
const asyncHandler = require('../utils/asyncHandler');
const { forRole } = require('../utils/redact');

exports.dashboard = asyncHandler(async (req, res) => res.json(await Report.dashboard()));
exports.salesByUser = asyncHandler(async (req, res) => res.json(await Report.salesByUser(req.query)));
exports.monthlyPnl = asyncHandler(async (req, res) => res.json(await Report.monthlyPnl(req.query)));
exports.expensesByCategory = asyncHandler(async (req, res) => res.json(await Report.expensesByCategory(req.query)));
exports.outstandingByCustomer = asyncHandler(async (req, res) => res.json(await Report.outstandingByCustomer()));
exports.overdue = asyncHandler(async (req, res) => res.json(await Report.overdue()));
exports.productProfitability = asyncHandler(async (req, res) => res.json(await Report.productProfitability()));
exports.lossMaking = asyncHandler(async (req, res) => res.json(await Report.lossMaking()));

// The logged-in user's own sales totals (cost/profit hidden for staff)
exports.mySales = asyncHandler(async (req, res) => {
  const [row] = await Report.salesByUser({ from: req.query.from, to: req.query.to, user_id: req.user.id });
  const empty = { user_id: req.user.id, seller: req.user.name, invoices: 0, total_sales: 0, collected: 0, outstanding: 0, gross_profit: 0 };
  res.json(forRole(req.user, row || empty));
});
