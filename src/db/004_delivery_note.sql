-- Delivery note number (from the paper delivery/invoice books). Run after 003.
-- invoice_no already exists and is unique; the app now lets you type it in.
ALTER TABLE invoices ADD COLUMN delivery_note_no TEXT;
CREATE INDEX idx_invoices_delivery_note ON invoices(delivery_note_no);

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
  i.customer_id,
  i.created_by,
  u.name AS seller,
  i.delivery_note_no
FROM invoices i
JOIN customers c ON c.id = i.customer_id
LEFT JOIN users u ON u.id = i.created_by
JOIN (SELECT invoice_id, SUM(quantity*unit_price) AS total, SUM(quantity*unit_cost) AS cost
      FROM invoice_items GROUP BY invoice_id) t ON t.invoice_id = i.id
LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM payments GROUP BY invoice_id) p ON p.invoice_id = i.id;
