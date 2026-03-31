import { randomUUID } from "node:crypto"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { documents, taskChatAttachments, taskChatThreads } from "@/db/schema"
import {
  taskChatAttachmentSourceSchema,
  taskChatStagedAttachmentSchema,
  taskChatStageAttachmentInputSchema,
  type TaskChatAttachmentSource,
  type TaskChatStagedAttachment,
} from "@/lib/task-chat-schemas"

const DEFAULT_TASK_CHAT_STORAGE_ROOT = path.join(process.cwd(), ".task-chat-storage")

export interface TaskChatStorageAdapter {
  cleanup(storageKey: string): Promise<void>
  read(storageKey: string): Promise<Buffer>
  stage(input: {
    attachmentId: string
    file: File
    taskId: string
    threadId: string
  }): Promise<{ storageKey: string }>
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-")
}

function getFileExtension(file: File) {
  const extensionFromName = path.extname(file.name).trim().toLowerCase()

  if (extensionFromName) return extensionFromName

  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "text/plain": ".txt",
    "text/csv": ".csv",
  }
  return mimeToExt[file.type] ?? ""
}

function resolveFileName(file: File) {
  const trimmedName = file.name.trim()

  if (trimmedName.length > 0) return trimmedName

  return `attachment${getFileExtension(file)}`
}

export function createLocalTaskChatStorageAdapter(
  rootDir = DEFAULT_TASK_CHAT_STORAGE_ROOT
): TaskChatStorageAdapter {
  return {
    async cleanup(storageKey) {
      const fullPath = path.join(rootDir, storageKey)
      await unlink(fullPath)
    },
    async read(storageKey) {
      const fullPath = path.join(rootDir, storageKey)
      return readFile(fullPath)
    },
    async stage({ attachmentId, file, taskId, threadId }) {
      const extension = getFileExtension(file)
      const storageKey = path.join(
        sanitizePathSegment(taskId),
        sanitizePathSegment(threadId),
        `${attachmentId}${extension}`
      )

      const fullPath = path.join(rootDir, storageKey)
      await mkdir(path.dirname(fullPath), { recursive: true })
      await writeFile(fullPath, Buffer.from(await file.arrayBuffer()))

      return { storageKey }
    },
  }
}

let cachedTaskChatStorageAdapter: TaskChatStorageAdapter | null = null

export function getTaskChatStorageAdapter() {
  if (!cachedTaskChatStorageAdapter) {
    cachedTaskChatStorageAdapter = createLocalTaskChatStorageAdapter()
  }

  return cachedTaskChatStorageAdapter
}

async function ensureTaskChatThread(taskId: string, uploaderId: string) {
  const existingThreads = await db
    .select({ id: taskChatThreads.id })
    .from(taskChatThreads)
    .where(eq(taskChatThreads.taskId, taskId))

  if (existingThreads.length > 0) {
    return existingThreads[0].id
  }

  const [createdThread] = await db
    .insert(taskChatThreads)
    .values({
      createdBy: uploaderId,
      taskId,
    })
    .returning({ id: taskChatThreads.id })

  return createdThread.id
}

export async function stageTaskChatAttachment(input: {
  adapter?: TaskChatStorageAdapter
  file: File
  projectId: string
  source?: TaskChatAttachmentSource
  taskId: string
  uploaderId: string
}): Promise<TaskChatStagedAttachment> {
  const fileName = resolveFileName(input.file)
  const source = taskChatAttachmentSourceSchema.parse(input.source ?? "manual")
  const parsedInput = taskChatStageAttachmentInputSchema.parse({
    fileName,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    source,
  })

  const adapter = input.adapter ?? getTaskChatStorageAdapter()
  const threadId = await ensureTaskChatThread(input.taskId, input.uploaderId)
  const attachmentId = randomUUID()
  const { storageKey } = await adapter.stage({
    attachmentId,
    file: input.file,
    taskId: input.taskId,
    threadId,
  })

  try {
    const [document] = await db
      .insert(documents)
      .values({
        name: parsedInput.fileName,
        projectId: input.projectId,
        sizeBytes: parsedInput.sizeBytes,
        taskId: input.taskId,
        type: parsedInput.mimeType,
        uploadedBy: input.uploaderId,
      })
      .returning({
        id: documents.id,
        name: documents.name,
        sizeBytes: documents.sizeBytes,
        type: documents.type,
      })

    await db
      .insert(taskChatAttachments)
      .values({
        documentId: document.id,
        id: attachmentId,
        messageId: null,
        source: parsedInput.source,
        storageKey,
        threadId,
        uploadedBy: input.uploaderId,
      })
      .returning({ id: taskChatAttachments.id })

    return taskChatStagedAttachmentSchema.parse({
      attachmentId,
      fileName: document.name,
      mimeType: document.type,
      sizeBytes: document.sizeBytes,
      source: parsedInput.source,
      status: "pending",
    })
  } catch (error) {
    await adapter.cleanup(storageKey).catch(() => undefined)
    throw error
  }
}

export async function getTaskChatAttachmentFile(input: {
  adapter?: TaskChatStorageAdapter
  attachmentId: string
}) {
  const adapter = input.adapter ?? getTaskChatStorageAdapter()
  const rows = await db
    .select({
      attachmentId: taskChatAttachments.id,
      fileName: documents.name,
      messageId: taskChatAttachments.messageId,
      mimeType: documents.type,
      sizeBytes: documents.sizeBytes,
      storageKey: taskChatAttachments.storageKey,
      taskId: documents.taskId,
      uploadedBy: taskChatAttachments.uploadedBy,
    })
    .from(taskChatAttachments)
    .innerJoin(documents, eq(taskChatAttachments.documentId, documents.id))
    .where(eq(taskChatAttachments.id, input.attachmentId))

  const attachment = rows[0]
  if (!attachment) return null

  const body = await adapter.read(attachment.storageKey)

  return {
    ...attachment,
    body,
  }
}

export async function deleteTaskChatStagedAttachment(input: {
  adapter?: TaskChatStorageAdapter
  attachmentId: string
  taskId: string
  uploaderId: string
}) {
  const adapter = input.adapter ?? getTaskChatStorageAdapter()
  const rows = await db
    .select({
      documentId: documents.id,
      storageKey: taskChatAttachments.storageKey,
    })
    .from(taskChatAttachments)
    .innerJoin(documents, eq(taskChatAttachments.documentId, documents.id))
    .where(
      and(
        eq(taskChatAttachments.id, input.attachmentId),
        eq(taskChatAttachments.uploadedBy, input.uploaderId),
        eq(documents.taskId, input.taskId),
        isNull(taskChatAttachments.messageId)
      )
    )

  const attachment = rows[0]
  if (!attachment) return false

  await db.delete(documents).where(eq(documents.id, attachment.documentId))
  await adapter.cleanup(attachment.storageKey).catch(() => undefined)
  return true
}
