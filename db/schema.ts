import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  date,
  real,
  integer,
  pgEnum,
  index,
  uuid,
  primaryKey,
  json,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// ── Attachment type for notes ──
export interface NoteAttachment {
  id: string
  name: string
  type: string   // MIME type
  size: number   // bytes
  data: string   // base64
}

// ── Attachment type for comments ──
export interface CommentAttachment {
  id: string
  name: string
  type: string   // MIME type
  size: number   // bytes
  data: string   // base64
}

// ── Enums ──

export const projectStatusEnum = pgEnum("project_status", [
  "Activo",
  "Pausado",
  "Finalizado",
])

export const timerStatusEnum = pgEnum("timer_status", [
  "trabajando",
  "colacion",
  "pausado",
  "reunion",
  "finalizado",
  "inactivo",
])

export const taskStatusEnum = pgEnum("task_status", [
  "pendiente",
  "en_curso",
  "esperando_info",
  "bloqueado",
  "listo_para_revision",
  "finalizado",
  "retrasado",
])

export const workerStatusEnum = pgEnum("worker_status", [
  "disponible",
  "en_reunion",
  "trabajando",
  "ausente",
])

export const scheduleTypeEnum = pgEnum("schedule_type", ["fijo", "libre"])

export const commentParentTypeEnum = pgEnum("comment_parent_type", [
  "task",
  "activity",
])

// ══════════════════════════════════════════════════════════════
//  Better Auth tables — IDs must remain `text` (framework req)
// ══════════════════════════════════════════════════════════════

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  // Custom fields
  role: text("role").default("trabajador").notNull(),
  position: text("position").default("").notNull(),
  emailPersonal: text("email_personal").default(""),
  scheduleType: text("schedule_type").default("fijo"),
  workerStatus: text("worker_status"),
  active: boolean("active").default(true),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
)

// ══════════════════════════════════════════════════════════════
//  Application tables — UUIDs auto-generated
// ══════════════════════════════════════════════════════════════

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  rut: varchar("rut", { length: 15 }).notNull().unique(),
  contact: varchar("contact", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  address: text("address").default(""),
})

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  coordinatorId: text("coordinator_id")
    .notNull()
    .references(() => user.id),
  stage: varchar("stage", { length: 50 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: projectStatusEnum("status").notNull().default("Activo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const projectWorkers = pgTable(
  "project_workers",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })],
)

export const projectUrls = pgTable("project_urls", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 200 }).notNull(),
  url: text("url").notNull(),
})

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    correlativeId: integer("correlative_id").notNull().default(0),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description").notNull().default(""),
    guidelines: text("guidelines").default(""),
    priority: integer("priority").notNull().default(0),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    dueDate: date("due_date"),
    status: taskStatusEnum("status").notNull().default("pendiente"),
  },
  (table) => [
    uniqueIndex("tasks_project_correlative_unique").on(
      table.projectId,
      table.correlativeId
    ),
  ]
)

export const taskAssignments = pgTable(
  "task_assignments",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.userId] })],
)

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description").notNull().default(""),
  completed: boolean("completed").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  dueDate: date("due_date"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  parentType: commentParentTypeEnum("parent_type").notNull(),
  parentId: uuid("parent_id").notNull(),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id),
  text: text("text").notNull(),
  mentions: text("mentions").array().default([]),
  referenceId: text("reference_id"),
  attachments: json("attachments").$type<CommentAttachment[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => user.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
})

export const timeEntries = pgTable("time_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id),
  date: date("date").notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(),
  lunchStartTime: varchar("lunch_start_time", { length: 5 }),
  lunchEndTime: varchar("lunch_end_time", { length: 5 }),
  endTime: varchar("end_time", { length: 5 }),
  effectiveHours: real("effective_hours").notNull().default(0),
  status: timerStatusEnum("status").notNull().default("inactivo"),
  notes: text("notes").default(""),
  progressPercentage: integer("progress_percentage").notNull().default(0),
  pauseCount: integer("pause_count").notNull().default(0),
  progressJustification: text("progress_justification").default(""),
  editable: boolean("editable").notNull().default(true),
})

export const userSchedules = pgTable(
  "user_schedules",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Lun … 6=Dom
    startTime: varchar("start_time", { length: 5 }).notNull().default("08:00"),
    endTime: varchar("end_time", { length: 5 }).notNull().default("17:00"),
    isWorkingDay: boolean("is_working_day").notNull().default(true),
    reason: text("reason").default(""), // Justificación para Sáb/Dom
  },
  (table) => [primaryKey({ columns: [table.userId, table.dayOfWeek] })],
)

// ── Tags (etiquetas para tareas) ──
export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 20 }).notNull().default("#6366f1"),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const taskTags = pgTable(
  "task_tags",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.tagId] })]
)

export const taskAlerts = pgTable("task_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  alertAt: timestamp("alert_at").notNull(),
  message: text("message").default(""),
  dismissed: boolean("dismissed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Notes (notas del equipo) ──
export const noteCategoryEnum = pgEnum("note_category", [
  "trabajo_ayer",
  "emergencia",
  "anotacion",
  "cumpleanos",
  "general",
])

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").default(""),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  category: noteCategoryEnum("category").notNull().default("general"),
  isTeamNote: boolean("is_team_note").notNull().default(false),
  priority: text("priority"),  // "alta" | "media" | "baja" | null
  targetRoles: text("target_roles").array().default([]),
  attachments: json("attachments").$type<NoteAttachment[]>().default([]),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

// ── Events (comunicados y eventos de empresa) ──
export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").default(""),
  type: varchar("type", { length: 20 }).notNull().default("comunicado"), // "evento" | "comunicado"
  eventDate: date("event_date"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  targetRoles: text("target_roles").array().default([]), // vacío = todos los roles
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ══════════════════════════════════════════════════════════════
//  Permission system tables
// ══════════════════════════════════════════════════════════════

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: text("description").default(""),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    module: varchar("module", { length: 50 }).notNull(),
    action: varchar("action", { length: 20 }).notNull(),
    description: text("description").default(""),
  },
  (table) => [index("permissions_module_action_idx").on(table.module, table.action)]
)

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]
)

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })]
)

// ══════════════════════════════════════════════════════════════
//  Relations
// ══════════════════════════════════════════════════════════════

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  coordinatedProjects: many(projects),
  taskAssignments: many(taskAssignments),
  projectAssignments: many(projectWorkers),
  timeEntries: many(timeEntries),
  comments: many(comments),
  createdTasks: many(tasks),
  createdActivities: many(activities),
  schedules: many(userSchedules),
}))

export const userSchedulesRelations = relations(userSchedules, ({ one }) => ({
  user: one(user, {
    fields: [userSchedules.userId],
    references: [user.id],
  }),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  coordinator: one(user, {
    fields: [projects.coordinatorId],
    references: [user.id],
  }),
  tasks: many(tasks),
  workers: many(projectWorkers),
  urls: many(projectUrls),
  documents: many(documents),
  timeEntries: many(timeEntries),
}))

export const projectWorkersRelations = relations(projectWorkers, ({ one }) => ({
  project: one(projects, {
    fields: [projectWorkers.projectId],
    references: [projects.id],
  }),
  user: one(user, {
    fields: [projectWorkers.userId],
    references: [user.id],
  }),
}))

export const projectUrlsRelations = relations(projectUrls, ({ one }) => ({
  project: one(projects, {
    fields: [projectUrls.projectId],
    references: [projects.id],
  }),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  creator: one(user, {
    fields: [tasks.createdBy],
    references: [user.id],
  }),
  assignments: many(taskAssignments),
  activities: many(activities),
  comments: many(comments),
  documents: many(documents),
  timeEntries: many(timeEntries),
}))

export const taskAssignmentsRelations = relations(taskAssignments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignments.taskId],
    references: [tasks.id],
  }),
  user: one(user, {
    fields: [taskAssignments.userId],
    references: [user.id],
  }),
}))

export const activitiesRelations = relations(activities, ({ one }) => ({
  task: one(tasks, {
    fields: [activities.taskId],
    references: [tasks.id],
  }),
  creator: one(user, {
    fields: [activities.createdBy],
    references: [user.id],
  }),
}))

export const commentsRelations = relations(comments, ({ one }) => ({
  author: one(user, {
    fields: [comments.authorId],
    references: [user.id],
  }),
}))

export const documentsRelations = relations(documents, ({ one }) => ({
  uploader: one(user, {
    fields: [documents.uploadedBy],
    references: [user.id],
  }),
  project: one(projects, {
    fields: [documents.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [documents.taskId],
    references: [tasks.id],
  }),
}))

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  user: one(user, {
    fields: [timeEntries.userId],
    references: [user.id],
  }),
  project: one(projects, {
    fields: [timeEntries.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [timeEntries.taskId],
    references: [tasks.id],
  }),
}))

export const tagsRelations = relations(tags, ({ one, many }) => ({
  project: one(projects, { fields: [tags.projectId], references: [projects.id] }),
  creator: one(user, { fields: [tags.createdBy], references: [user.id] }),
  taskTags: many(taskTags),
}))

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, { fields: [taskTags.taskId], references: [tasks.id] }),
  tag: one(tags, { fields: [taskTags.tagId], references: [tags.id] }),
}))

export const taskAlertsRelations = relations(taskAlerts, ({ one }) => ({
  task: one(tasks, { fields: [taskAlerts.taskId], references: [tasks.id] }),
  user: one(user, { fields: [taskAlerts.userId], references: [user.id] }),
}))

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}))

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}))

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}))

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(user, {
    fields: [userRoles.userId],
    references: [user.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}))

export const eventsRelations = relations(events, ({ one }) => ({
  creator: one(user, {
    fields: [events.createdBy],
    references: [user.id],
  }),
}))

export const notesRelations = relations(notes, ({ one }) => ({
  author: one(user, {
    fields: [notes.authorId],
    references: [user.id],
  }),
  project: one(projects, {
    fields: [notes.projectId],
    references: [projects.id],
  }),
}))

// ── Messages (chat jornada + mensajes de clientes externos) ──
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromUserId: text("from_user_id")
    .notNull()
    .references(() => user.id),
  content: text("content").notNull(),
  // sessionId groups messages from the same jornada (generated UUID at startDay, no FK)
  sessionId: text("session_id"),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  isClientMessage: boolean("is_client_message").notNull().default(false),
  isPreStart: boolean("is_pre_start").notNull().default(false),
  attachments: json("attachments").$type<CommentAttachment[]>().default([]),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const messagesRelations = relations(messages, ({ one }) => ({
  from: one(user, {
    fields: [messages.fromUserId],
    references: [user.id],
  }),
  project: one(projects, {
    fields: [messages.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [messages.taskId],
    references: [tasks.id],
  }),
}))
