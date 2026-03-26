import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { timeEntries, user as userTable, projects, tasks } from "@/db/schema"
import { eq, and, gte, lte } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"
import ExcelJS from "exceljs"

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ['admin', 'coordinador'])
  if (roleError) return roleError

  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const userId = searchParams.get("userId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Build filters
    const conditions = []
    if (projectId && projectId !== "all") conditions.push(eq(timeEntries.projectId, projectId))
    if (userId && userId !== "all") conditions.push(eq(timeEntries.userId, userId))
    if (startDate) conditions.push(gte(timeEntries.date, startDate))
    if (endDate) conditions.push(lte(timeEntries.date, endDate))

    const entries = await db
      .select({
        date: timeEntries.date,
        startTime: timeEntries.startTime,
        endTime: timeEntries.endTime,
        effectiveHours: timeEntries.effectiveHours,
        progressPercentage: timeEntries.progressPercentage,
        pauseCount: timeEntries.pauseCount,
        notes: timeEntries.notes,
        status: timeEntries.status,
        lunchStartTime: timeEntries.lunchStartTime,
        lunchEndTime: timeEntries.lunchEndTime,
        userName: userTable.name,
        userPosition: userTable.position,
        projectName: projects.name,
        taskName: tasks.name,
      })
      .from(timeEntries)
      .leftJoin(userTable, eq(timeEntries.userId, userTable.id))
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(timeEntries.date)

    // Build Excel workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "Ingeniería PASS"
    workbook.created = new Date()

    const sheet = workbook.addWorksheet("Historial de Tiempos", {
      pageSetup: { paperSize: 9, orientation: "landscape" },
    })

    // Column definitions
    sheet.columns = [
      { header: "Fecha", key: "date", width: 14 },
      { header: "Trabajador", key: "userName", width: 22 },
      { header: "Cargo", key: "userPosition", width: 20 },
      { header: "Proyecto", key: "projectName", width: 28 },
      { header: "Tarea", key: "taskName", width: 28 },
      { header: "Inicio", key: "startTime", width: 10 },
      { header: "Fin", key: "endTime", width: 10 },
      { header: "Horas Efectivas", key: "effectiveHours", width: 16 },
      { header: "Avance %", key: "progressPercentage", width: 12 },
      { header: "Pausas", key: "pauseCount", width: 10 },
      { header: "Estado", key: "status", width: 14 },
      { header: "Notas", key: "notes", width: 40 },
    ]

    // Style header row
    const headerRow = sheet.getRow(1)
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
      cell.alignment = { horizontal: "center", vertical: "middle" }
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFAAAAAA" } },
      }
    })
    headerRow.height = 22

    // Status labels
    const STATUS_LABELS: Record<string, string> = {
      trabajando: "Trabajando",
      finalizado: "Finalizado",
      colacion: "Colación",
      pausado: "Pausado",
      inactivo: "Sin iniciar",
    }

    // Data rows
    entries.forEach((entry, idx) => {
      const row = sheet.addRow({
        date: entry.date,
        userName: entry.userName ?? "",
        userPosition: entry.userPosition ?? "",
        projectName: entry.projectName ?? "",
        taskName: entry.taskName ?? "",
        startTime: entry.startTime,
        endTime: entry.endTime ?? "",
        effectiveHours: Number(entry.effectiveHours.toFixed(2)),
        progressPercentage: entry.progressPercentage ?? 0,
        pauseCount: entry.pauseCount ?? 0,
        status: STATUS_LABELS[entry.status] ?? entry.status,
        notes: entry.notes ?? "",
      })

      // Alternate row color
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F7FA" } }
        })
      }

      // Align numbers
      row.getCell("effectiveHours").alignment = { horizontal: "center" }
      row.getCell("progressPercentage").alignment = { horizontal: "center" }
      row.getCell("pauseCount").alignment = { horizontal: "center" }
      row.getCell("startTime").alignment = { horizontal: "center" }
      row.getCell("endTime").alignment = { horizontal: "center" }
    })

    // Auto-filter on header
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `historial_tiempos_${new Date().toISOString().split("T")[0]}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("Export error:", err)
    return NextResponse.json({ error: "Error al generar exportación" }, { status: 500 })
  }
}
