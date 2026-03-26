import dotenv from "dotenv"
dotenv.config()

import { neon } from "@neondatabase/serverless"

async function cleanup() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida en .env")
  }

  const sql = neon(process.env.DATABASE_URL)

  const result = await sql`
    DELETE FROM messages
    WHERE id IN (
      '9e6967fe-c30c-4035-b94d-2e849a31216b',
      '16d17165-28ec-4cd8-be31-583762abb92e',
      '48b8602b-77a3-4237-83e9-fbef4923a154',
      '834862f1-a091-4c40-a335-a7e131af1c6a'
    )
    RETURNING id, content
  `

  if (result.length === 0) {
    console.log("ℹ️  No se encontraron mensajes con esos IDs.")
  } else {
    console.log(`✅ Eliminados ${result.length} mensaje(s):`)
    for (const row of result) {
      console.log(`   - [${row.id}] "${row.content}"`)
    }
  }
}

cleanup().catch((err) => {
  console.error("❌ Error en cleanup:", err)
  process.exit(1)
})
