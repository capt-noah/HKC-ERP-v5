# HKC-ERP-v5

Enterprise Resource Planning system powered by React 19, TypeScript, Express, MySQL, and Drizzle ORM.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and configure your MySQL database credentials:
```bash
cp .env.example .env
```

### 3. Database Setup & Migrations
```bash
# Push schema to MySQL database
npm run db:push

# Seed default Superadmin user (admin / SuperadminPassword1!)
npm run seed:auth
```

### 4. Run Development Servers
```bash
# Start frontend (Vite)
npm run dev

# Start backend API server (Express + MySQL)
npm run server
```

### 5. Build for Production
```bash
npm run build
```

## Documentation
For complete database design, Drizzle schema breakdown, and deployment options, see [DATABASE_ARCHITECTURE.md](docs/DATABASE_ARCHITECTURE.md).
