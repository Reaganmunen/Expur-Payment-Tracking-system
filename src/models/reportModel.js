const { query } = require('../config/db');

exports.dashboard = async () =>
  (await query(`
    SELECT
      (SELECT COALESCE(SUM(balance),0) FROM invoice_summary WHERE status IN ('UNPAID','PARTIAL','OVERDUE')) AS outstanding,
      (SELECT COALESCE(SUM(balance),0) FROM invoice_summary WHERE status = 'OVERDUE') AS overdue,
      (SELECT COUNT(*) FROM invoice_summary WHERE status = 'OVERDUE') AS overdue_count,
      (SELECT COUNT(*) FROM invoice_summary WHERE status IN ('UNPAID','PARTIAL','OVERDUE')) AS unpaid_count,
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE paid_at >= date_trunc('month', now())) AS collected_this_month,
      COALESCE((SELECT revenue FROM monthly_pnl WHERE month = date_trunc('month', CURRENT_DATE)::date),0) AS revenue_this_month,
      COALESCE((SELECT expenses FROM monthly_pnl WHERE month = date_trunc('month', CURRENT_DATE)::date),0) AS expenses_this_month,
      COALESCE((SELECT net_profit FROM monthly_pnl WHERE month = date_trunc('month', CURRENT_DATE)::date),0) AS net_profit_this_month
  `)).rows[0];

exports.monthlyPnl = async ({ from, to } = {}) => {
  const cond = [];
  const params = [];
  if (from) { params.push(from); cond.push(`month >= date_trunc('month', $${params.length}::date)`); }
  if (to) { params.push(to); cond.push(`month <= $${params.length}::date`); }
  return (await query(
    `SELECT * FROM monthly_pnl ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY month DESC`, params)).rows;
};

exports.expensesByCategory = async ({ month } = {}) => {
  const params = [];
  let where = '';
  if (month) { params.push(month); where = `WHERE month = date_trunc('month', $1::date)`; }
  return (await query(`SELECT * FROM expenses_by_category ${where}`, params)).rows;
};

exports.outstandingByCustomer = async () =>
  (await query(`
    SELECT customer_id, customer, COUNT(*) AS invoices, SUM(balance) AS balance,
           SUM(balance) FILTER (WHERE status = 'OVERDUE') AS overdue_balance
    FROM invoice_summary WHERE status IN ('UNPAID','PARTIAL','OVERDUE')
    GROUP BY customer_id, customer ORDER BY balance DESC`)).rows;

exports.overdue = async () =>
  (await query(`SELECT *, CURRENT_DATE - due_date AS days_overdue
                FROM invoice_summary WHERE status = 'OVERDUE' ORDER BY due_date`)).rows;

exports.productProfitability = async () =>
  (await query(`
    SELECT p.id, p.name, SUM(ii.quantity) AS units_sold,
           SUM(ii.quantity * ii.unit_price) AS revenue,
           SUM(ii.quantity * (ii.unit_price - ii.unit_cost)) AS profit
    FROM invoice_items ii JOIN products p ON p.id = ii.product_id
    GROUP BY p.id, p.name ORDER BY profit DESC`)).rows;

exports.lossMaking = async () =>
  (await query(`SELECT * FROM invoice_summary WHERE margin < 0 ORDER BY margin`)).rows;

// Sales per seller. user_id limits it to one person (used by /my-sales).
exports.salesByUser = async ({ from, to, user_id } = {}) => {
  const cond = [];
  const params = [];
  if (from) { params.push(from); cond.push(`s.issue_date >= $${params.length}`); }
  if (to) { params.push(to); cond.push(`s.issue_date <= $${params.length}`); }
  if (user_id) { params.push(user_id); cond.push(`s.created_by = $${params.length}`); }
  return (await query(`
    SELECT s.created_by AS user_id, COALESCE(s.seller, 'Unassigned') AS seller,
           COUNT(*) AS invoices,
           SUM(s.total) AS total_sales,
           SUM(s.paid) AS collected,
           COALESCE(SUM(s.balance) FILTER (WHERE s.status NOT IN ('PAID','WRITTEN_OFF')), 0) AS outstanding,
           SUM(s.margin) AS gross_profit
    FROM invoice_summary s
    ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
    GROUP BY s.created_by, s.seller ORDER BY total_sales DESC`, params)).rows;
};
