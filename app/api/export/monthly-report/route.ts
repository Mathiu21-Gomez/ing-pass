import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { timeEntries, user as userTable, projects, tasks } from "@/db/schema"
import { eq, and, gte, lte, ne } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"
import ExcelJS from "exceljs"

function parseTimeToMinutes(time: string | null | undefined): number {
  if (!time) return 0
  const [h, m] = time.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ["admin", "coordinador"])
  if (roleError) return roleError

  try {
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get("month")
    const yearParam = searchParams.get("year")
    const filterUserId = searchParams.get("userId")

    if (!monthParam || !yearParam) {
      return NextResponse.json(
        { error: "Se requieren los parámetros 'month' y 'year'" },
        { status: 400 }
      )
    }

    const month = parseInt(monthParam, 10)
    const year = parseInt(yearParam, 10)

    if (Number.isNaN(month) || Number.isNaN(year) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Mes o año inválido" }, { status: 400 })
    }

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

    // Build filters — always exclude "libre" schedule
    const conditions = [
      gte(timeEntries.date, startDate),
      lte(timeEntries.date, endDate),
      ne(userTable.scheduleType, "libre"),
    ]

    if (filterUserId && filterUserId !== "all") {
      conditions.push(eq(timeEntries.userId, filterUserId))
    }

    const entries = await db
      .select({
        entryId: timeEntries.id,
        date: timeEntries.date,
        startTime: timeEntries.startTime,
        endTime: timeEntries.endTime,
        lunchStartTime: timeEntries.lunchStartTime,
        lunchEndTime: timeEntries.lunchEndTime,
        effectiveHours: timeEntries.effectiveHours,
        status: timeEntries.status,
        notes: timeEntries.notes,
        userId: timeEntries.userId,
        userName: userTable.name,
        userPosition: userTable.position,
        scheduleType: userTable.scheduleType,
        projectName: projects.name,
        taskName: tasks.name,
      })
      .from(timeEntries)
      .innerJoin(userTable, and(eq(timeEntries.userId, userTable.id), ne(userTable.scheduleType, "libre")))
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
      .where(and(...conditions))
      .orderBy(timeEntries.date, userTable.name)

    // Aggregate per user
    type UserSummary = {
      userId: string
      userName: string
      userPosition: string
      daysWorked: number
      totalHours: number
      extraHours: number
      taskSet: Set<string>
      projectSet: Set<string>
      lateCount: number // entries where startTime > "09:00"
    }

    const summaryMap = new Map<string, UserSummary>()

    for (const entry of entries) {
      let s = summaryMap.get(entry.userId)
      if (!s) {
        s = {
          userId: entry.userId,
          userName: entry.userName ?? "",
          userPosition: entry.userPosition ?? "",
          daysWorked: 0,
          totalHours: 0,
          extraHours: 0,
          taskSet: new Set(),
          projectSet: new Set(),
          lateCount: 0,
        }
        summaryMap.set(entry.userId, s)
      }

      s.daysWorked += 1
      s.totalHours += entry.effectiveHours
      if (entry.effectiveHours > 8) {
        s.extraHours += entry.effectiveHours - 8
      }

      if (entry.taskName) s.taskSet.add(entry.taskName)
      if (entry.projectName) s.projectSet.add(entry.projectName)

      const startMins = parseTimeToMinutes(entry.startTime)
      if (startMins > parseTimeToMinutes("09:00")) {
        s.lateCount += 1
      }
    }

    const MONTH_NAMES = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ]
    const monthLabel = MONTH_NAMES[month - 1]

    // Build Excel
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "Ingeniería PASS"
    workbook.created = new Date()

    // ── Sheet 1: Resumen mensual ────────────────────────────────────────
    const summarySheet = workbook.addWorksheet("Resumen Mensual", {
      pageSetup: { paperSize: 9, orientation: "landscape" },
    })

    summarySheet.columns = [
      { header: "Trabajador", key: "userName", width: 26 },
      { header: "Cargo", key: "userPosition", width: 22 },
      { header: "Días trabajados", key: "daysWorked", width: 16 },
      { header: "Total horas", key: "totalHours", width: 14 },
      { header: "Horas extra", key: "extraHours", width: 14 },
      { header: "Prom. horas/día", key: "avgHours", width: 16 },
      { header: "Proyectos", key: "projects", width: 40 },
      { header: "Tareas distintas", key: "taskCount", width: 16 },
      { header: "Llegadas tarde", key: "lateCount", width: 16 },
    ]

    const summaryHeaderRow = summarySheet.getRow(1)
    summaryHeaderRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
      cell.alignment = { horizontal: "center", vertical: "middle" }
      cell.border = { bottom: { style: "thin", color: { argb: "FFAAAAAA" } } }
    })
    summaryHeaderRow.height = 22

    const summaryRows = [...summaryMap.values()].sort((a, b) =>
      a.userName.localeCompare(b.userName, "es")
    )

    summaryRows.forEach((s, idx) => {
      const avgHours = s.daysWorked > 0 ? s.totalHours / s.daysWorked : 0
      const row = summarySheet.addRow({
        userName: s.userName,
        userPosition: s.userPosition,
        daysWorked: s.daysWorked,
        totalHours: Number(s.totalHours.toFixed(2)),
        extraHours: Number(s.extraHours.toFixed(2)),
        avgHours: Number(avgHours.toFixed(2)),
        projects: [...s.projectSet].join(", "),
        taskCount: s.taskSet.size,
        lateCount: s.lateCount,
      })

      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F7FA" } }
        })
      }

      for (const key of ["daysWorked", "totalHours", "extraHours", "avgHours", "taskCount", "lateCount"]) {
        row.getCell(key).alignment = { horizontal: "center" }
      }

      if (s.extraHours > 0) {
        row.getCell("extraHours").font = { bold: true, color: { argb: "FFCC0000" } }
      }
    })

    summarySheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: summarySheet.columns.length },
    }

    // ── Sheet 2: Detalle por día ────────────────────────────────���───────
    const detailSheet = workbook.addWorksheet("Detalle Diario", {
      pageSetup: { paperSize: 9, orientation: "landscape" },
    })

    detailSheet.columns = [
      { header: "Fecha", key: "date", width: 14 },
      { header: "Trabajador", key: "userName", width: 24 },
      { header: "Cargo", key: "userPosition", width: 22 },
      { header: "Proyecto", key: "projectName", width: 28 },
      { header: "Tarea", key: "taskName", width: 28 },
      { header: "Inicio", key: "startTime", width: 10 },
      { header: "Almuerzo", key: "lunch", width: 14 },
      { header: "Fin", key: "endTime", width: 10 },
      { header: "Horas ef.", key: "effectiveHours", width: 12 },
      { header: "Estado", key: "status", width: 14 },
      { header: "Notas", key: "notes", width: 40 },
    ]

    const detailHeaderRow = detailSheet.getRow(1)
    detailHeaderRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
      cell.alignment = { horizontal: "center", vertical: "middle" }
      cell.border = { bottom: { style: "thin", color: { argb: "FFAAAAAA" } } }
    })
    detailHeaderRow.height = 22

    const STATUS_LABELS: Record<string, string> = {
      trabajando: "Trabajando",
      finalizado: "Finalizado",
      colacion: "Colación",
      pausado: "Pausado",
      reunion: "Reunión",
      inactivo: "Sin iniciar",
    }

    entries.forEach((entry, idx) => {
      const lunchStr = entry.lunchStartTime && entry.lunchEndTime
        ? `${entry.lunchStartTime}–${entry.lunchEndTime}`
        : ""

      const row = detailSheet.addRow({
        date: entry.date,
        userName: entry.userName ?? "",
        userPosition: entry.userPosition ?? "",
        projectName: entry.projectName ?? "",
        taskName: entry.taskName ?? "",
        startTime: entry.startTime,
        lunch: lunchStr,
        endTime: entry.endTime ?? "",
        effectiveHours: Number(entry.effectiveHours.toFixed(2)),
        status: STATUS_LABELS[entry.status] ?? entry.status,
        notes: entry.notes ?? "",
      })

      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F7FA" } }
        })
      }

      for (const key of ["startTime", "lunch", "endTime", "effectiveHours"]) {
        row.getCell(key).alignment = { horizontal: "center" }
      }
    })

    detailSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: detailSheet.columns.length },
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `reporte_mensual_${monthLabel.toLowerCase()}_${year}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("Monthly report error:", err)
    return NextResponse.json({ error: "Error al generar reporte mensual" }, { status: 500 })
  }
}
