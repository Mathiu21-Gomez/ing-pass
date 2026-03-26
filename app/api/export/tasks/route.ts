import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { tasks, projects, taskAssignments, user as userTable, taskTags, tags } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"
import ExcelJS from "exceljs"

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En Curso",
  esperando_info: "Esperando Info",
  bloqueado: "Bloqueado",
  listo_para_revision: "Listo para Revisión",
  finalizado: "Finalizado",
  retrasado: "Retrasado",
}

const STATUS_COLORS: Record<string, string> = {
  pendiente: "FFE2E8F0",
  en_curso: "FFDBEAFE",
  esperando_info: "FFFEF9C3",
  bloqueado: "FFFEE2E2",
  listo_para_revision: "FFEDE9FE",
  finalizado: "FFD1FAE5",
  retrasado: "FFFFEDD5",
}

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ['admin', 'coordinador'])
  if (roleError) return roleError

  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const status = searchParams.get("status")

    const conditions = []
    if (projectId && projectId !== "all") conditions.push(eq(tasks.projectId, projectId))
    if (status && status !== "all") conditions.push(eq(tasks.status, status as "pendiente" | "en_curso" | "esperando_info" | "bloqueado" | "listo_para_revision" | "finalizado" | "retrasado"))

    const taskList = await db
      .select({
        id: tasks.id,
        correlativeId: tasks.correlativeId,
        name: tasks.name,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        createdAt: tasks.createdAt,
        projectName: projects.name,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(tasks.correlativeId)

    // Get assignments and tags for each task
    const enriched = await Promise.all(
      taskList.map(async (task) => {
        const assigns = await db
          .select({ name: userTable.name })
          .from(taskAssignments)
          .innerJoin(userTable, eq(taskAssignments.userId, userTable.id))
          .where(eq(taskAssignments.taskId, task.id))

        const taskTagRows = await db
          .select({ name: tags.name })
          .from(taskTags)
          .innerJoin(tags, eq(taskTags.tagId, tags.id))
          .where(eq(taskTags.taskId, task.id))

        return {
          ...task,
          assignedTo: assigns.map((a) => a.name).join(", "),
          tags: taskTagRows.map((t) => t.name).join(", "),
        }
      })
    )

    // Build Excel
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "Ingeniería PASS"
    workbook.created = new Date()

    const sheet = workbook.addWorksheet("Tareas", {
      pageSetup: { paperSize: 9, orientation: "landscape" },
    })

    sheet.columns = [
      { header: "ID", key: "correlativeId", width: 8 },
      { header: "Proyecto", key: "projectName", width: 26 },
      { header: "Tarea", key: "name", width: 36 },
      { header: "Estado", key: "status", width: 20 },
      { header: "Prioridad", key: "priority", width: 12 },
      { header: "Asignado a", key: "assignedTo", width: 26 },
      { header: "Etiquetas", key: "tags", width: 22 },
      { header: "Vencimiento", key: "dueDate", width: 14 },
      { header: "Creada", key: "createdAt", width: 14 },
    ]

    // Header style
    const headerRow = sheet.getRow(1)
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
      cell.alignment = { horizontal: "center", vertical: "middle" }
    })
    headerRow.height = 22

    enriched.forEach((task) => {
      const row = sheet.addRow({
        correlativeId: `#${task.correlativeId}`,
        projectName: task.projectName ?? "",
        name: task.name,
        status: STATUS_LABELS[task.status] ?? task.status,
        priority: task.priority,
        assignedTo: task.assignedTo,
        tags: task.tags,
        dueDate: task.dueDate ?? "",
        createdAt: new Date(task.createdAt).toLocaleDateString("es-CL"),
      })

      // Color status cell
      const statusCell = row.getCell("status")
      const bgColor = STATUS_COLORS[task.status] ?? "FFFFFFFF"
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } }
      statusCell.alignment = { horizontal: "center" }
      row.getCell("correlativeId").alignment = { horizontal: "center" }
      row.getCell("priority").alignment = { horizontal: "center" }
      row.getCell("dueDate").alignment = { horizontal: "center" }
      row.getCell("createdAt").alignment = { horizontal: "center" }
    })

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `tareas_${new Date().toISOString().split("T")[0]}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("Export tasks error:", err)
    return NextResponse.json({ error: "Error al exportar tareas" }, { status: 500 })
  }
}
