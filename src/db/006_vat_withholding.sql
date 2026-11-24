-- VAT withholding on cheques. Run after 005.
--
-- Many customers pay by cheque for 98% of the invoice: they keep 2% back as
-- withholding VAT and pay it to KRA themselves. That 2% still settles the
-- invoice, but it is NOT cash received, so it is stored as its own payment
-- row (method 'vat_withheld') linked to the same cheque.

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('mpesa','cash','bank','cheque','vat_withheld'));

-- rate used when the cheque was recorded (0 = customer paid in full)
ALTER TABLE cheques ADD COLUMN IF NOT EXISTS withholding_rate NUMERIC(5,4) NOT NULL DEFAULT 0;

-- Cash collected must not include the withheld 2%
CREATE OR REPLACE VIEW monthly_pnl AS
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
  FROM payments WHERE method <> 'vat_withheld' GROUP BY 1),
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
