import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getAuthUser, requireRole } from "@/lib/api-auth"

/**
 * POST /api/migrate/task-status
 *
 * Endpoint de migración UNA SOLA VEZ — ejecutar antes de pnpm db:push.
 * Migra los valores del enum task_status antiguo al nuevo:
 *   abierta              → pendiente
 *   cerrada              → finalizado
 *   pendiente_aprobacion → listo_para_revision
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MIGRATIONS !== "true") {
    return NextResponse.json({ error: "Deshabilitado en producción" }, { status: 403 })
  }

  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ["admin"])
  if (roleError) return roleError

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL no definida" }, { status: 500 })
  }

  const sql = neon(process.env.DATABASE_URL)

  try {
    // Paso 1: Agregar nuevos valores al enum existente
    // ALTER TYPE ADD VALUE no puede correr dentro de una transacción — neon http auto-commitea cada statement
    await sql`ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'pendiente'`
    await sql`ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'en_curso'`
    await sql`ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'esperando_info'`
    await sql`ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'bloqueado'`
    await sql`ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'listo_para_revision'`
    await sql`ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'finalizado'`
    await sql`ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'retrasado'`

    // Paso 2: Migrar filas existentes a los nuevos valores
    await sql`UPDATE tasks SET status = 'pendiente' WHERE status::text = 'abierta'`
    await sql`UPDATE tasks SET status = 'finalizado' WHERE status::text = 'cerrada'`
    await sql`UPDATE tasks SET status = 'listo_para_revision' WHERE status::text = 'pendiente_aprobacion'`

    // Verificación
    const remaining = await sql`
      SELECT status::text, COUNT(*) as count
      FROM tasks
      WHERE status::text IN ('abierta', 'cerrada', 'pendiente_aprobacion')
      GROUP BY status::text
    `

    return NextResponse.json({
      success: true,
      message: remaining.length === 0
        ? "Migración completada. Ahora podés correr pnpm db:push."
        : "Migración parcial — todavía hay filas con valores viejos.",
      oldValuesRemaining: remaining,
    })
  } catch (err) {
    console.error("Migration error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
