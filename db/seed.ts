import dotenv from "dotenv"
dotenv.config()

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { hashPassword } from "better-auth/crypto"
import { sql } from "drizzle-orm"
import * as schema from "./schema"

const today = new Date()
const formatDate = (d: Date) => d.toISOString().split("T")[0]

function getPastDate(daysAgo: number) {
  const d = new Date(today)
  d.setDate(d.getDate() - daysAgo)
  return d
}

function getFutureDate(daysAhead: number) {
  const d = new Date(today)
  d.setDate(d.getDate() + daysAhead)
  return d
}

// Default password for all accounts
const DEFAULT_PASSWORD = "Pass1234!"

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida en .env")
  }

  const sqlClient = neon(process.env.DATABASE_URL)
  const db = drizzle(sqlClient, { schema })

  console.log("🌱 Iniciando seed de la base de datos...")

  // Hash the default password
  console.log("  → Generando hash de contraseña...")
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD)

  // ── Clean existing data (reverse FK order) ──
  console.log("  → Limpiando datos existentes...")
  await db.delete(schema.timeEntries)
  await db.delete(schema.comments)
  await db.delete(schema.documents)
  await db.delete(schema.activities)
  await db.delete(schema.taskAssignments)
  await db.delete(schema.tasks)
  await db.delete(schema.projectUrls)
  await db.delete(schema.projectWorkers)
  await db.delete(schema.projects)
  await db.delete(schema.clients)
  await db.delete(schema.account)
  await db.delete(schema.session)
  await db.delete(schema.user)

  // ══════════════════════════════════════════════
  // Users — 1 per role
  // ══════════════════════════════════════════════
  console.log("  → Insertando usuarios...")

  // Better Auth uses text IDs — we generate stable ones for referencing
  const adminId = "usr_admin_001"
  const coordinadorId = "usr_coord_001"
  const trabajadorId = "usr_trab_001"
  const externoId = "usr_ext_001"

  const usersData = [
    {
      id: adminId,
      name: "Matías Gómez",
      email: "admin@ingpass.cl",
      role: "admin",
      position: "Gerente de Operaciones",
      emailPersonal: "admin.personal@gmail.com",
      scheduleType: "fijo",
      active: true,
    },
    {
      id: coordinadorId,
      name: "Patricia Vega Ruiz",
      email: "coordinador@ingpass.cl",
      role: "coordinador",
      position: "Coordinadora de Proyectos",
      emailPersonal: "pvega@gmail.com",
      scheduleType: "fijo",
      active: true,
    },
    {
      id: trabajadorId,
      name: "Juan Pérez González",
      email: "trabajador@ingpass.cl",
      role: "trabajador",
      position: "Ingeniero Civil",
      emailPersonal: "jperez@gmail.com",
      scheduleType: "fijo",
      workerStatus: "disponible",
      active: true,
    },
    {
      id: externoId,
      name: "Carlos Mendoza",
      email: "externo@ingpass.cl",
      role: "externo",
      position: "Jefe de Proyectos - Minera Los Andes",
      emailPersonal: "cmendoza@gmail.com",
      scheduleType: "fijo",
      active: true,
    },
  ]

  await db.insert(schema.user).values(
    usersData.map((u) => ({
      ...u,
      emailVerified: true,
      updatedAt: new Date(),
    }))
  )

  // ── User Schedules ──
  console.log("  → Insertando horarios semanales...")

  // Helper to build 7-day schedule
  function makeSchedule(
    userId: string,
    weekday: { start: string; end: string },
    friday?: { start: string; end: string }
  ) {
    return Array.from({ length: 7 }, (_, i) => ({
      userId,
      dayOfWeek: i,
      startTime: i === 4 && friday ? friday.start : weekday.start,
      endTime: i === 4 && friday ? friday.end : weekday.end,
      isWorkingDay: i < 5, // Lun-Vie = laboral
      reason: "",
    }))
  }

  await db.insert(schema.userSchedules).values([
    ...makeSchedule(adminId, { start: "08:00", end: "17:00" }),
    ...makeSchedule(coordinadorId, { start: "08:00", end: "17:00" }),
    // Trabajador: Lun-Jue 08:00-17:30, Vie 08:00-16:00
    ...makeSchedule(trabajadorId, { start: "08:00", end: "17:30" }, { start: "08:00", end: "16:00" }),
    ...makeSchedule(externoId, { start: "08:00", end: "17:00" }),
  ])

  // ── Auth accounts ──
  console.log("  → Insertando cuentas de autenticación...")
  await db.insert(schema.account).values(
    usersData.map((u) => ({
      id: `acc_${u.id}`,
      accountId: u.id,
      providerId: "credential",
      userId: u.id,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  )

  // ══════════════════════════════════════════════
  // Client — the external user's company
  // ══════════════════════════════════════════════
  console.log("  → Insertando cliente...")

  const [client] = await db
    .insert(schema.clients)
    .values({
      name: "Minera Los Andes SpA",
      rut: "76.123.456-7",
      contact: "Carlos Mendoza",
      email: "externo@ingpass.cl",
      address: "Av. Providencia 1234, Santiago",
    })
    .returning({ id: schema.clients.id })

  const clientId = client.id

  // ══════════════════════════════════════════════
  // Project — all users participate
  // ══════════════════════════════════════════════
  console.log("  → Insertando proyecto...")

  const [project] = await db
    .insert(schema.projects)
    .values({
      name: "Planta Solar Atacama",
      description:
        "Diseño e implementación de planta fotovoltaica de 50MW en el desierto de Atacama. Incluye ingeniería, construcción y puesta en marcha.",
      clientId,
      coordinatorId: coordinadorId,
      stage: "Construcción",
      startDate: formatDate(getPastDate(60)),
      endDate: formatDate(getFutureDate(120)),
      status: "Activo",
    })
    .returning({ id: schema.projects.id })

  const projectId = project.id

  // Assign workers to project
  await db.insert(schema.projectWorkers).values([
    { projectId, userId: trabajadorId },
    { projectId, userId: coordinadorId },
  ])

  // Project URLs
  await db.insert(schema.projectUrls).values([
    {
      projectId,
      label: "Planos en Google Drive",
      url: "https://drive.google.com/example",
    },
    {
      projectId,
      label: "Repositorio GitHub",
      url: "https://github.com/example/planta-solar",
    },
  ])

  // ══════════════════════════════════════════════
  // Tasks + Activities
  // ══════════════════════════════════════════════
  console.log("  → Insertando tareas y actividades...")

  const [task1] = await db
    .insert(schema.tasks)
    .values({
      name: "Diseño de paneles zona norte",
      description:
        "Diseño e ingeniería de la disposición de paneles solares en la zona norte del terreno.",
      projectId,
      createdBy: coordinadorId,
      dueDate: formatDate(getFutureDate(30)),
      status: "abierta",
    })
    .returning({ id: schema.tasks.id })

  const [task2] = await db
    .insert(schema.tasks)
    .values({
      name: "Cableado eléctrico zona A",
      description:
        "Instalación del cableado eléctrico principal en la zona A del proyecto.",
      projectId,
      createdBy: coordinadorId,
      dueDate: formatDate(getFutureDate(45)),
      status: "abierta",
    })
    .returning({ id: schema.tasks.id })

  const [task3] = await db
    .insert(schema.tasks)
    .values({
      name: "Revisión estructural base",
      description:
        "Revisión y validación de la estructura base para los paneles solares.",
      projectId,
      createdBy: coordinadorId,
      dueDate: formatDate(getPastDate(5)),
      status: "cerrada",
    })
    .returning({ id: schema.tasks.id })

  // Assign tasks to worker
  await db.insert(schema.taskAssignments).values([
    { taskId: task1.id, userId: trabajadorId },
    { taskId: task2.id, userId: trabajadorId },
    { taskId: task3.id, userId: trabajadorId },
  ])

  // Activities for task 1
  await db.insert(schema.activities).values([
    {
      taskId: task1.id,
      name: "Levantamiento topográfico",
      description: "Medición del terreno zona norte para disposición óptima.",
      completed: true,
      createdBy: coordinadorId,
    },
    {
      taskId: task1.id,
      name: "Simulación de sombras",
      description: "Análisis de sombras entre paneles usando software PVsyst.",
      completed: false,
      createdBy: coordinadorId,
    },
    {
      taskId: task1.id,
      name: "Planos definitivos",
      description: "Generación de planos de ingeniería finales.",
      completed: false,
      createdBy: coordinadorId,
    },
  ])

  // Activities for task 2
  await db.insert(schema.activities).values([
    {
      taskId: task2.id,
      name: "Diseño de circuito principal",
      description: "Diseño del circuito eléctrico principal AC/DC.",
      completed: true,
      createdBy: coordinadorId,
    },
    {
      taskId: task2.id,
      name: "Instalación de ductos",
      description: "Instalación de canalizaciones y ductos eléctricos.",
      completed: false,
      createdBy: coordinadorId,
    },
  ])

  // Activities for task 3 (all complete)
  await db.insert(schema.activities).values([
    {
      taskId: task3.id,
      name: "Inspección visual",
      description: "Inspección visual de la estructura base.",
      completed: true,
      createdBy: coordinadorId,
    },
    {
      taskId: task3.id,
      name: "Ensayo de resistencia",
      description: "Ensayo de carga y resistencia de la estructura.",
      completed: true,
      createdBy: coordinadorId,
    },
  ])

  // ══════════════════════════════════════════════
  // Documents
  // ══════════════════════════════════════════════
  console.log("  → Insertando documentos...")

  await db.insert(schema.documents).values([
    {
      name: "Plano general zona norte.pdf",
      type: "pdf",
      sizeBytes: 2500000,
      uploadedBy: coordinadorId,
      projectId,
    },
    {
      name: "Informe estructural v2.pdf",
      type: "pdf",
      sizeBytes: 1200000,
      uploadedBy: trabajadorId,
      projectId,
      taskId: task3.id,
    },
  ])

  // ══════════════════════════════════════════════
  // Comments
  // ══════════════════════════════════════════════
  console.log("  → Insertando comentarios...")

  await db.insert(schema.comments).values([
    {
      parentType: "task",
      parentId: task1.id,
      authorId: coordinadorId,
      text: "Priorizar la simulación de sombras antes de avanzar con los planos definitivos.",
    },
    {
      parentType: "task",
      parentId: task1.id,
      authorId: trabajadorId,
      text: "Entendido, estoy esperando los datos del sensor de irradiación para completar la simulación.",
    },
    {
      parentType: "task",
      parentId: task2.id,
      authorId: externoId,
      text: "¿Cuándo estiman tener listo el diseño del circuito principal?",
      referenceId: "DOC-MLA-2026-045",
    },
  ])

  // ══════════════════════════════════════════════
  // Time Entries — worker history
  // ══════════════════════════════════════════════
  console.log("  → Insertando registros de tiempo...")

  await db.insert(schema.timeEntries).values([
    {
      userId: trabajadorId,
      projectId,
      taskId: task1.id,
      date: formatDate(getPastDate(1)),
      startTime: "08:00",
      lunchStartTime: "12:00",
      lunchEndTime: "13:00",
      endTime: "17:00",
      effectiveHours: 8.0,
      status: "finalizado",
      notes: "Avance en levantamiento topográfico zona norte.",
      progressPercentage: 100,
      pauseCount: 0,
      progressJustification:
        "Completé el levantamiento. Datos listos para simulación.",
      editable: true,
    },
    {
      userId: trabajadorId,
      projectId,
      taskId: task2.id,
      date: formatDate(getPastDate(2)),
      startTime: "08:30",
      lunchStartTime: "12:30",
      lunchEndTime: "13:30",
      endTime: "17:15",
      effectiveHours: 7.75,
      status: "finalizado",
      notes: "Diseño de circuito principal completado.",
      progressPercentage: 100,
      pauseCount: 1,
      progressJustification:
        "Circuito AC/DC diseñado y validado. Lista la documentación.",
      editable: true,
    },
  ])

  console.log("")
  console.log("═══════════════════════════════════════════")
  console.log("  ✅ Seed completado exitosamente")
  console.log("═══════════════════════════════════════════")
  console.log("")
  console.log("  Cuentas creadas (contraseña: Pass1234!):")
  console.log("  ─────────────────────────────────────────")
  console.log("  Admin:       admin@ingpass.cl")
  console.log("  Coordinador: coordinador@ingpass.cl")
  console.log("  Trabajador:  trabajador@ingpass.cl")
  console.log("  Externo:     externo@ingpass.cl")
  console.log("")
}

seed().catch((err) => {
  console.error("❌ Error en seed:", err)
  process.exit(1)
})
