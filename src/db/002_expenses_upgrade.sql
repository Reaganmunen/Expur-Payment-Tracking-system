-- Run after schema.sql. Upgrades expenses for fuel, lunch, airtime, etc.

CREATE TABLE expense_categories (
  id    SERIAL PRIMARY KEY,
  name  TEXT UNIQUE NOT NULL
);

INSERT INTO expense_categories (name) VALUES
  ('Fuel'), ('Lunch / Meals'), ('Transport / Fare'), ('Airtime & Data'),
  ('Packaging'), ('Cold storage / Ice'), ('Vehicle repair'),
  ('Parking & Fees'), ('Salaries / Casual labour'), ('Rent'),
  ('Licences & Permits'), ('Other');

ALTER TABLE expenses
  ADD COLUMN category_id INT REFERENCES expense_categories(id),
  ADD COLUMN paid_via    TEXT CHECK (paid_via IN ('mpesa','cash','bank')) DEFAULT 'cash',
  ADD COLUMN reference   TEXT,                     -- M-Pesa code / receipt no.
  ADD COLUMN invoice_id  INT REFERENCES invoices(id); -- optional: cost of a specific delivery

-- Carry over any existing free-text categories
INSERT INTO expense_categories (name)
SELECT DISTINCT category FROM expenses
WHERE category NOT IN (SELECT name FROM expense_categories);

UPDATE expenses e SET category_id = c.id
FROM expense_categories c WHERE c.name = e.category;

ALTER TABLE expenses ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE expenses DROP COLUMN category;

CREATE INDEX idx_expenses_date ON expenses(expense_date);

-- Spending per category per month
CREATE VIEW expenses_by_category AS
SELECT date_trunc('month', e.expense_date)::date AS month,
       c.name AS category,
       SUM(e.amount) AS total,
       COUNT(*)      AS entries
FROM expenses e JOIN expense_categories c ON c.id = e.category_id
GROUP BY 1, 2
ORDER BY month DESC, total DESC;

-- Quick log examples
-- INSERT INTO expenses (category_id, description, amount, paid_via)
--   VALUES ((SELECT id FROM expense_categories WHERE name='Fuel'), 'Delivery run to Thika', 2500, 'mpesa');
-- INSERT INTO expenses (category_id, description, amount)
--   VALUES ((SELECT id FROM expense_categories WHERE name='Lunch / Meals'), 'Lunch during deliveries', 350);
