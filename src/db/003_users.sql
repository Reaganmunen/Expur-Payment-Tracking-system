-- Users + who-did-what tracking. Run after 001 and 002.

CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,          -- stored lowercase
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE invoices ADD COLUMN created_by  INT REFERENCES users(id);  -- the seller
ALTER TABLE payments ADD COLUMN recorded_by INT REFERENCES users(id);
ALTER TABLE expenses ADD COLUMN created_by  INT REFERENCES users(id);

CREATE INDEX idx_invoices_created_by ON invoices(created_by);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);

-- Same view as before, with seller columns appended at the end
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
  u.name AS seller
FROM invoices i
JOIN customers c ON c.id = i.customer_id
LEFT JOIN users u ON u.id = i.created_by
JOIN (SELECT invoice_id, SUM(quantity*unit_price) AS total, SUM(quantity*unit_cost) AS cost
      FROM invoice_items GROUP BY invoice_id) t ON t.invoice_id = i.id
LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM payments GROUP BY invoice_id) p ON p.invoice_id = i.id;
