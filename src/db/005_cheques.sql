-- Cheque scanning + reconciliation. Run after 004.
--
-- A cheque is photographed, read, then matched to one or more invoices.
-- Nothing touches the payments table until a person confirms the match:
-- scanning only ever creates a 'pending' cheque.

CREATE TABLE cheques (
  id            SERIAL PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','recorded','void')),
  payer_name    TEXT,                       -- account holder printed on the cheque
  cheque_no     TEXT,
  bank          TEXT,
  cheque_date   DATE,
  amount        NUMERIC(12,2) CHECK (amount IS NULL OR amount > 0),
  customer_id   INT REFERENCES customers(id),
  scan          JSONB,                      -- what the scanner read, kept for audit
  allocations   JSONB,                      -- [{invoice_id, invoice_no, amount}] set when recorded
  uploaded_by   INT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at   TIMESTAMPTZ,
  voided_at     TIMESTAMPTZ,
  void_reason   TEXT
);

-- Photos live in their own table so list queries can never drag megabytes along by accident.
-- (Stored in Postgres, not on disk: Render/Vercel disks are wiped on every deploy.)
CREATE TABLE cheque_images (
  cheque_id  INT PRIMARY KEY REFERENCES cheques(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL,
  data       BYTEA NOT NULL
);

ALTER TABLE payments ADD COLUMN cheque_id INT REFERENCES cheques(id);

CREATE INDEX idx_payments_cheque ON payments(cheque_id);
CREATE INDEX idx_cheques_status  ON cheques(status, created_at DESC);
CREATE INDEX idx_cheques_no      ON cheques(cheque_no);
