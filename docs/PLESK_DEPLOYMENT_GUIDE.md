# Plesk Hosting & Local MySQL Deployment Guide (HKC-ERP-v5)

This guide walks you through deploying **HKC-ERP-v5** on a **Plesk** server using Plesk's built-in **Node.js Application Manager** and **Local MySQL Database**.

---

## 1. Prerequisites on Plesk

1. **Plesk Obsidian** with **Node.js** Extension installed (Node.js version `20.x` or `22.x` recommended).
2. **MySQL / MariaDB** database server running locally on the server (`127.0.0.1:3306`).
3. Domain or Subdomain created in Plesk (e.g. `erp.yourdomain.com`).

---

## 2. Step 1: Create the Local MySQL Database in Plesk

1. In Plesk, go to **Databases** → **Add Database**.
2. Set:
   - **Database name**: `hkc_erp_v5` (or your preferred name, e.g. `hkc_erp_prod`)
   - **Database server**: `localhost:3306` (or `127.0.0.1:3306`)
   - **Database user name**: `hkc_user`
   - **Password**: `YourStrongPassword123!`
   - **User has access to all databases within the selected subscription**: *Yes*
3. Click **OK** to create the database and user.

---

## 3. Step 2: Upload Application Files

1. Upload the `HKC-ERP-v5` files to the `httpdocs/` directory of your domain in Plesk (via Git, SFTP, or Plesk File Manager).
2. Ensure file permissions are owned by the domain user.

---

## 4. Step 3: Configure Environment Variables (`.env`)

In the root of your project directory (`httpdocs/.env`), create or edit the `.env` file with your Plesk database credentials:

```env
# ==============================================================================
# HKC-ERP-v5 PRODUCTION ENVIRONMENT (PLESK / LOCAL MYSQL)
# ==============================================================================

# Option A: MySQL Connection URL
DATABASE_URL=mysql://hkc_user:YourStrongPassword123!@127.0.0.1:3306/hkc_erp_v5

# Option B: Individual MySQL Parameters
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=hkc_user
DB_PASSWORD=YourStrongPassword123!
DB_NAME=hkc_erp_v5

# Server & Security Settings
PORT=1000
SERVER_HOST=0.0.0.0
JWT_SECRET=super_secret_jwt_random_string_replace_with_own_key_32_chars

# Frontend API URL (Set to your domain URL)
VITE_API_URL=https://erp.yourdomain.com
```

---

## 5. Step 4: Configure Node.js in Plesk

1. In Plesk, go to **Websites & Domains** → select your domain → click **Node.js**.
2. Configure the following settings:
   - **Node.js Version**: `20.x` or `22.x` (Active LTS)
   - **Package Manager**: `npm`
   - **Document Root**: `/httpdocs` (or `/httpdocs/dist`)
   - **Application Root**: `/httpdocs`
   - **Application Startup File**: `server/index.js`
   - **Application Mode**: `production`

---

## 6. Step 5: Install Dependencies, Push Database, & Seed

Open the **Plesk SSH Terminal** (or Plesk **NPM / Run Script** UI) and run:

```bash
# 1. Install all dependencies
npm install

# 2. Automatically create all 31 tables in your MySQL database
npm run db:push

# 3. Seed initial Superadmin user (admin / SuperadminPassword1!)
npm run seed:auth

# 4. Build frontend production assets
npm run build
```

---

## 7. Step 6: Start / Restart Node.js Application

1. In the Plesk Node.js dashboard, click **Restart** (or **Enable Node.js**).
2. Visit `https://erp.yourdomain.com`.
3. Log in with the default credentials:
   - **Username**: `admin`
   - **Password**: `SuperadminPassword1!`
4. Change your password in **Admin → User Management** after initial login.

---

## 8. Troubleshooting & Useful Commands

| Issue | Solution |
| :--- | :--- |
| **`ECONNREFUSED 127.0.0.1:3306`** | Ensure MySQL is running on your server, or use `localhost` / socket. |
| **`ER_ACCESS_DENIED_ERROR`** | Double-check `DB_USER` and `DB_PASSWORD` in `.env`. |
| **404 on page reload** | Plesk `server/index.js` already includes an automatic SPA fallback to `dist/index.html`. Ensure `npm run build` completed successfully. |
| **Reset Admin Password** | Run `node seedAuth.js` or `npm run seed:auth` from the terminal. |
