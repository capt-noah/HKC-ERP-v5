import bcrypt from "bcryptjs"
import readline from "readline"
import { drizzleUpdateRow, drizzleListRows, drizzleCreateRow } from "../db/drizzleCrud.js"
import { getResource } from "../db/resourceRegistry.js"
import { validateStrongPassword } from "../modules/auth/authUtils.js"

function prompt(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close()
      resolve(ans.trim())
    })
  )
}

function parseArgs() {
  const args = process.argv.slice(2)
  let username = ""
  let password = ""

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--user" || args[i] === "-u") {
      username = args[i + 1] || ""
      i++
    } else if (args[i] === "--password" || args[i] === "-p") {
      password = args[i + 1] || ""
      i++
    }
  }
  return { username, password }
}

async function main() {
  console.log("\n=======================================================")
  console.log("🔐 HKC ERP — Emergency Admin / User Password Reset CLI")
  console.log("=======================================================\n")

  let { username, password } = parseArgs()

  if (!username) {
    username = await prompt("Enter username (default: 'admin'): ") || "admin"
  }

  const usersRes = getResource("users")
  const list = await drizzleListRows({ resource: usersRes, query: { username: `eq.${username}` } })
  const user = Array.isArray(list.body) && list.body.length > 0 ? list.body[0] : null

  if (!user) {
    if (username === "admin") {
      console.log(`⚠️  Superadmin user 'admin' does not exist yet. It will be created.`)
    } else {
      console.error(`❌ User '${username}' not found in database.`)
      process.exit(1)
    }
  }

  while (!password) {
    const input = await prompt(`Enter new password for '${username}': `)
    const check = validateStrongPassword(input)
    if (!check.valid) {
      console.log(`⚠️  ${check.error}. Please try again.`)
    } else {
      password = input
    }
  }

  const passCheck = validateStrongPassword(password)
  if (!passCheck.valid) {
    console.error(`❌ Password does not meet security requirements: ${passCheck.error}`)
    process.exit(1)
  }

  console.log(`\n⏳ Hashing password with bcrypt (cost factor 10)...`)
  const password_hash = await bcrypt.hash(password, 10)

  if (user) {
    await drizzleUpdateRow({
      resource: usersRes,
      id: user.id,
      body: {
        password_hash,
        status: "active",
        is_active: 1,
      },
    })
    console.log(`\n✅ SUCCESS! Password for user '${username}' has been reset.`)
    console.log(`   Username: ${username}`)
    console.log(`   Account Status: active`)
    console.log(`   You can now log in at http://localhost:3000/login\n`)
  } else {
    await drizzleCreateRow({
      resource: usersRes,
      body: {
        id: `USR-${Date.now()}`,
        username: "admin",
        password_hash,
        roles: ["superadmin"],
        role: "superadmin",
        fullname: "Administrator",
        status: "active",
        is_active: 1,
      },
    })
    console.log(`\n✅ SUCCESS! Superadmin account 'admin' created with new credentials.`)
    console.log(`   Username: admin`)
    console.log(`   Roles: superadmin`)
    console.log(`   You can now log in at http://localhost:3000/login\n`)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error("Fatal error resetting password:", err)
  process.exit(1)
})
