import type { Client, User, Project, TimeEntry } from "./types"

export const mockClients: Client[] = [
  {
    id: "c1",
    name: "Minera Los Andes SpA",
    rut: "76.123.456-7",
    contact: "Carlos Mendoza",
    email: "cmendoza@mineralosandes.cl",
    address: "Av. Providencia 1234, Santiago",
  },
  {
    id: "c2",
    name: "Constructora Pacífico Ltda.",
    rut: "77.654.321-K",
    contact: "María Rojas",
    email: "mrojas@constructorapacifico.cl",
    address: "Calle Huérfanos 567, Valparaíso",
  },
  {
    id: "c3",
    name: "TechSolutions Chile SA",
    rut: "78.987.654-3",
    contact: "Andrés Fuentes",
    email: "afuentes@techsolutions.cl",
    address: "Av. Apoquindo 4500, Las Condes",
  },
  {
    id: "c4",
    name: "Agrícola del Sur SA",
    rut: "79.111.222-5",
    contact: "Javiera Contreras",
    email: "jcontreras@agricoladelsur.cl",
    address: "Ruta 5 Sur km 620, Temuco",
  },
]

export const mockUsers: User[] = [
  {
    id: "u1",
    name: "Administrador Principal",
    email: "admin@empresa.cl",
    role: "admin",
    position: "Gerente de Operaciones",
    active: true,
  },
  {
    id: "u2",
    name: "Juan Pérez González",
    email: "jperez@empresa.cl",
    role: "trabajador",
    position: "Ingeniero Civil",
    active: true,
  },
  {
    id: "u3",
    name: "Ana María López",
    email: "alopez@empresa.cl",
    role: "trabajador",
    position: "Arquitecta",
    active: true,
  },
  {
    id: "u4",
    name: "Roberto Sánchez",
    email: "rsanchez@empresa.cl",
    role: "trabajador",
    position: "Técnico Eléctrico",
    active: true,
  },
  {
    id: "u5",
    name: "Carolina Muñoz",
    email: "cmunoz@empresa.cl",
    role: "trabajador",
    position: "Diseñadora Industrial",
    active: false,
  },
  {
    id: "u6",
    name: "Felipe Torres",
    email: "ftorres@empresa.cl",
    role: "trabajador",
    position: "Desarrollador Senior",
    active: true,
  },
]

export const mockProjects: Project[] = [
  {
    id: "p1",
    name: "Planta Solar Atacama",
    description: "Diseño e implementación de planta fotovoltaica de 50MW en el desierto de Atacama.",
    clientId: "c1",
    startDate: "2025-11-01",
    endDate: "2026-06-30",
    status: "Activo",
    tasks: [
      { id: "t1", name: "Estudio de factibilidad", description: "Análisis técnico y financiero", projectId: "p1" },
      { id: "t2", name: "Diseño de ingeniería", description: "Planos y especificaciones técnicas", projectId: "p1" },
      { id: "t3", name: "Adquisición de materiales", description: "Compra de paneles y equipos", projectId: "p1" },
      { id: "t4", name: "Instalación eléctrica", description: "Montaje de sistemas eléctricos", projectId: "p1" },
    ],
    assignedWorkers: ["u2", "u4", "u6"],
  },
  {
    id: "p2",
    name: "Edificio Corporativo Pacífico",
    description: "Construcción de edificio de oficinas de 12 pisos en el centro de Valparaíso.",
    clientId: "c2",
    startDate: "2025-09-15",
    endDate: "2026-12-01",
    status: "Activo",
    tasks: [
      { id: "t5", name: "Diseño arquitectónico", description: "Planos y renders del edificio", projectId: "p2" },
      { id: "t6", name: "Cálculo estructural", description: "Análisis sísmico y estructural", projectId: "p2" },
      { id: "t7", name: "Supervisión de obra", description: "Control diario de avance", projectId: "p2" },
      { id: "t8", name: "Gestión de permisos", description: "Trámites municipales y DOM", projectId: "p2" },
    ],
    assignedWorkers: ["u2", "u3"],
  },
  {
    id: "p3",
    name: "App Gestión Agrícola",
    description: "Desarrollo de plataforma web para gestión de cultivos y riego inteligente.",
    clientId: "c4",
    startDate: "2026-01-10",
    endDate: "2026-08-15",
    status: "Activo",
    tasks: [
      { id: "t9", name: "Levantamiento de requisitos", description: "Reuniones con stakeholders", projectId: "p3" },
      { id: "t10", name: "Diseño UI/UX", description: "Wireframes y prototipos", projectId: "p3" },
      { id: "t11", name: "Desarrollo Frontend", description: "Implementación de la interfaz", projectId: "p3" },
      { id: "t12", name: "Desarrollo Backend", description: "API y base de datos", projectId: "p3" },
    ],
    assignedWorkers: ["u3", "u5", "u6"],
  },
  {
    id: "p4",
    name: "Migración Cloud TechSol",
    description: "Migración de infraestructura on-premise a AWS para TechSolutions.",
    clientId: "c3",
    startDate: "2025-12-01",
    endDate: "2026-04-30",
    status: "Pausado",
    tasks: [
      { id: "t13", name: "Auditoría de infraestructura", description: "Inventario de servidores actuales", projectId: "p4" },
      { id: "t14", name: "Plan de migración", description: "Estrategia y cronograma", projectId: "p4" },
      { id: "t15", name: "Migración de datos", description: "Transferencia de bases de datos", projectId: "p4" },
    ],
    assignedWorkers: ["u4", "u6"],
  },
]

const today = new Date()
const formatDate = (d: Date) => d.toISOString().split("T")[0]

function getPastDate(daysAgo: number) {
  const d = new Date(today)
  d.setDate(d.getDate() - daysAgo)
  return d
}

export const mockTimeEntries: TimeEntry[] = [
  // Today - Juan working
  {
    id: "te1",
    userId: "u2",
    projectId: "p1",
    taskId: "t2",
    date: formatDate(today),
    startTime: "08:30",
    lunchStartTime: "12:30",
    lunchEndTime: "13:30",
    endTime: null,
    effectiveHours: 5.5,
    status: "trabajando",
    notes: "Avanzando con planos de paneles solares zona norte",
    progressPercentage: 65,
    pauseCount: 1,
    progressJustification: "Completé el diseño del sector norte y las conexiones eléctricas principales. Falta revisar los cálculos de carga.",
  },
  // Today - Ana working
  {
    id: "te2",
    userId: "u3",
    projectId: "p2",
    taskId: "t5",
    date: formatDate(today),
    startTime: "09:00",
    lunchStartTime: null,
    lunchEndTime: null,
    endTime: null,
    effectiveHours: 3.2,
    status: "trabajando",
    notes: "Renders 3D del lobby principal",
    progressPercentage: 40,
    pauseCount: 0,
    progressJustification: "Terminé el modelado base del lobby y aplicando texturas. Pendiente iluminación y detalles finales.",
  },
  // Today - Roberto on lunch
  {
    id: "te3",
    userId: "u4",
    projectId: "p1",
    taskId: "t4",
    date: formatDate(today),
    startTime: "07:45",
    lunchStartTime: "11:45",
    lunchEndTime: null,
    endTime: null,
    effectiveHours: 4.0,
    status: "colacion",
    notes: "Revisión de cableado zona B",
    progressPercentage: 50,
    pauseCount: 2,
    progressJustification: "Instalé la mitad del cableado principal en zona B. Pausas por esperar materiales del proveedor.",
  },
  // Today - Felipe finished
  {
    id: "te4",
    userId: "u6",
    projectId: "p3",
    taskId: "t11",
    date: formatDate(today),
    startTime: "07:00",
    lunchStartTime: "11:00",
    lunchEndTime: "12:00",
    endTime: "16:00",
    effectiveHours: 8.0,
    status: "finalizado",
    notes: "Completé módulo de dashboard de riego",
    progressPercentage: 100,
    pauseCount: 0,
    progressJustification: "Dashboard de riego 100% funcional con gráficos de humedad, alertas automáticas y control de válvulas.",
  },
  // Yesterday entries
  {
    id: "te5",
    userId: "u2",
    projectId: "p1",
    taskId: "t2",
    date: formatDate(getPastDate(1)),
    startTime: "08:00",
    lunchStartTime: "12:00",
    lunchEndTime: "13:00",
    endTime: "17:00",
    effectiveHours: 8.0,
    status: "finalizado",
    notes: "Revisión de especificaciones técnicas del inversor",
    progressPercentage: 100,
    pauseCount: 1,
    progressJustification: "Completé revisión del inversor SMA 50kW. Documentación técnica validada y aprobada por supervisor.",
  },
  {
    id: "te6",
    userId: "u3",
    projectId: "p2",
    taskId: "t5",
    date: formatDate(getPastDate(1)),
    startTime: "09:00",
    lunchStartTime: "13:00",
    lunchEndTime: "14:00",
    endTime: "18:00",
    effectiveHours: 8.0,
    status: "finalizado",
    notes: "Diseño de fachada principal completado",
    progressPercentage: 100,
    pauseCount: 0,
    progressJustification: "Fachada principal lista con todos los detalles arquitectónicos. Renders aprobados por cliente.",
  },
  {
    id: "te7",
    userId: "u4",
    projectId: "p4",
    taskId: "t13",
    date: formatDate(getPastDate(1)),
    startTime: "08:30",
    lunchStartTime: "12:30",
    lunchEndTime: "13:30",
    endTime: "17:15",
    effectiveHours: 7.75,
    status: "finalizado",
    notes: "Inventario de servidores rack 3 y 4",
    progressPercentage: 95,
    pauseCount: 2,
    progressJustification: "Documenté 95% de los servidores. Falta acceso a 2 equipos legacy por credenciales.",
  },
  {
    id: "te8",
    userId: "u6",
    projectId: "p3",
    taskId: "t12",
    date: formatDate(getPastDate(1)),
    startTime: "07:30",
    lunchStartTime: "11:30",
    lunchEndTime: "12:30",
    endTime: "16:30",
    effectiveHours: 8.0,
    status: "finalizado",
    notes: "API de sensores de humedad implementada",
    progressPercentage: 100,
    pauseCount: 0,
    progressJustification: "API REST completa con endpoints para lectura de sensores, histórico y alertas. Tests unitarios pasando.",
  },
  // 2 days ago
  {
    id: "te9",
    userId: "u2",
    projectId: "p2",
    taskId: "t6",
    date: formatDate(getPastDate(2)),
    startTime: "08:15",
    lunchStartTime: "12:15",
    lunchEndTime: "13:15",
    endTime: "17:00",
    effectiveHours: 7.75,
    status: "finalizado",
    notes: "Cálculos de carga para piso 8",
    progressPercentage: 100,
    pauseCount: 1,
    progressJustification: "Cálculos estructurales del piso 8 completados. Validación sísmica según norma NCh433.",
  },
  {
    id: "te10",
    userId: "u3",
    projectId: "p3",
    taskId: "t10",
    date: formatDate(getPastDate(2)),
    startTime: "09:30",
    lunchStartTime: "13:30",
    lunchEndTime: "14:30",
    endTime: "18:00",
    effectiveHours: 7.5,
    status: "finalizado",
    notes: "Wireframes del módulo de alertas",
    progressPercentage: 90,
    pauseCount: 0,
    progressJustification: "Wireframes de alertas listos. Falta validar flujo de notificaciones push con el equipo.",
  },
  // 3 days ago
  {
    id: "te11",
    userId: "u2",
    projectId: "p1",
    taskId: "t1",
    date: formatDate(getPastDate(3)),
    startTime: "08:00",
    lunchStartTime: "12:00",
    lunchEndTime: "13:00",
    endTime: "17:00",
    effectiveHours: 8.0,
    status: "finalizado",
    notes: "Informe de factibilidad fase 2",
    progressPercentage: 100,
    pauseCount: 0,
    progressJustification: "Informe de factibilidad fase 2 entregado. ROI proyectado a 7 años aprobado por gerencia.",
  },
  {
    id: "te12",
    userId: "u4",
    projectId: "p1",
    taskId: "t4",
    date: formatDate(getPastDate(3)),
    startTime: "07:30",
    lunchStartTime: "11:30",
    lunchEndTime: "12:30",
    endTime: "16:30",
    effectiveHours: 8.0,
    status: "finalizado",
    notes: "Instalación de transformadores zona A",
    progressPercentage: 100,
    pauseCount: 1,
    progressJustification: "3 transformadores de 500kVA instalados y conectados. Pruebas de aislamiento exitosas.",
  },
  // 4 days ago
  {
    id: "te13",
    userId: "u6",
    projectId: "p4",
    taskId: "t14",
    date: formatDate(getPastDate(4)),
    startTime: "08:00",
    lunchStartTime: "12:00",
    lunchEndTime: "13:00",
    endTime: "16:45",
    effectiveHours: 7.75,
    status: "finalizado",
    notes: "Plan de migración de BD Oracle a RDS",
    progressPercentage: 95,
    pauseCount: 0,
    progressJustification: "Plan de migración documentado. Pendiente definir ventana de mantenimiento con cliente.",
  },
  {
    id: "te14",
    userId: "u3",
    projectId: "p2",
    taskId: "t8",
    date: formatDate(getPastDate(4)),
    startTime: "09:00",
    lunchStartTime: "13:00",
    lunchEndTime: "14:00",
    endTime: "17:30",
    effectiveHours: 7.5,
    status: "finalizado",
    notes: "Entrega de documentos a la DOM",
    progressPercentage: 100,
    pauseCount: 0,
    progressJustification: "Carpeta completa entregada a la DOM. Número de ingreso: DOM-2026-0234.",
  },
  // 5 days ago
  {
    id: "te15",
    userId: "u2",
    projectId: "p1",
    taskId: "t3",
    date: formatDate(getPastDate(5)),
    startTime: "08:00",
    lunchStartTime: "12:00",
    lunchEndTime: "13:00",
    endTime: "17:00",
    effectiveHours: 8.0,
    status: "finalizado",
    notes: "Cotización de paneles Jinko 580W",
    progressPercentage: 100,
    pauseCount: 0,
    progressJustification: "Cotización formal recibida de Jinko Solar. Precio FOB USD $0.22/Wp. Envío a gerencia para aprobación.",
  },
  {
    id: "te16",
    userId: "u4",
    projectId: "p1",
    taskId: "t4",
    date: formatDate(getPastDate(5)),
    startTime: "07:45",
    lunchStartTime: "11:45",
    lunchEndTime: "12:45",
    endTime: "16:45",
    effectiveHours: 8.0,
    status: "finalizado",
    notes: "Tendido de cables zona A completado",
    progressPercentage: 100,
    pauseCount: 1,
    progressJustification: "2.5km de cable solar 10AWG tendido en zona A. Conexiones probadas con megóhmetro.",
  },
]

// Helper to get weekly hours for a user
export function getWeeklyHours(userId: string): { day: string; hours: number }[] {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie"]
  return days.map((day, i) => {
    const entry = mockTimeEntries.find(
      (e) => e.userId === userId && e.date === formatDate(getPastDate(4 - i))
    )
    return { day, hours: entry?.effectiveHours ?? 0 }
  })
}

// Helper: hours by project
export function getHoursByProject(): { project: string; hours: number }[] {
  const map = new Map<string, number>()
  for (const entry of mockTimeEntries) {
    const project = mockProjects.find((p) => p.id === entry.projectId)
    if (project) {
      map.set(project.name, (map.get(project.name) ?? 0) + entry.effectiveHours)
    }
  }
  return Array.from(map.entries()).map(([project, hours]) => ({ project, hours: Math.round(hours * 10) / 10 }))
}

// Helper: hours by worker
export function getHoursByWorker(): { worker: string; hours: number; target: number }[] {
  const map = new Map<string, number>()
  for (const entry of mockTimeEntries) {
    const user = mockUsers.find((u) => u.id === entry.userId)
    if (user) {
      map.set(user.name, (map.get(user.name) ?? 0) + entry.effectiveHours)
    }
  }
  return Array.from(map.entries()).map(([worker, hours]) => ({
    worker: worker.split(" ").slice(0, 2).join(" "),
    hours: Math.round(hours * 10) / 10,
    target: 40,
  }))
}

// Helper: active workers today
export function getActiveWorkersToday() {
  const todayStr = formatDate(today)
  return mockTimeEntries
    .filter((e) => e.date === todayStr)
    .map((e) => {
      const user = mockUsers.find((u) => u.id === e.userId)
      const project = mockProjects.find((p) => p.id === e.projectId)
      const task = project?.tasks.find((t) => t.id === e.taskId)
      return {
        ...e,
        userName: user?.name ?? "",
        userPosition: user?.position ?? "",
        projectName: project?.name ?? "",
        taskName: task?.name ?? "",
      }
    })
}

// Helper: get worker history with daily entries
export function getWorkerHistory(userId: string) {
  const user = mockUsers.find((u) => u.id === userId)
  if (!user) return null

  const entries = mockTimeEntries
    .filter((e) => e.userId === userId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => {
      const project = mockProjects.find((p) => p.id === e.projectId)
      const task = project?.tasks.find((t) => t.id === e.taskId)
      return {
        ...e,
        projectName: project?.name ?? "",
        taskName: task?.name ?? "",
      }
    })

  const totalPauses = entries.reduce((acc, e) => acc + e.pauseCount, 0)
  const totalHours = entries.reduce((acc, e) => acc + e.effectiveHours, 0)
  const avgProgress = entries.length > 0
    ? Math.round(entries.reduce((acc, e) => acc + e.progressPercentage, 0) / entries.length)
    : 0

  return {
    user,
    entries,
    totalPauses,
    totalHours: Math.round(totalHours * 10) / 10,
    avgProgress,
  }
}

// Helper: get all workers with today's status for admin view
export function getAllWorkersStatus() {
  const todayStr = formatDate(today)
  const workers = mockUsers.filter((u) => u.role === "trabajador" && u.active)

  return workers.map((worker) => {
    const todayEntry = mockTimeEntries.find((e) => e.userId === worker.id && e.date === todayStr)
    const allEntries = mockTimeEntries.filter((e) => e.userId === worker.id)
    const totalPauses = allEntries.reduce((acc, e) => acc + e.pauseCount, 0)

    if (todayEntry) {
      const project = mockProjects.find((p) => p.id === todayEntry.projectId)
      return {
        ...worker,
        todayEntry,
        projectName: project?.name ?? "",
        totalPauses,
        hasEntryToday: true,
      }
    }

    return {
      ...worker,
      todayEntry: null,
      projectName: "",
      totalPauses,
      hasEntryToday: false,
    }
  })
}
