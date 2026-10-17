# Update: cheque scanning, Excel export, new look

## Deploy (in this order)
1. Copy `src/` and `public/` over your project (same folder layout).
2. Run the new migration once:
   `psql "$DATABASE_URL" -f src/db/005_cheques.sql`
3. Add to your server environment (Render/Vercel settings or .env):
   `ANTHROPIC_API_KEY=sk-ant-...`   (needed only for automatic cheque reading)
   Optional: `CHEQUE_SCAN_MODEL` (default claude-sonnet-5-5), `SCAN_LIMIT_PER_HOUR` (default 40 per user), `APP_TZ` (default Africa/Nairobi)
4. Restart, then open `https://YOUR-SITE/health`. It must list
   `typed-invoice-no`, `invoice-edit`, `csv-export`, `cheques`. If it does not, the live server is still running old code.

Needs Node 18+ (uses built-in fetch). No new npm packages.

## What changed
- Cheques page: photo -> read -> review -> record. Nothing is recorded until you click Record payment.
- Invoices > Export to Excel: everything / not paid / paid, optional date range (CSV with UTF-8 BOM).
- Invoice no. + delivery note: new-invoice form double-checks what the server saved; admins can edit numbers on any invoice.
- New design (no Bootstrap), login page, collapsible sidebar, mobile menu.
- Dashboard shows last-month comparisons and a 90-day collection rate.
