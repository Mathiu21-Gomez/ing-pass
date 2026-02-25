import dotenv from "dotenv"
dotenv.config()

import { neon } from "@neondatabase/serverless"

async function reset() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida en .env")
  }

  const sql = neon(process.env.DATABASE_URL)

  console.log("🗑️  Eliminando schema public...")
  await sql`DROP SCHEMA public CASCADE`

  console.log("📦 Recreando schema public...")
  await sql`CREATE SCHEMA public`

  console.log("✅ Schema reseteado correctamente.")
}

reset().catch((err) => {
  console.error("❌ Error en reset:", err)
  process.exit(1)
})
