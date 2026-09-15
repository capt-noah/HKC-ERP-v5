# HKC ERP v5

Enterprise Resource Planning system tailored for Ethiopian Agricultural Commodity Export (WH1) and Pharmaceutical/Veterinary Import Hubs (WH2/WH3).

> 📖 **Full System Architecture & Context**: See [SYSTEM_CONTEXT_V5.md](./SYSTEM_CONTEXT_V5.md) for complete details on the architecture, 38 MySQL database tables, FIFO COGS calculations, sub-entry pricing, and RBAC rules.

---

## Quick Start

### 1. Prerequisites
- Node.js 20+ / 22+
- MySQL 8.0+ running on `127.0.0.1:3306` (Database: `hkc_trading`)

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Locally in Development Mode
```bash
# Terminal 1: Backend Express API Server (Port 5000)
npm run server

# Terminal 2: Frontend Vite Dev Server (Port 1000, proxies /api to port 5000)
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## Key Credentials & Default Accounts
- **Database**: `hkc_trading` on `127.0.0.1:3306` (User: `habtom`)
- **Superadmin**: `admin` / `SuperadminPassword1!`
- **Reset Admin Script**: `npm run admin:reset`
