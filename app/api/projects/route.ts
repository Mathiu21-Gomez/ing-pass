import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import {
  projects,
  projectWorkers,
  projectUrls,
  tasks,
  taskAssignments,
  taskTags,
  tags,
  activities,
  documents,
  clients,
} from "@/db/schema"
import { projectSchema } from "@/lib/schemas"
import { eq, inArray } from "drizzle-orm"
import { getAuthUser, requireRole } from "@/lib/api-auth"

function toProjectResponse<T extends Record<string, unknown>>(
  project: T,
  assignedWorkers: string[]
) {
  return {
    ...project,
    assignedWorkers,
    tasks: [],
    documents: [],
    urls: [],
  }
}

export async function GET(request: NextRequest) {
  const { user: authUser, error } = await getAuthUser(request)
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const clientId = searchParams.get("clientId")

    if (authUser.role === 'externo') {
      const matchingClient = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.email, authUser.email))
        .limit(1)

      if (matchingClient.length === 0) {
        return NextResponse.json([])
      }

      const allProjects = await db.select().from(projects).where(eq(projects.clientId, matchingClient[0].id))

      if (allProjects.length === 0) {
        return NextResponse.json([])
      }

      const projectIds = allProjects.map((p) => p.id)

      const [allWorkers, allUrls, allTasks, allProjectDocs] = await Promise.all([
        db.select().from(projectWorkers).where(inArray(projectWorkers.projectId, projectIds)),
        db.select().from(projectUrls).where(inArray(projectUrls.projectId, projectIds)),
        db.select().from(tasks).where(inArray(tasks.projectId, projectIds)),
        db.select().from(documents).where(inArray(documents.projectId, projectIds)),
      ])

      const taskIds = allTasks.map((t) => t.id)
      const [allAssignments, allActivities, allTaskDocs, allTaskTags] =
        taskIds.length > 0
          ? await Promise.all([
              db.select().from(taskAssignments).where(inArray(taskAssignments.taskId, taskIds)),
              db.select().from(activities).where(inArray(activities.taskId, taskIds)),
              db.select().from(documents).where(inArray(documents.taskId, taskIds)),
              db.select({ taskId: taskTags.taskId, id: tags.id, name: tags.name, color: tags.color, projectId: tags.projectId, createdBy: tags.createdBy, createdAt: tags.createdAt })
                .from(taskTags)
                .innerJoin(tags, eq(taskTags.tagId, tags.id))
                .where(inArray(taskTags.taskId, taskIds)),
            ])
          : [[], [], [], []]

      const workersByProject = new Map<string, string[]>()
      for (const w of allWorkers) {
        const list = workersByProject.get(w.projectId) ?? []
        list.push(w.userId)
        workersByProject.set(w.projectId, list)
      }

      const urlsByProject = new Map<string, { label: string; url: string }[]>()
      for (const u of allUrls) {
        const list = urlsByProject.get(u.projectId) ?? []
        list.push({ label: u.label, url: u.url })
        urlsByProject.set(u.projectId, list)
      }

      const tasksByProject = new Map<string, typeof allTasks>()
      for (const t of allTasks) {
        const list = tasksByProject.get(t.projectId) ?? []
        list.push(t)
        tasksByProject.set(t.projectId, list)
      }

      const docsByProject = new Map<string, typeof allProjectDocs>()
      for (const d of allProjectDocs) {
        const list = docsByProject.get(d.projectId!) ?? []
        list.push(d)
        docsByProject.set(d.projectId!, list)
      }

      const assignmentsByTask = new Map<string, string[]>()
      for (const a of allAssignments) {
        const list = assignmentsByTask.get(a.taskId) ?? []
        list.push(a.userId)
        assignmentsByTask.set(a.taskId, list)
      }

      const activitiesByTask = new Map<string, typeof allActivities>()
      for (const a of allActivities) {
        const list = activitiesByTask.get(a.taskId!) ?? []
        list.push(a)
        activitiesByTask.set(a.taskId!, list)
      }

      const docsByTask = new Map<string, typeof allTaskDocs>()
      for (const d of allTaskDocs) {
        const list = docsByTask.get(d.taskId!) ?? []
        list.push(d)
        docsByTask.set(d.taskId!, list)
      }

      const tagsByTask = new Map<string, { id: string; name: string; color: string; projectId: string | null; createdBy: string; createdAt: Date | string }[]>()
      for (const t of allTaskTags) {
        const list = tagsByTask.get(t.taskId) ?? []
        list.push({ id: t.id, name: t.name, color: t.color, projectId: t.projectId, createdBy: t.createdBy, createdAt: t.createdAt })
        tagsByTask.set(t.taskId, list)
      }

      const enriched = allProjects.map((project) => {
        const projectTaskList = tasksByProject.get(project.id) ?? []
        return {
          ...project,
          assignedWorkers: workersByProject.get(project.id) ?? [],
          urls: urlsByProject.get(project.id) ?? [],
          tasks: projectTaskList.map((task) => ({
            ...task,
            assignedTo: assignmentsByTask.get(task.id) ?? [],
            activities: activitiesByTask.get(task.id) ?? [],
            documents: docsByTask.get(task.id) ?? [],
            tags: tagsByTask.get(task.id) ?? [],
          })),
          documents: docsByProject.get(project.id) ?? [],
        }
      })

      return NextResponse.json(enriched)
    }

    let query = db.select().from(projects)

    if (status) {
      query = query.where(eq(projects.status, status as "Activo" | "Pausado" | "Finalizado")) as typeof query
    }
    if (clientId) {
      query = query.where(eq(projects.clientId, clientId)) as typeof query
    }

    const allProjects = await query

    if (allProjects.length === 0) {
      return NextResponse.json([])
    }

    const projectIds = allProjects.map((p) => p.id)

    // Batch fetch: todos los datos relacionados a proyectos en paralelo
    const [allWorkers, allUrls, allTasks, allProjectDocs] = await Promise.all([
      db.select().from(projectWorkers).where(inArray(projectWorkers.projectId, projectIds)),
      db.select().from(projectUrls).where(inArray(projectUrls.projectId, projectIds)),
      db.select().from(tasks).where(inArray(tasks.projectId, projectIds)),
      db.select().from(documents).where(inArray(documents.projectId, projectIds)),
    ])

    // Batch fetch: todos los datos relacionados a tareas en paralelo
    const taskIds = allTasks.map((t) => t.id)
    const [allAssignments, allActivities, allTaskDocs, allTaskTags] =
      taskIds.length > 0
        ? await Promise.all([
            db.select().from(taskAssignments).where(inArray(taskAssignments.taskId, taskIds)),
            db.select().from(activities).where(inArray(activities.taskId, taskIds)),
            db.select().from(documents).where(inArray(documents.taskId, taskIds)),
            db.select({ taskId: taskTags.taskId, id: tags.id, name: tags.name, color: tags.color, projectId: tags.projectId, createdBy: tags.createdBy, createdAt: tags.createdAt })
              .from(taskTags)
              .innerJoin(tags, eq(taskTags.tagId, tags.id))
              .where(inArray(taskTags.taskId, taskIds)),
          ])
        : [[], [], [], []]

    // Lookup maps O(1)
    const workersByProject = new Map<string, string[]>()
    for (const w of allWorkers) {
      const list = workersByProject.get(w.projectId) ?? []
      list.push(w.userId)
      workersByProject.set(w.projectId, list)
    }

    const urlsByProject = new Map<string, { label: string; url: string }[]>()
    for (const u of allUrls) {
      const list = urlsByProject.get(u.projectId) ?? []
      list.push({ label: u.label, url: u.url })
      urlsByProject.set(u.projectId, list)
    }

    const tasksByProject = new Map<string, typeof allTasks>()
    for (const t of allTasks) {
      const list = tasksByProject.get(t.projectId) ?? []
      list.push(t)
      tasksByProject.set(t.projectId, list)
    }

    const docsByProject = new Map<string, typeof allProjectDocs>()
    for (const d of allProjectDocs) {
      const list = docsByProject.get(d.projectId!) ?? []
      list.push(d)
      docsByProject.set(d.projectId!, list)
    }

    const assignmentsByTask = new Map<string, string[]>()
    for (const a of allAssignments) {
      const list = assignmentsByTask.get(a.taskId) ?? []
      list.push(a.userId)
      assignmentsByTask.set(a.taskId, list)
    }

    const activitiesByTask = new Map<string, typeof allActivities>()
    for (const a of allActivities) {
      const list = activitiesByTask.get(a.taskId!) ?? []
      list.push(a)
      activitiesByTask.set(a.taskId!, list)
    }

    const docsByTask = new Map<string, typeof allTaskDocs>()
    for (const d of allTaskDocs) {
      const list = docsByTask.get(d.taskId!) ?? []
      list.push(d)
      docsByTask.set(d.taskId!, list)
    }

    const tagsByTask = new Map<string, { id: string; name: string; color: string; projectId: string | null; createdBy: string; createdAt: Date | string }[]>()
    for (const t of allTaskTags) {
      const list = tagsByTask.get(t.taskId) ?? []
      list.push({ id: t.id, name: t.name, color: t.color, projectId: t.projectId, createdBy: t.createdBy, createdAt: t.createdAt })
      tagsByTask.set(t.taskId, list)
    }

    // Armar respuesta en memoria
    const enriched = allProjects.map((project) => {
      const projectTaskList = tasksByProject.get(project.id) ?? []
      return {
        ...project,
        assignedWorkers: workersByProject.get(project.id) ?? [],
        urls: urlsByProject.get(project.id) ?? [],
        tasks: projectTaskList.map((task) => ({
          ...task,
          assignedTo: assignmentsByTask.get(task.id) ?? [],
          activities: activitiesByTask.get(task.id) ?? [],
          documents: docsByTask.get(task.id) ?? [],
          tags: tagsByTask.get(task.id) ?? [],
        })),
        documents: docsByProject.get(project.id) ?? [],
      }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json(
      { error: "Error al obtener proyectos" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request)
  if (error) return error

  const roleError = requireRole(user, ['admin', 'coordinador'])
  if (roleError) return roleError

  try {
    const body = await request.json()
    const parsed = projectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { assignedWorkers, ...projectData } = parsed.data

    const [newProject] = await db
      .insert(projects)
      .values(projectData)
      .returning()

    if (assignedWorkers.length > 0) {
      await db.insert(projectWorkers).values(
        assignedWorkers.map((userId) => ({
          projectId: newProject.id,
          userId,
        }))
      )
    }

    return NextResponse.json(toProjectResponse(newProject, assignedWorkers), {
      status: 201,
    })
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json(
      { error: "Error al crear proyecto" },
      { status: 500 }
    )
  }
}
