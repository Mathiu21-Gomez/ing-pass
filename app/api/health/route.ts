import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/db"
import { getEnv } from "@/lib/env"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    getEnv()
    await db.execute(sql`select 1`)

    return NextResponse.json({
      ok: true,
      env: { configured: true },
      db: { reachable: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        ok: false,
        env: { configured: !message.includes("Variables de entorno invalidas") },
        db: { reachable: false },
        error: message,
      },
      { status: 500 }
    )
  }
}
