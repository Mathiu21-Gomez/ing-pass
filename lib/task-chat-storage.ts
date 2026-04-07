import { randomUUID } from "node:crypto"
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

export interface TaskChatStorageAdapter {
  stage(input: {
    attachmentId: string
    file: File
    taskId: string
    threadId: string
  }): Promise<{ blobDataBase64?: string; storageKey: string }>
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

function buildTaskChatStorageKey(input: {
  attachmentId: string
  file: File
  taskId: string
  threadId: string
}) {
  const extension = getFileExtension(input.file)

  return path.join(
    sanitizePathSegment(input.taskId),
    sanitizePathSegment(input.threadId),
    `${input.attachmentId}${extension}`
  )
}

export function createDatabaseTaskChatStorageAdapter(): TaskChatStorageAdapter {
  return {
    async stage({ attachmentId, file, taskId, threadId }) {
      const storageKey = buildTaskChatStorageKey({ attachmentId, file, taskId, threadId })

      return {
        blobDataBase64: Buffer.from(await file.arrayBuffer()).toString("base64"),
        storageKey,
      }
    },
  }
}

let cachedTaskChatStorageAdapter: TaskChatStorageAdapter | null = null

export function getTaskChatStorageAdapter() {
  if (!cachedTaskChatStorageAdapter) {
    cachedTaskChatStorageAdapter = createDatabaseTaskChatStorageAdapter()
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
  const { blobDataBase64, storageKey } = await adapter.stage({
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
        blobDataBase64: blobDataBase64 ?? null,
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
    throw error
  }
}

export async function getTaskChatAttachmentFile(input: {
  attachmentId: string
}) {
  const rows = await db
    .select({
      attachmentId: taskChatAttachments.id,
      fileName: documents.name,
      messageId: taskChatAttachments.messageId,
      mimeType: documents.type,
      sizeBytes: documents.sizeBytes,
      blobDataBase64: taskChatAttachments.blobDataBase64,
      storageKey: taskChatAttachments.storageKey,
      taskId: documents.taskId,
      uploadedBy: taskChatAttachments.uploadedBy,
    })
    .from(taskChatAttachments)
    .innerJoin(documents, eq(taskChatAttachments.documentId, documents.id))
    .where(eq(taskChatAttachments.id, input.attachmentId))

  const attachment = rows[0]
  if (!attachment) return null
  if (!attachment.blobDataBase64) {
    throw new Error(
      `El adjunto legacy ${attachment.attachmentId} no fue migrado a la base de datos. Ejecuta el backfill de task chat attachments antes de servirlo.`
    )
  }

  const body = Buffer.from(attachment.blobDataBase64, "base64")

  return {
    ...attachment,
    body,
  }
}

export async function deleteTaskChatStagedAttachment(input: {
  attachmentId: string
  taskId: string
  uploaderId: string
}) {
  const rows = await db
    .select({
      documentId: documents.id,
      blobDataBase64: taskChatAttachments.blobDataBase64,
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
  return true
}
