# HKC ERP Server

Small Node backend for the HKC Trading ERP frontend.

## Run

```bash
npm run server
```

The server listens on `http://localhost:8787` by default.

## Database Architecture (Pure MySQL 8+ with Drizzle ORM)

The server connects natively to MySQL using Drizzle ORM (`drizzle-orm/mysql2`) and `mysql2/promise` connection pooling.

Environment variables are optional due to built-in hardcoded local MySQL fallbacks:

```bash
# Direct Connection String
DATABASE_URL=mysql://root:password@127.0.0.1:3306/hkc_erp_v5

# Or Individual Variables
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=hkc_erp_v5
PORT=1000
SERVER_HOST=0.0.0.0
JWT_SECRET=super_secret_jwt_key
```

## Routes

- `GET /health`
- `GET /api`
- `GET /api/:resource`
- `GET /api/:resource/:id`
- `POST /api/:resource`
- `PUT /api/:resource`
- `PATCH /api/:resource/:id`
- `DELETE /api/:resource/:id`

Examples:

```bash
curl http://localhost:8787/api/invoices
curl http://localhost:8787/api/sales_orders/SO-2026-001
```

Supported resources are defined in `server/resources.js` and mirror `DOCUMENTATION.md`: Sales, Inventory, Finance, HR, and the planned `cost_center_budgets` surface.
