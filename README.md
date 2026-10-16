# Cream Invoicing Backend

Node/Express + PostgreSQL + JWT login. All amounts in KES.

## Setup
1. `npm install`
2. `cp .env.example .env`, set `DATABASE_URL` and `JWT_SECRET`
   (generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
3. Run in order: `src/db/001_schema.sql`, `002_expenses_upgrade.sql`, `003_users.sql`
   (already ran 001 before? also run `patch_view_customer_id.sql` first, then 002 and 003)
4. Create the first admin: `npm run create-admin -- "Full Name" you@example.com StrongPassword`
5. `npm run dev`

## Login
`POST /api/auth/login` `{ "email", "password" }` -> `{ token, user }`
Send `Authorization: Bearer <token>` on every other request. Tokens last 12h (`JWT_EXPIRES_IN`).
Also: `GET /api/auth/me`, `POST /api/auth/change-password`.
Disabled users are locked out immediately. 10 failed logins per IP+email per 15 min are blocked.

## Roles
| | admin | staff |
|---|---|---|
| Customers | all | view, create, edit |
| Products | all | view only, **cost price hidden** |
| Invoices | all, write-off, edit, delete | create; sees **only own** invoices, margins hidden |
| Payments | all, delete | record on **own** invoices only |
| Expenses | all, edit, delete, add categories | log and view **own** only |
| Reports | all | `GET /reports/my-sales` only (own totals) |
| Users | manage (`/api/users`) | none |

Every invoice stores who sold it (`created_by`), every payment who recorded it, every expense who logged it.

## Endpoints (under /api)
- auth: `/auth/login`, `/auth/me`, `/auth/change-password`
- users (admin): GET/POST `/users`, PUT `/users/:id` (name, role, active), PUT `/users/:id/password`
- customers: GET/POST `/customers`, GET/PUT/DELETE `/customers/:id` (`?search=`)
- products: GET/POST `/products`, GET/PUT/DELETE `/products/:id` (DELETE = deactivate)
- invoices: GET `/invoices?status=unpaid|partial|overdue|paid|outstanding&customer_id=&from=&to=` (admin may add `&created_by=`), POST `/invoices`, GET/PUT/DELETE `/invoices/:id`, POST/DELETE `/invoices/:id/write-off`
- payments: GET `/payments?invoice_id=`, POST `/payments`, DELETE `/payments/:id`
- expenses: GET/POST `/expenses`, GET/PUT/DELETE `/expenses/:id`, GET/POST `/expenses/categories`
- reports: `/reports/my-sales` (everyone); admin: `/dashboard`, `/sales-by-user`, `/monthly-pnl`, `/expenses-by-category`, `/outstanding-by-customer`, `/overdue`, `/product-profitability`, `/loss-making`

## Examples
```
POST /api/invoices
{ "customer_id": 1, "due_date": "2026-11-07",
  "items": [ { "product_id": 1, "quantity": 20 }, { "product_id": 2, "quantity": 10, "unit_price": 480 } ] }

POST /api/payments
{ "invoice_id": 1, "amount": 5000, "method": "mpesa", "reference": "SJK7X9ABCD" }

POST /api/expenses
{ "category_id": 1, "amount": 2500, "description": "Delivery run to Thika", "paid_via": "mpesa" }
```
Invoice numbers auto-generate (INV-2026-0001). `due_date` defaults to 30 days after issue.
