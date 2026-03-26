import type { Client, User, Project, Task, TimeEntry, TimeEntryEnriched, Comment, Activity, DashboardKPIs, CommentAttachment } from "@/lib/types"

// ── Generic fetcher ──
async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
    return res.json()
}

async function poster<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
    return res.json()
}

async function patcher<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
    return res.json()
}

async function deleter(url: string): Promise<void> {
    const res = await fetch(url, { method: "DELETE" })
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`)
}

// ══════════════════════════════════════════════
// Clients
// ══════════════════════════════════════════════

export const clientsApi = {
    getAll: () => fetcher<Client[]>("/api/clients"),
    create: (data: Omit<Client, "id">) => poster<Client>("/api/clients", data),
    update: (id: string, data: Partial<Client>) => patcher<Client>(`/api/clients/${id}`, data),
    delete: (id: string) => deleter(`/api/clients/${id}`),
}

// ══════════════════════════════════════════════
// Users
// ══════════════════════════════════════════════

export const usersApi = {
    getAll: (params?: { role?: string; active?: string }) => {
        const search = new URLSearchParams(params as Record<string, string>).toString()
        return fetcher<User[]>(`/api/users${search ? `?${search}` : ""}`)
    },
    getById: (id: string) => fetcher<User>(`/api/users/${id}`),
    create: (data: Omit<User, "id">) => poster<User>("/api/users", data),
    update: (id: string, data: Partial<User>) => patcher<User>(`/api/users/${id}`, data),
    delete: (id: string) => deleter(`/api/users/${id}`),
}

// ══════════════════════════════════════════════
// Projects
// ══════════════════════════════════════════════

export const projectsApi = {
    getAll: (params?: { status?: string; clientId?: string }) => {
        const search = new URLSearchParams(params as Record<string, string>).toString()
        return fetcher<Project[]>(`/api/projects${search ? `?${search}` : ""}`)
    },
    getById: (id: string) => fetcher<Project>(`/api/projects/${id}`),
    create: (data: Omit<Project, "id" | "tasks" | "documents" | "urls">) =>
        poster<Project>("/api/projects", data),
    update: (id: string, data: Partial<Project>) =>
        patcher<Project>(`/api/projects/${id}`, data),
    delete: (id: string) => deleter(`/api/projects/${id}`),
    getTasks: (projectId: string) =>
        fetcher<Task[]>(`/api/projects/${projectId}/tasks`),
    createTask: (projectId: string, data: { name: string; description: string; dueDate?: string; assignedTo?: string[]; createdBy: string }) =>
        poster<Task>(`/api/projects/${projectId}/tasks`, data),
}

// ══════════════════════════════════════════════
// Tasks
// ══════════════════════════════════════════════

export const tasksApi = {
    getById: (id: string) => fetcher<Task>(`/api/tasks/${id}`),
    update: (id: string, data: Partial<Task>) => patcher<Task>(`/api/tasks/${id}`, data),
    delete: (id: string) => deleter(`/api/tasks/${id}`),
    getActivities: (taskId: string) =>
        fetcher<Activity[]>(`/api/tasks/${taskId}/activities`),
    createActivity: (taskId: string, data: { name: string; description: string; dueDate?: string; createdBy: string }) =>
        poster<Activity>(`/api/tasks/${taskId}/activities`, data),
    toggleActivity: (taskId: string, activityId: string, completed: boolean) =>
        patcher<Activity & { taskStatusChanged: boolean; newTaskStatus: string | null }>(`/api/tasks/${taskId}/activities`, { activityId, completed }),
    getComments: (taskId: string) =>
        fetcher<Comment[]>(`/api/tasks/${taskId}/comments`),
    createComment: (taskId: string, data: { text: string; authorId: string; parentType?: string; referenceId?: string; attachments?: CommentAttachment[] }) =>
        poster<Comment>(`/api/tasks/${taskId}/comments`, data),
}

// ══════════════════════════════════════════════
// Time Entries
// ══════════════════════════════════════════════

export const timeEntriesApi = {
    getAll: (params?: { userId?: string; projectId?: string; date?: string; status?: string }) => {
        const search = new URLSearchParams(params as Record<string, string>).toString()
        return fetcher<TimeEntryEnriched[]>(`/api/time-entries${search ? `?${search}` : ""}`)
    },
    create: (data: Omit<TimeEntry, "id">) =>
        poster<TimeEntry>("/api/time-entries", data),
    update: (id: string, data: Partial<TimeEntry>) =>
        patcher<TimeEntry>(`/api/time-entries/${id}`, data),
}

// ══════════════════════════════════════════════
// Messages
// ══════════════════════════════════════════════

export const messagesApi = {
    getByTask: (taskId: string) => fetcher<{ id: string; fromUserId: string; fromUserName: string; fromUserRole: string; content: string; taskId: string | null; createdAt: string }[]>(`/api/messages?taskId=${taskId}`),
    getBySession: (sessionId: string) => fetcher<{ id: string; fromUserId: string; fromUserName: string; fromUserRole: string; content: string; sessionId: string | null; createdAt: string }[]>(`/api/messages?sessionId=${sessionId}`),
}

// ══════════════════════════════════════════════
// Dashboard KPIs
// ══════════════════════════════════════════════

export const dashboardApi = {
    getKpis: () => fetcher<DashboardKPIs>("/api/dashboard/kpis"),
}
