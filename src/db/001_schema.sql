-- Cream supply: invoices, payments, profit/loss (PostgreSQL)

CREATE TABLE customers (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,            -- e.g. 'Fresh cream 500ml'
  unit        TEXT NOT NULL DEFAULT 'pc',
  unit_cost   NUMERIC(12,2) NOT NULL,   -- what you pay your supplier (KES)
  unit_price  NUMERIC(12,2) NOT NULL,   -- default selling price (KES)
  active      BOOLEAN DEFAULT TRUE
);

CREATE TABLE invoices (
  id           SERIAL PRIMARY KEY,
  invoice_no   TEXT UNIQUE NOT NULL,    -- e.g. 'INV-2026-0001'
  customer_id  INT NOT NULL REFERENCES customers(id),
  issue_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date     DATE NOT NULL,
  written_off  BOOLEAN NOT NULL DEFAULT FALSE,  -- bad debt
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoice_items (
  id          SERIAL PRIMARY KEY,
  invoice_id  INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id  INT NOT NULL REFERENCES products(id),
  quantity    NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(12,2) NOT NULL,   -- snapshot at time of sale
  unit_cost   NUMERIC(12,2) NOT NULL    -- snapshot, so old profits never change
);

CREATE TABLE payments (
  id          SERIAL PRIMARY KEY,
  invoice_id  INT NOT NULL REFERENCES invoices(id),
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method      TEXT NOT NULL CHECK (method IN ('mpesa','cash','bank','cheque')),
  reference   TEXT UNIQUE,              -- M-Pesa receipt code, prevents double entry
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expenses (
  id            SERIAL PRIMARY KEY,
  category      TEXT NOT NULL,          -- transport, fuel, packaging, salaries...
  description   TEXT,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date  DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX idx_items_invoice    ON invoice_items(invoice_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_invoices_cust    ON invoices(customer_id);

-- Per-invoice totals and status
CREATE VIEW invoice_summary AS
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
JOIN (SELECT invoice_id,
             SUM(quantity*unit_price) AS total,
             SUM(quantity*unit_cost)  AS cost
      FROM invoice_items GROUP BY invoice_id) t ON t.invoice_id = i.id
LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid
           FROM payments GROUP BY invoice_id) p ON p.invoice_id = i.id;

-- Monthly profit & loss (negative net_profit = loss)
CREATE VIEW monthly_pnl AS
WITH sales AS (
  SELECT date_trunc('month', i.issue_date)::date AS m,
         SUM(ii.quantity*ii.unit_price) AS revenue,
         SUM(ii.quantity*ii.unit_cost)  AS cogs
  FROM invoices i JOIN invoice_items ii ON ii.invoice_id = i.id
  GROUP BY 1),
exp AS (
  SELECT date_trunc('month', expense_date)::date AS m, SUM(amount) AS expenses
  FROM expenses GROUP BY 1),
cash AS (
  SELECT date_trunc('month', paid_at)::date AS m, SUM(amount) AS collected
  FROM payments GROUP BY 1),
bad AS (
  SELECT date_trunc('month', issue_date)::date AS m, SUM(balance) AS bad_debt
  FROM invoice_summary WHERE status = 'WRITTEN_OFF' GROUP BY 1)
SELECT m AS month,
       COALESCE(revenue,0)   AS revenue,
       COALESCE(cogs,0)      AS cogs,
       COALESCE(revenue,0) - COALESCE(cogs,0)  AS gross_profit,
       COALESCE(expenses,0)  AS expenses,
       COALESCE(bad_debt,0)  AS bad_debt,
       COALESCE(revenue,0) - COALESCE(cogs,0) - COALESCE(expenses,0) - COALESCE(bad_debt,0) AS net_profit,
       COALESCE(collected,0) AS cash_collected
FROM sales
FULL JOIN exp  USING (m)
FULL JOIN cash USING (m)
FULL JOIN bad  USING (m)
ORDER BY month DESC;

-- Handy queries
-- Unpaid / overdue:  SELECT * FROM invoice_summary WHERE status IN ('UNPAID','PARTIAL','OVERDUE') ORDER BY due_date;
-- Who owes most:     SELECT customer, SUM(balance) FROM invoice_summary WHERE status <> 'PAID' AND status <> 'WRITTEN_OFF' GROUP BY 1 ORDER BY 2 DESC;
-- Loss-making sales: SELECT * FROM invoice_summary WHERE margin < 0;
