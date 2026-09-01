import bcrypt from "bcrypt"
import { drizzleCreateRow } from "./server/db/drizzleCrud.js"
import crypto from "node:crypto"

async function seedSuperAdmin() {
  console.log("Seeding initial superadmin user into MySQL...")
  const username = "admin"
  const password = "SuperadminPassword1!" // Standard initial password

  try {
    const password_hash = await bcrypt.hash(password, 10)
    
    const response = await drizzleCreateRow({
      resource: { table: "users", storage: "direct" },
      body: { 
        id: "USR-SUPERADMIN-01",
        username, 
        password_hash, 
        role: "superadmin",
        roles: ["superadmin"],
        first_name: "Super",
        last_name: "Admin",
        fullname: "Super Administrator",
        is_active: true,
        status: "active",
      },
    })
    
    if (response.status >= 400) {
      if (JSON.stringify(response.body).includes("duplicate") || JSON.stringify(response.body).includes("ER_DUP_ENTRY")) {
        console.log("Superadmin already exists.")
      } else {
        console.error("Failed to seed superadmin:", response.body)
      }
    } else {
      console.log("Superadmin seeded successfully! Username: admin | Password: SuperadminPassword1!")
    }
  } catch (err) {
    console.error("Error seeding auth:", err)
  }
}

seedSuperAdmin()
