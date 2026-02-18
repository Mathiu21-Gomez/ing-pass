import type { Client, User, Project, TimeEntry, Comment } from "./types"

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
    emailPersonal: "admin.personal@gmail.com",
    role: "admin",
    position: "Gerente de Operaciones",
    active: true,
    scheduleStart: "08:00",
    scheduleEnd: "17:00",
    scheduleType: "fijo",
  },
  {
    id: "u2",
    name: "Juan Pérez González",
    email: "jperez@empresa.cl",
    emailPersonal: "juanperez.ing@gmail.com",
    role: "trabajador",
    position: "Ingeniero Civil",
    active: true,
    scheduleStart: "08:00",
    scheduleEnd: "17:00",
    scheduleType: "fijo",
    workerStatus: "trabajando",
  },
  {
    id: "u3",
    name: "Ana María López",
    email: "alopez@empresa.cl",
    emailPersonal: "ana.lopez.arq@gmail.com",
    role: "trabajador",
    position: "Arquitecta",
    active: true,
    scheduleStart: "09:00",
    scheduleEnd: "18:00",
    scheduleType: "fijo",
    workerStatus: "trabajando",
  },
  {
    id: "u4",
    name: "Roberto Sánchez",
    email: "rsanchez@empresa.cl",
    emailPersonal: "rob.sanchez@gmail.com",
    role: "trabajador",
    position: "Técnico Eléctrico",
    active: true,
    scheduleStart: "10:00",
    scheduleEnd: "19:00",
    scheduleType: "fijo",
    workerStatus: "disponible",
  },
  {
    id: "u5",
    name: "Carolina Muñoz",
    email: "cmunoz@empresa.cl",
    emailPersonal: "caro.munoz.dis@gmail.com",
    role: "trabajador",
    position: "Diseñadora Industrial",
    active: false,
    scheduleStart: "00:00",
    scheduleEnd: "23:59",
    scheduleType: "libre",
  },
  {
    id: "u6",
    name: "Felipe Torres",
    email: "ftorres@empresa.cl",
    emailPersonal: "felipe.torres.dev@gmail.com",
    role: "trabajador",
    position: "Desarrollador Senior",
    active: true,
    scheduleStart: "09:00",
    scheduleEnd: "18:00",
    scheduleType: "fijo",
    workerStatus: "trabajando",
  },
  // ── Coordinador ──
  {
    id: "u7",
    name: "Patricia Vega Ruiz",
    email: "pvega@empresa.cl",
    emailPersonal: "patricia.vega@gmail.com",
    role: "coordinador",
    position: "Coordinadora de Proyectos",
    active: true,
    scheduleStart: "08:00",
    scheduleEnd: "17:00",
    scheduleType: "fijo",
  },
  // ── Externo (cliente) ──
  {
    id: "u8",
    name: "Carlos Mendoza",
    email: "cmendoza@mineralosandes.cl",
    emailPersonal: "carlos.mendoza@gmail.com",
    role: "externo",
    position: "Jefe de Proyectos - Minera Los Andes",
    active: true,
    scheduleStart: "08:00",
    scheduleEnd: "17:00",
    scheduleType: "fijo",
  },
]

const today = new Date()
const formatDate = (d: Date) => d.toISOString().split("T")[0]
const formatDateTime = (d: Date) => d.toISOString()

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

export const mockProjects: Project[] = [
  {
    id: "p1",
    name: "Planta Solar Atacama",
    description: "Diseño e implementación de planta fotovoltaica de 50MW en el desierto de Atacama.",
    clientId: "c1",
    coordinatorId: "u7",
    stage: "Construcción",
    startDate: "2025-11-01",
    endDate: "2026-06-30",
    status: "Activo",
    documents: [
      { id: "doc1", name: "Estudio_Impacto_Ambiental.pdf", type: "pdf", size: "4.2 MB", uploadedBy: "u1", uploadedAt: "2025-10-15" },
      { id: "doc2", name: "Plano_General_Planta.dwg", type: "dwg", size: "12.8 MB", uploadedBy: "u7", uploadedAt: "2025-11-03" },
    ],
    urls: [
      { label: "Carpeta Google Drive", url: "https://drive.google.com/folder/planta-solar" },
      { label: "Normativa SEC", url: "https://www.sec.cl/normativa" },
    ],
    tasks: [
      {
        id: "t1", name: "Estudio de factibilidad", description: "Análisis técnico y financiero del proyecto",
        projectId: "p1", assignedTo: ["u2"], createdBy: "u7", createdAt: formatDateTime(getPastDate(30)),
        dueDate: formatDate(getPastDate(10)), status: "cerrada",
        documents: [],
        activities: [
          { id: "a1", taskId: "t1", name: "Análisis de irradiación solar", description: "Medición de datos solares zona norte", completed: true, dueDate: formatDate(getPastDate(20)), createdBy: "u2", createdAt: formatDateTime(getPastDate(28)) },
          { id: "a2", taskId: "t1", name: "Estudio financiero ROI", description: "Proyección de retorno a 7 años", completed: true, dueDate: formatDate(getPastDate(15)), createdBy: "u2", createdAt: formatDateTime(getPastDate(25)) },
        ],
      },
      {
        id: "t2", name: "Diseño de ingeniería", description: "Planos y especificaciones técnicas de paneles",
        projectId: "p1", assignedTo: ["u2"], createdBy: "u7", createdAt: formatDateTime(getPastDate(20)),
        dueDate: formatDate(getFutureDate(15)), status: "abierta",
        documents: [
          { id: "doc3", name: "Especificaciones_Paneles.pdf", type: "pdf", size: "1.8 MB", uploadedBy: "u2", uploadedAt: formatDate(getPastDate(5)) },
        ],
        activities: [
          { id: "a3", taskId: "t2", name: "Planos de disposición de paneles", description: "Layout zona norte", completed: true, dueDate: formatDate(getPastDate(5)), createdBy: "u2", createdAt: formatDateTime(getPastDate(18)) },
          { id: "a4", taskId: "t2", name: "Cálculos eléctricos", description: "Dimensionamiento de cables y protecciones", completed: false, dueDate: formatDate(getFutureDate(7)), createdBy: "u2", createdAt: formatDateTime(getPastDate(10)) },
          { id: "a5", taskId: "t2", name: "Especificaciones de inversor", description: "Selección y validación del inversor SMA 50kW", completed: false, dueDate: formatDate(getFutureDate(12)), createdBy: "u2", createdAt: formatDateTime(getPastDate(8)) },
        ],
      },
      {
        id: "t3", name: "Adquisición de materiales", description: "Compra de paneles y equipos eléctricos",
        projectId: "p1", assignedTo: ["u4"], createdBy: "u7", createdAt: formatDateTime(getPastDate(15)),
        dueDate: formatDate(getFutureDate(30)), status: "abierta",
        documents: [],
        activities: [
          { id: "a6", taskId: "t3", name: "Cotización paneles Jinko", description: "Solicitar cotización FOB para 580W", completed: true, dueDate: formatDate(getPastDate(3)), createdBy: "u4", createdAt: formatDateTime(getPastDate(12)) },
          { id: "a7", taskId: "t3", name: "Orden de compra inversores", description: "Generar OC para 5 inversores SMA", completed: false, dueDate: formatDate(getFutureDate(10)), createdBy: "u4", createdAt: formatDateTime(getPastDate(5)) },
        ],
      },
      {
        id: "t4", name: "Instalación eléctrica", description: "Montaje de sistemas eléctricos en terreno",
        projectId: "p1", assignedTo: ["u4", "u6"], createdBy: "u7", createdAt: formatDateTime(getPastDate(10)),
        dueDate: formatDate(getFutureDate(45)), status: "abierta",
        documents: [],
        activities: [
          { id: "a8", taskId: "t4", name: "Tendido de cables zona A", description: "Cable solar 10AWG 2.5km", completed: true, dueDate: formatDate(getPastDate(2)), createdBy: "u4", createdAt: formatDateTime(getPastDate(8)) },
          { id: "a9", taskId: "t4", name: "Instalación transformadores", description: "3x transformadores 500kVA", completed: true, dueDate: formatDate(getPastDate(1)), createdBy: "u4", createdAt: formatDateTime(getPastDate(5)) },
          { id: "a10", taskId: "t4", name: "Cableado zona B", description: "Tendido y conexión de cables zona B", completed: false, dueDate: formatDate(getFutureDate(20)), createdBy: "u4", createdAt: formatDateTime(getPastDate(2)) },
        ],
      },
    ],
    assignedWorkers: ["u2", "u4", "u6"],
  },
  {
    id: "p2",
    name: "Edificio Corporativo Pacífico",
    description: "Construcción de edificio de oficinas de 12 pisos en el centro de Valparaíso.",
    clientId: "c2",
    coordinatorId: "u7",
    stage: "Diseño",
    startDate: "2025-09-15",
    endDate: "2026-12-01",
    status: "Activo",
    documents: [
      { id: "doc4", name: "Permiso_DOM.pdf", type: "pdf", size: "890 KB", uploadedBy: "u3", uploadedAt: "2025-10-20" },
    ],
    urls: [
      { label: "Portal DOM Valparaíso", url: "https://dom.municipalidadvalparaiso.cl" },
    ],
    tasks: [
      {
        id: "t5", name: "Diseño arquitectónico", description: "Planos y renders del edificio completo",
        projectId: "p2", assignedTo: ["u3"], createdBy: "u7", createdAt: formatDateTime(getPastDate(25)),
        dueDate: formatDate(getFutureDate(20)), status: "abierta",
        documents: [],
        activities: [
          { id: "a11", taskId: "t5", name: "Renders 3D del lobby", description: "Modelado y texturizado del lobby principal", completed: true, dueDate: formatDate(getPastDate(1)), createdBy: "u3", createdAt: formatDateTime(getPastDate(20)) },
          { id: "a12", taskId: "t5", name: "Fachada principal", description: "Diseño detallado de la fachada exterior", completed: true, dueDate: formatDate(getPastDate(3)), createdBy: "u3", createdAt: formatDateTime(getPastDate(15)) },
          { id: "a13", taskId: "t5", name: "Distribución pisos 5-12", description: "Layout de oficinas pisos superiores", completed: false, dueDate: formatDate(getFutureDate(10)), createdBy: "u3", createdAt: formatDateTime(getPastDate(5)) },
        ],
      },
      {
        id: "t6", name: "Cálculo estructural", description: "Análisis sísmico y estructural NCh433",
        projectId: "p2", assignedTo: ["u2"], createdBy: "u7", createdAt: formatDateTime(getPastDate(20)),
        dueDate: formatDate(getFutureDate(25)), status: "abierta",
        documents: [],
        activities: [
          { id: "a14", taskId: "t6", name: "Análisis sísmico base", description: "Modelado sísmico según norma NCh433", completed: true, dueDate: formatDate(getPastDate(5)), createdBy: "u2", createdAt: formatDateTime(getPastDate(18)) },
          { id: "a15", taskId: "t6", name: "Cálculos piso 8", description: "Verificación estructural piso 8", completed: true, dueDate: formatDate(getPastDate(2)), createdBy: "u2", createdAt: formatDateTime(getPastDate(10)) },
        ],
      },
      {
        id: "t7", name: "Supervisión de obra", description: "Control diario de avance en terreno",
        projectId: "p2", assignedTo: ["u2", "u3"], createdBy: "u7", createdAt: formatDateTime(getPastDate(15)),
        dueDate: null, status: "abierta",
        documents: [],
        activities: [],
      },
      {
        id: "t8", name: "Gestión de permisos", description: "Trámites municipales y DOM",
        projectId: "p2", assignedTo: ["u3"], createdBy: "u7", createdAt: formatDateTime(getPastDate(30)),
        dueDate: formatDate(getPastDate(3)), status: "cerrada",
        documents: [],
        activities: [
          { id: "a16", taskId: "t8", name: "Preparar carpeta DOM", description: "Compilar documentos requeridos", completed: true, dueDate: formatDate(getPastDate(5)), createdBy: "u3", createdAt: formatDateTime(getPastDate(28)) },
          { id: "a17", taskId: "t8", name: "Entrega DOM", description: "Ingreso formal de carpeta", completed: true, dueDate: formatDate(getPastDate(3)), createdBy: "u3", createdAt: formatDateTime(getPastDate(10)) },
        ],
      },
    ],
    assignedWorkers: ["u2", "u3"],
  },
  {
    id: "p3",
    name: "App Gestión Agrícola",
    description: "Desarrollo de plataforma web para gestión de cultivos y riego inteligente.",
    clientId: "c4",
    coordinatorId: "u7",
    stage: "Desarrollo",
    startDate: "2026-01-10",
    endDate: "2026-08-15",
    status: "Activo",
    documents: [],
    urls: [
      { label: "Repo GitHub", url: "https://github.com/empresa/gestion-agricola" },
    ],
    tasks: [
      {
        id: "t9", name: "Levantamiento de requisitos", description: "Reuniones con stakeholders",
        projectId: "p3", assignedTo: ["u3"], createdBy: "u7", createdAt: formatDateTime(getPastDate(35)),
        dueDate: formatDate(getPastDate(20)), status: "cerrada",
        documents: [],
        activities: [
          { id: "a18", taskId: "t9", name: "Entrevistas con agricultores", description: "4 sesiones con usuarios finales", completed: true, dueDate: formatDate(getPastDate(25)), createdBy: "u3", createdAt: formatDateTime(getPastDate(33)) },
        ],
      },
      {
        id: "t10", name: "Diseño UI/UX", description: "Wireframes y prototipos interactivos",
        projectId: "p3", assignedTo: ["u5"], createdBy: "u7", createdAt: formatDateTime(getPastDate(25)),
        dueDate: formatDate(getPastDate(5)), status: "cerrada",
        documents: [],
        activities: [
          { id: "a19", taskId: "t10", name: "Wireframes módulo alertas", description: "Diseño de flujo de notificaciones", completed: true, dueDate: formatDate(getPastDate(8)), createdBy: "u5", createdAt: formatDateTime(getPastDate(20)) },
        ],
      },
      {
        id: "t11", name: "Desarrollo Frontend", description: "Implementación de la interfaz web",
        projectId: "p3", assignedTo: ["u6"], createdBy: "u7", createdAt: formatDateTime(getPastDate(15)),
        dueDate: formatDate(getFutureDate(30)), status: "abierta",
        documents: [],
        activities: [
          { id: "a20", taskId: "t11", name: "Dashboard de riego", description: "Gráficos de humedad y control de válvulas", completed: true, dueDate: formatDate(today), createdBy: "u6", createdAt: formatDateTime(getPastDate(10)) },
          { id: "a21", taskId: "t11", name: "Módulo de alertas", description: "Push notifications y email alerts", completed: false, dueDate: formatDate(getFutureDate(15)), createdBy: "u6", createdAt: formatDateTime(getPastDate(3)) },
        ],
      },
      {
        id: "t12", name: "Desarrollo Backend", description: "API REST y base de datos PostgreSQL",
        projectId: "p3", assignedTo: ["u6", "u5"], createdBy: "u7", createdAt: formatDateTime(getPastDate(15)),
        dueDate: formatDate(getFutureDate(35)), status: "abierta",
        documents: [],
        activities: [
          { id: "a22", taskId: "t12", name: "API sensores de humedad", description: "Endpoints CRUD + histórico", completed: true, dueDate: formatDate(getPastDate(1)), createdBy: "u6", createdAt: formatDateTime(getPastDate(12)) },
          { id: "a23", taskId: "t12", name: "API de riego automático", description: "Lógica de control de válvulas", completed: false, dueDate: formatDate(getFutureDate(20)), createdBy: "u6", createdAt: formatDateTime(getPastDate(5)) },
        ],
      },
    ],
    assignedWorkers: ["u3", "u5", "u6"],
  },
  {
    id: "p4",
    name: "Migración Cloud TechSol",
    description: "Migración de infraestructura on-premise a AWS para TechSolutions.",
    clientId: "c3",
    coordinatorId: "u7",
    stage: "Planificación",
    startDate: "2025-12-01",
    endDate: "2026-04-30",
    status: "Pausado",
    documents: [],
    urls: [],
    tasks: [
      {
        id: "t13", name: "Auditoría de infraestructura", description: "Inventario de servidores actuales",
        projectId: "p4", assignedTo: ["u4"], createdBy: "u7", createdAt: formatDateTime(getPastDate(40)),
        dueDate: formatDate(getPastDate(5)), status: "cerrada",
        documents: [],
        activities: [
          { id: "a24", taskId: "t13", name: "Inventario racks 3 y 4", description: "Documentar hardware y networking", completed: true, dueDate: formatDate(getPastDate(7)), createdBy: "u4", createdAt: formatDateTime(getPastDate(35)) },
        ],
      },
      {
        id: "t14", name: "Plan de migración", description: "Estrategia y cronograma de migración a AWS",
        projectId: "p4", assignedTo: ["u6"], createdBy: "u7", createdAt: formatDateTime(getPastDate(30)),
        dueDate: formatDate(getFutureDate(10)), status: "abierta",
        documents: [],
        activities: [
          { id: "a25", taskId: "t14", name: "Plan migración BD Oracle", description: "Migración Oracle a Amazon RDS", completed: true, dueDate: formatDate(getPastDate(3)), createdBy: "u6", createdAt: formatDateTime(getPastDate(25)) },
          { id: "a26", taskId: "t14", name: "Definir ventana de mantenimiento", description: "Coordinar con cliente fecha de corte", completed: false, dueDate: formatDate(getFutureDate(5)), createdBy: "u6", createdAt: formatDateTime(getPastDate(10)) },
        ],
      },
      {
        id: "t15", name: "Migración de datos", description: "Transferencia de bases de datos",
        projectId: "p4", assignedTo: ["u4", "u6"], createdBy: "u7", createdAt: formatDateTime(getPastDate(20)),
        dueDate: null, status: "pendiente_aprobacion",
        documents: [],
        activities: [],
      },
    ],
    assignedWorkers: ["u4", "u6"],
  },
]

// ── Comentarios de ejemplo ──
export const mockComments: Comment[] = [
  {
    id: "com1", parentType: "task", parentId: "t2",
    authorId: "u7", text: "Juan, ¿puedes priorizar los cálculos eléctricos? El proveedor necesita los datos esta semana.",
    createdAt: formatDateTime(getPastDate(3)),
  },
  {
    id: "com2", parentType: "task", parentId: "t2",
    authorId: "u2", text: "Entendido Patricia, los tendré listos el jueves.",
    createdAt: formatDateTime(getPastDate(2)),
  },
  {
    id: "com3", parentType: "task", parentId: "t2",
    authorId: "u1", text: "Perfecto. Asegúrense de validar con la norma SEC antes de enviar al proveedor.",
    createdAt: formatDateTime(getPastDate(1)),
  },
  {
    id: "com4", parentType: "activity", parentId: "a20",
    authorId: "u6", text: "Dashboard listo con gráficos de humedad en tiempo real y control de válvulas.",
    createdAt: formatDateTime(getPastDate(0)),
  },
  {
    id: "com5", parentType: "task", parentId: "t5",
    authorId: "u3", text: "Los renders del lobby están listos para revisión del cliente.",
    createdAt: formatDateTime(getPastDate(2)),
  },
  {
    id: "com6", parentType: "task", parentId: "t5",
    authorId: "u7", text: "Se ven excelentes Ana. ¿Cuándo tendrás la distribución de los pisos superiores?",
    createdAt: formatDateTime(getPastDate(1)),
  },
  {
    id: "com7", parentType: "task", parentId: "t5",
    authorId: "u3", text: "Calculo tenerlo la próxima semana. Estoy esperando la confirmación de metraje del piso 7.",
    createdAt: formatDateTime(getPastDate(0)),
  },
  {
    id: "com8", parentType: "task", parentId: "t4",
    authorId: "u4", text: "Tuve que pausar dos veces esperando materiales del proveedor. Cableado zona A completado.",
    createdAt: formatDateTime(getPastDate(1)),
  },
  {
    id: "com9", parentType: "task", parentId: "t4",
    authorId: "u2", text: "Roberto, ¿necesitas apoyo con la zona B? Puedo coordinar con el equipo de turno.",
    createdAt: formatDateTime(getPastDate(0)),
  },
]

export const mockTimeEntries: TimeEntry[] = [
  // Today - Juan working
  {
    id: "te1", userId: "u2", projectId: "p1", taskId: "t2",
    date: formatDate(today), startTime: "08:30",
    lunchStartTime: "12:30", lunchEndTime: "13:30", endTime: null,
    effectiveHours: 5.5, status: "trabajando",
    notes: "Avanzando con planos de paneles solares zona norte",
    progressPercentage: 65, pauseCount: 1,
    progressJustification: "Completé el diseño del sector norte y las conexiones eléctricas principales. Falta revisar los cálculos de carga.",
    editable: true,
  },
  // Today - Ana working
  {
    id: "te2", userId: "u3", projectId: "p2", taskId: "t5",
    date: formatDate(today), startTime: "09:00",
    lunchStartTime: null, lunchEndTime: null, endTime: null,
    effectiveHours: 3.2, status: "trabajando",
    notes: "Renders 3D del lobby principal",
    progressPercentage: 40, pauseCount: 0,
    progressJustification: "Terminé el modelado base del lobby y aplicando texturas. Pendiente iluminación y detalles finales.",
    editable: true,
  },
  // Today - Roberto on lunch
  {
    id: "te3", userId: "u4", projectId: "p1", taskId: "t4",
    date: formatDate(today), startTime: "07:45",
    lunchStartTime: "11:45", lunchEndTime: null, endTime: null,
    effectiveHours: 4.0, status: "colacion",
    notes: "Revisión de cableado zona B",
    progressPercentage: 50, pauseCount: 2,
    progressJustification: "Instalé la mitad del cableado principal en zona B. Pausas por esperar materiales del proveedor.",
    editable: true,
  },
  // Today - Juan finished an earlier task (editable — within 24h)
  {
    id: "te4b", userId: "u2", projectId: "p2", taskId: "t6",
    date: formatDate(today), startTime: "08:00",
    lunchStartTime: "12:00", lunchEndTime: "13:00", endTime: "15:30",
    effectiveHours: 6.5, status: "finalizado",
    notes: "Cálculos de carga para el piso 12 del edificio",
    progressPercentage: 70, pauseCount: 0,
    progressJustification: "Completé los cálculos principales. Pendiente validación sísmica del sector oriente.",
    editable: true,
  },
  // Today - Ana finished (editable — within 24h)
  {
    id: "te4c", userId: "u3", projectId: "p2", taskId: "t5",
    date: formatDate(today), startTime: "08:30",
    lunchStartTime: "12:30", lunchEndTime: "13:30", endTime: "16:00",
    effectiveHours: 7.0, status: "finalizado",
    notes: "Renders 3D del lobby y zonas comunes",
    progressPercentage: 85, pauseCount: 1,
    progressJustification: "Renders del lobby al 85%. Falta ajustar iluminación exterior y texturas del piso.",
    editable: true,
  },
  // Today - Felipe finished
  {
    id: "te4", userId: "u6", projectId: "p3", taskId: "t11",
    date: formatDate(today), startTime: "07:00",
    lunchStartTime: "11:00", lunchEndTime: "12:00", endTime: "16:00",
    effectiveHours: 8.0, status: "finalizado",
    notes: "Completé módulo de dashboard de riego",
    progressPercentage: 100, pauseCount: 0,
    progressJustification: "Dashboard de riego 100% funcional con gráficos de humedad, alertas automáticas y control de válvulas.",
    editable: true,
  },
  // Yesterday entries
  {
    id: "te5", userId: "u2", projectId: "p1", taskId: "t2",
    date: formatDate(getPastDate(1)), startTime: "08:00",
    lunchStartTime: "12:00", lunchEndTime: "13:00", endTime: "17:00",
    effectiveHours: 8.0, status: "finalizado",
    notes: "Revisión de especificaciones técnicas del inversor",
    progressPercentage: 100, pauseCount: 1,
    progressJustification: "Completé revisión del inversor SMA 50kW. Documentación técnica validada y aprobada por supervisor.",
    editable: true,
  },
  {
    id: "te6", userId: "u3", projectId: "p2", taskId: "t5",
    date: formatDate(getPastDate(1)), startTime: "09:00",
    lunchStartTime: "13:00", lunchEndTime: "14:00", endTime: "18:00",
    effectiveHours: 8.0, status: "finalizado",
    notes: "Diseño de fachada principal completado",
    progressPercentage: 100, pauseCount: 0,
    progressJustification: "Fachada principal lista con todos los detalles arquitectónicos. Renders aprobados por cliente.",
    editable: true,
  },
  {
    id: "te7", userId: "u4", projectId: "p4", taskId: "t13",
    date: formatDate(getPastDate(1)), startTime: "08:30",
    lunchStartTime: "12:30", lunchEndTime: "13:30", endTime: "17:15",
    effectiveHours: 7.75, status: "finalizado",
    notes: "Inventario de servidores rack 3 y 4",
    progressPercentage: 95, pauseCount: 2,
    progressJustification: "Documenté 95% de los servidores. Falta acceso a 2 equipos legacy por credenciales.",
    editable: true,
  },
  {
    id: "te8", userId: "u6", projectId: "p3", taskId: "t12",
    date: formatDate(getPastDate(1)), startTime: "07:30",
    lunchStartTime: "11:30", lunchEndTime: "12:30", endTime: "16:30",
    effectiveHours: 8.0, status: "finalizado",
    notes: "API de sensores de humedad implementada",
    progressPercentage: 100, pauseCount: 0,
    progressJustification: "API REST completa con endpoints para lectura de sensores, histórico y alertas. Tests unitarios pasando.",
    editable: true,
  },
  // 2 days ago
  {
    id: "te9", userId: "u2", projectId: "p2", taskId: "t6",
    date: formatDate(getPastDate(2)), startTime: "08:15",
    lunchStartTime: "12:15", lunchEndTime: "13:15", endTime: "17:00",
    effectiveHours: 7.75, status: "finalizado",
    notes: "Cálculos de carga para piso 8",
    progressPercentage: 100, pauseCount: 1,
    progressJustification: "Cálculos estructurales del piso 8 completados. Validación sísmica según norma NCh433.",
    editable: false,
  },
  {
    id: "te10", userId: "u3", projectId: "p3", taskId: "t10",
    date: formatDate(getPastDate(2)), startTime: "09:30",
    lunchStartTime: "13:30", lunchEndTime: "14:30", endTime: "18:00",
    effectiveHours: 7.5, status: "finalizado",
    notes: "Wireframes del módulo de alertas",
    progressPercentage: 90, pauseCount: 0,
    progressJustification: "Wireframes de alertas listos. Falta validar flujo de notificaciones push con el equipo.",
    editable: false,
  },
  // 3 days ago
  {
    id: "te11", userId: "u2", projectId: "p1", taskId: "t1",
    date: formatDate(getPastDate(3)), startTime: "08:00",
    lunchStartTime: "12:00", lunchEndTime: "13:00", endTime: "17:00",
    effectiveHours: 8.0, status: "finalizado",
    notes: "Informe de factibilidad fase 2",
    progressPercentage: 100, pauseCount: 0,
    progressJustification: "Informe de factibilidad fase 2 entregado. ROI proyectado a 7 años aprobado por gerencia.",
    editable: false,
  },
  {
    id: "te12", userId: "u4", projectId: "p1", taskId: "t4",
    date: formatDate(getPastDate(3)), startTime: "07:30",
    lunchStartTime: "11:30", lunchEndTime: "12:30", endTime: "16:30",
    effectiveHours: 8.0, status: "finalizado",
    notes: "Instalación de transformadores zona A",
    progressPercentage: 100, pauseCount: 1,
    progressJustification: "3 transformadores de 500kVA instalados y conectados. Pruebas de aislamiento exitosas.",
    editable: false,
  },
  // 4 days ago
  {
    id: "te13", userId: "u6", projectId: "p4", taskId: "t14",
    date: formatDate(getPastDate(4)), startTime: "08:00",
    lunchStartTime: "12:00", lunchEndTime: "13:00", endTime: "16:45",
    effectiveHours: 7.75, status: "finalizado",
    notes: "Plan de migración de BD Oracle a RDS",
    progressPercentage: 95, pauseCount: 0,
    progressJustification: "Plan de migración documentado. Pendiente definir ventana de mantenimiento con cliente.",
    editable: false,
  },
  {
    id: "te14", userId: "u3", projectId: "p2", taskId: "t8",
    date: formatDate(getPastDate(4)), startTime: "09:00",
    lunchStartTime: "13:00", lunchEndTime: "14:00", endTime: "17:30",
    effectiveHours: 7.5, status: "finalizado",
    notes: "Entrega de documentos a la DOM",
    progressPercentage: 100, pauseCount: 0,
    progressJustification: "Carpeta completa entregada a la DOM. Número de ingreso: DOM-2026-0234.",
    editable: false,
  },
  // 5 days ago
  {
    id: "te15", userId: "u2", projectId: "p1", taskId: "t3",
    date: formatDate(getPastDate(5)), startTime: "08:00",
    lunchStartTime: "12:00", lunchEndTime: "13:00", endTime: "17:00",
    effectiveHours: 8.0, status: "finalizado",
    notes: "Cotización de paneles Jinko 580W",
    progressPercentage: 100, pauseCount: 0,
    progressJustification: "Cotización formal recibida de Jinko Solar. Precio FOB USD $0.22/Wp. Envío a gerencia para aprobación.",
    editable: false,
  },
  {
    id: "te16", userId: "u4", projectId: "p1", taskId: "t4",
    date: formatDate(getPastDate(5)), startTime: "07:45",
    lunchStartTime: "11:45", lunchEndTime: "12:45", endTime: "16:45",
    effectiveHours: 8.0, status: "finalizado",
    notes: "Tendido de cables zona A completado",
    progressPercentage: 100, pauseCount: 1,
    progressJustification: "2.5km de cable solar 10AWG tendido en zona A. Conexiones probadas con megóhmetro.",
    editable: false,
  },
]

// ── Helper functions ──

export function getWeeklyHours(userId: string): { day: string; hours: number }[] {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie"]
  return days.map((day, i) => {
    const entry = mockTimeEntries.find(
      (e) => e.userId === userId && e.date === formatDate(getPastDate(4 - i))
    )
    return { day, hours: entry?.effectiveHours ?? 0 }
  })
}

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

// Helper: get task progress based on completed activities
export function getTaskProgress(task: { activities: { completed: boolean }[] }): number {
  if (task.activities.length === 0) return 0
  const completed = task.activities.filter((a) => a.completed).length
  return Math.round((completed / task.activities.length) * 100)
}

// Helper: check if a time entry is still editable (within 24 hours of close)
export function isEntryEditable(entryDate: string, endTime?: string | null): boolean {
  const closeTime = endTime ?? "17:00"
  const entry = new Date(`${entryDate}T${closeTime}:00`)
  const now = new Date()
  const diffMs = now.getTime() - entry.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  return diffHours >= 0 && diffHours <= 24
}

// Helper: get KPI data for dashboard
export function getKPIData() {
  const allTasks = mockProjects.flatMap((p) => p.tasks)
  const allActivities = allTasks.flatMap((t) => t.activities)

  // Cumplimiento de tareas por proyecto
  const tasksByProject = mockProjects.map((p) => {
    const total = p.tasks.length
    const closed = p.tasks.filter((t) => t.status === "cerrada").length
    return {
      projectId: p.id,
      projectName: p.name,
      totalTasks: total,
      closedTasks: closed,
      completionRate: total > 0 ? Math.round((closed / total) * 100) : 0,
    }
  })

  // Tareas originales (creadas por coordinador u7) vs creadas por usuarios
  const coordinatorTasks = allTasks.filter((t) => t.createdBy === "u7").length
  const userCreatedTasks = allTasks.filter((t) => t.createdBy !== "u7").length

  // Avance por usuario (basado en actividades asignadas)
  const workers = mockUsers.filter((u) => u.role === "trabajador")
  const progressByUser = workers.map((w) => {
    const userTasks = allTasks.filter((t) => t.assignedTo.includes(w.id))
    const userActivities = userTasks.flatMap((t) => t.activities)
    const completed = userActivities.filter((a) => a.completed).length
    const total = userActivities.length
    return {
      userId: w.id,
      userName: w.name,
      totalActivities: total,
      completedActivities: completed,
      progressRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      totalTasks: userTasks.length,
      closedTasks: userTasks.filter((t) => t.status === "cerrada").length,
    }
  })

  return {
    tasksByProject,
    coordinatorTasks,
    userCreatedTasks,
    totalTasks: allTasks.length,
    totalActivities: allActivities.length,
    completedActivities: allActivities.filter((a) => a.completed).length,
    progressByUser,
  }
}

// Helper: get comments for a task or activity
export function getCommentsFor(parentType: "task" | "activity", parentId: string): Comment[] {
  return mockComments
    .filter((c) => c.parentType === parentType && c.parentId === parentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
