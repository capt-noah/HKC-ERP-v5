import bcrypt from "bcryptjs"
import { drizzleCreateRow, drizzleUpdateRow, drizzleListRows } from "./server/db/drizzleCrud.js"
import { getResource } from "./server/db/resourceRegistry.js"

async function seedSuperAdmin() {
  console.log("Seeding / updating initial superadmin user...")
  const username = "admin"
  const password = "adminPassword123!"

  try {
    const password_hash = await bcrypt.hash(password, 10)
    const resource = getResource("users")
    
    const existing = await drizzleListRows({ resource, query: { username: `eq.${username}` } })
    const user = Array.isArray(existing.body) && existing.body.length > 0 ? existing.body[0] : null

    if (user) {
      await drizzleUpdateRow({
        resource,
        id: user.id,
        body: { password_hash, status: "active" }
      })
      console.log(`✓ Superadmin password updated! Username: admin | Password: ${password}`)
    } else {
      await drizzleCreateRow({
        resource,
        body: { 
          username, 
          password_hash, 
          roles: ["superadmin"],
          role: "superadmin",
          status: "active",
          fullname: "Administrator"
        },
      })
      console.log(`✓ Superadmin created! Username: admin | Password: ${password}`)
    }
  } catch (err) {
    console.error("Error seeding auth:", err)
  }
}

seedSuperAdmin()
