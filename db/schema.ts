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
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

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
  "abierta",
  "cerrada",
  "pendiente_aprobacion",
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

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  dueDate: date("due_date"),
  status: taskStatusEnum("status").notNull().default("abierta"),
})

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
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  completed: boolean("completed").notNull().default(false),
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
  referenceId: text("reference_id"),
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
