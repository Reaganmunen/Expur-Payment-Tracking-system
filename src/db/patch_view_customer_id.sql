-- ONLY if you already ran the earlier schema.sql: adds customer_id to invoice_summary.
CREATE OR REPLACE VIEW invoice_summary AS
SELECT
  i.id, i.invoice_no, c.name AS customer, i.issue_date, i.due_date,
  t.total,
  COALESCE(p.paid, 0)               AS paid,
  t.total - COALESCE(p.paid, 0)     AS balance,
  t.total - t.cost                  AS margin,
  CASE
    WHEN i.written_off                         THEN 'WRITTEN_OFF'
    WHEN COALESCE(p.paid,0) >= t.total         THEN 'PAID'
    WHEN i.due_date < CURRENT_DATE             THEN 'OVERDUE'
    WHEN COALESCE(p.paid,0) > 0                THEN 'PARTIAL'
    ELSE 'UNPAID'
  END AS status,
  i.customer_id
FROM invoices i
JOIN customers c ON c.id = i.customer_id
JOIN (SELECT invoice_id, SUM(quantity*unit_price) AS total, SUM(quantity*unit_cost) AS cost
      FROM invoice_items GROUP BY invoice_id) t ON t.invoice_id = i.id
LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM payments GROUP BY invoice_id) p ON p.invoice_id = i.id;
