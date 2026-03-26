import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { tasks, taskAssignments, activities, documents, projectWorkers, taskTags, tags } from "@/db/schema"
import { taskSchema } from "@/lib/schemas"
import { and, eq, inArray, max } from "drizzle-orm"
import { getAuthUser } from "@/lib/api-auth"
import { getProjectAccessContext } from "@/lib/project-access"

const CORRELATIVE_CONSTRAINT = "tasks_project_correlative_unique"
const MAX_CORRELATIVE_RETRIES = 3

type TaskCreateValues = {
  name: string
  description: string
  guidelines: string
  priority: number
  projectId: string
  createdBy: string
  dueDate: string | null
  status: "pendiente" | "en_curso" | "esperando_info" | "bloqueado" | "listo_para_revision" | "finalizado" | "retrasado"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isCorrelativeConflict(error: unknown) {
  return isRecord(error)
    && error.code === "23505"
    && error.constraint === CORRELATIVE_CONSTRAINT
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error
  try {
    const { id: projectId } = await params
    const { context, error: accessError } = await getProjectAccessContext(projectId, authUser)
    if (accessError) return accessError

    const projectTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, context.projectId))

    const enriched = await Promise.all(
      projectTasks.map(async (task) => {
        const assigns = await db
          .select()
          .from(taskAssignments)
          .where(eq(taskAssignments.taskId, task.id))

        const taskActivities = await db
          .select()
          .from(activities)
          .where(eq(activities.taskId, task.id))

        const taskDocs = await db
          .select()
          .from(documents)
          .where(eq(documents.taskId, task.id))

        const taskTagRows = await db
          .select({ id: tags.id, name: tags.name, color: tags.color, projectId: tags.projectId, createdBy: tags.createdBy, createdAt: tags.createdAt })
          .from(taskTags)
          .innerJoin(tags, eq(taskTags.tagId, tags.id))
          .where(eq(taskTags.taskId, task.id))

        return {
          ...task,
          assignedTo: assigns.map((a) => a.userId),
          activities: taskActivities,
          documents: taskDocs,
          tags: taskTagRows,
        }
      })
    )

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Error fetching project tasks:", error)
    return NextResponse.json(
      { error: "Error al obtener tareas del proyecto" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: authUser, error: authError } = await getAuthUser(request)
  if (authError) return authError

  try {
    const { id: projectId } = await params
    const { context, error: accessError } = await getProjectAccessContext(projectId, authUser)
    if (accessError) return accessError

    const body = await request.json()
    const parsed = taskSchema.safeParse(body)
    const isWorkerRequester = authUser.role === "trabajador"

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (!isWorkerRequester && body.assignedTo !== undefined && !isStringArray(body.assignedTo)) {
      return NextResponse.json(
        { error: "assignedTo debe ser un array de strings" },
        { status: 400 }
      )
    }

    if (body.tagIds !== undefined && !isStringArray(body.tagIds)) {
      return NextResponse.json(
        { error: "tagIds debe ser un array de strings" },
        { status: 400 }
      )
    }

    const assignedTo = isWorkerRequester
      ? [authUser.id]
      : uniqueStrings(body.assignedTo ?? [])
    const tagIds = uniqueStrings(body.tagIds ?? [])
    const createdBy: string = authUser.id
    const isExternalRequester = authUser.role === "externo"
    const taskValues: TaskCreateValues = {
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      guidelines: isExternalRequester ? "" : body.guidelines ?? "",
      priority: isExternalRequester ? 0 : body.priority ?? 0,
      projectId: context.projectId,
      createdBy,
      dueDate: parsed.data.dueDate || null,
      status: isExternalRequester ? "listo_para_revision" : body.status ?? "pendiente",
    }

    if (isExternalRequester && assignedTo.length > 0) {
      return NextResponse.json(
        { error: "Los clientes externos no pueden asignar trabajadores al crear tareas" },
        { status: 403 }
      )
    }

    if (isExternalRequester && tagIds.length > 0) {
      return NextResponse.json(
        { error: "Los clientes externos no pueden agregar etiquetas al crear tareas" },
        { status: 403 }
      )
    }

    if (assignedTo.length > 0) {
      const validAssignments = await db
        .select({ userId: projectWorkers.userId })
        .from(projectWorkers)
        .where(
          and(
            eq(projectWorkers.projectId, context.projectId),
            inArray(projectWorkers.userId, assignedTo)
          )
        )

      if (validAssignments.length !== assignedTo.length) {
        return NextResponse.json(
          { error: "Hay trabajadores que no pertenecen al proyecto" },
          { status: 400 }
        )
      }
    }

    if (tagIds.length > 0) {
      const existingTags = await db
        .select({ id: tags.id, projectId: tags.projectId })
        .from(tags)
        .where(inArray(tags.id, tagIds))

      const validTags = existingTags.filter((tag) => tag.projectId === context.projectId)

      if (validTags.length !== tagIds.length) {
        return NextResponse.json(
          { error: "Hay etiquetas que no pertenecen al proyecto de la tarea" },
          { status: 400 }
        )
      }
    }

    let newTask: typeof tasks.$inferSelect | undefined

    for (let attempt = 1; attempt <= MAX_CORRELATIVE_RETRIES; attempt += 1) {
      try {
        newTask = await db.transaction(async (tx) => {
          const maxResult = await tx
            .select({ maxId: max(tasks.correlativeId) })
            .from(tasks)
            .where(eq(tasks.projectId, context.projectId))
          const nextCorrelativeId = (maxResult[0]?.maxId ?? 0) + 1

          const [createdTask] = await tx
            .insert(tasks)
            .values({
              ...taskValues,
              correlativeId: nextCorrelativeId,
            })
            .returning()

          if (assignedTo.length > 0) {
            await tx.insert(taskAssignments).values(
              assignedTo.map((userId) => ({ taskId: createdTask.id, userId }))
            )
          }

          if (tagIds.length > 0) {
            await tx.insert(taskTags).values(
              tagIds.map((tagId) => ({ taskId: createdTask.id, tagId }))
            )
          }

          return createdTask
        })

        break
      } catch (error) {
        if (attempt < MAX_CORRELATIVE_RETRIES && isCorrelativeConflict(error)) {
          continue
        }

        throw error
      }
    }

    if (!newTask) {
      return NextResponse.json(
        { error: "No se pudo reservar un correlativo para la tarea" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { ...newTask, assignedTo, activities: [], documents: [], tags: [] },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json(
      { error: "Error al crear tarea" },
      { status: 500 }
    )
  }
}
