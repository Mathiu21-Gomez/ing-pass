import { z } from "zod"

export const TASK_CHAT_DEFAULT_LIMIT = 20
export const TASK_CHAT_MAX_LIMIT = 50
export const TASK_CHAT_MAX_ATTACHMENTS = 5
export const TASK_CHAT_MAX_TEXT_LENGTH = 4000
export const TASK_CHAT_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
export const TASK_CHAT_ATTACHMENT_SOURCES = ["manual", "clipboard"] as const

export const TASK_CHAT_ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const

export const TASK_CHAT_ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
] as const

export const TASK_CHAT_ALLOWED_MIME_TYPES = [
  ...TASK_CHAT_ALLOWED_IMAGE_MIME_TYPES,
  ...TASK_CHAT_ALLOWED_DOCUMENT_MIME_TYPES,
] as const

export const TASK_CHAT_MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export const taskChatAttachmentSourceSchema = z.enum(TASK_CHAT_ATTACHMENT_SOURCES)

const taskChatMessageIdSchema = z.string().uuid("lastReadMessageId debe ser un UUID válido")
const taskChatCursorSchema = z.string().uuid("cursor debe ser un UUID válido")
const taskChatAttachmentIdSchema = z.string().uuid("Cada attachmentId debe ser un UUID válido")

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value

    const trimmed = value.trim()
    return trimmed.length === 0 ? undefined : trimmed
  },
  z.string().max(
    TASK_CHAT_MAX_TEXT_LENGTH,
    `text no puede exceder ${TASK_CHAT_MAX_TEXT_LENGTH} caracteres`
  ).optional()
)

const optionalLimitSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") return undefined
    return value
  },
  z.coerce.number()
    .int("limit debe ser un entero")
    .min(1, "limit debe ser mayor o igual a 1")
    .max(TASK_CHAT_MAX_LIMIT, `limit no puede exceder ${TASK_CHAT_MAX_LIMIT}`)
    .default(TASK_CHAT_DEFAULT_LIMIT)
)

const optionalAttachmentIdsSchema = z.array(taskChatAttachmentIdSchema)
  .max(
    TASK_CHAT_MAX_ATTACHMENTS,
    `attachmentIds no puede exceder ${TASK_CHAT_MAX_ATTACHMENTS} elementos`
  )
  .optional()

export const taskChatAttachmentIdsSchema = optionalAttachmentIdsSchema.superRefine(
  (attachmentIds, ctx) => {
    if (!attachmentIds) return

    const uniqueAttachmentIds = new Set(attachmentIds)
    if (uniqueAttachmentIds.size !== attachmentIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "attachmentIds no puede contener IDs duplicados",
      })
    }
  }
)

export const taskChatListQuerySchema = z.object({
  cursor: z.preprocess(
    (value) => (value === "" ? undefined : value),
    taskChatCursorSchema.optional()
  ),
  limit: optionalLimitSchema,
})

export const taskChatCreateMessageBodySchema = z.object({
  text: optionalTrimmedString,
  attachmentIds: taskChatAttachmentIdsSchema,
  clientRequestId: z.string().uuid("clientRequestId debe ser un UUID válido"),
}).superRefine((value, ctx) => {
  const hasText = typeof value.text === "string" && value.text.length > 0
  const hasAttachments = (value.attachmentIds?.length ?? 0) > 0

  if (!hasText && !hasAttachments) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debes enviar text o attachmentIds",
      path: ["text"],
    })
  }
})

export const taskChatMarkReadBodySchema = z.object({
  lastReadMessageId: taskChatMessageIdSchema,
})

export const taskChatAttachmentRecordSchema = z.object({
  id: taskChatAttachmentIdSchema,
  type: z.string().refine(
    (value) => TASK_CHAT_ALLOWED_IMAGE_MIME_TYPES.includes(
      value as (typeof TASK_CHAT_ALLOWED_IMAGE_MIME_TYPES)[number]
    ),
    "Solo se permiten imagenes como adjuntos del chat"
  ),
  sizeBytes: z.number()
    .int("sizeBytes debe ser un entero")
    .positive("sizeBytes debe ser mayor a 0")
    .max(
      TASK_CHAT_MAX_IMAGE_SIZE_BYTES,
      `Cada imagen no puede exceder ${TASK_CHAT_MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB`
    ),
})

export const taskChatAttachmentRecordsSchema = z.array(taskChatAttachmentRecordSchema)
  .max(
    TASK_CHAT_MAX_ATTACHMENTS,
    `No puedes adjuntar mas de ${TASK_CHAT_MAX_ATTACHMENTS} imagenes por mensaje`
  )
  .superRefine((attachments, ctx) => {
    const uniqueAttachmentIds = new Set(attachments.map((attachment) => attachment.id))

    if (uniqueAttachmentIds.size !== attachments.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No puedes repetir imagenes en el mismo mensaje",
      })
    }
  })

export const taskChatStageAttachmentInputSchema = z.object({
  fileName: z.string()
    .trim()
    .min(1, "fileName es requerido")
    .max(255, "fileName no puede exceder 255 caracteres"),
  mimeType: z.enum(TASK_CHAT_ALLOWED_MIME_TYPES, {
    errorMap: () => ({ message: "Tipo de archivo no permitido" }),
  }),
  sizeBytes: z.number()
    .int("sizeBytes debe ser un entero")
    .positive("sizeBytes debe ser mayor a 0"),
  source: taskChatAttachmentSourceSchema.default("manual"),
}).superRefine((val, ctx) => {
  const isImage = (TASK_CHAT_ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(val.mimeType)
  const maxBytes = isImage ? TASK_CHAT_MAX_IMAGE_SIZE_BYTES : TASK_CHAT_MAX_DOCUMENT_SIZE_BYTES
  const maxMB = maxBytes / 1024 / 1024
  if (val.sizeBytes > maxBytes) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_big,
      maximum: maxBytes,
      type: "number",
      inclusive: true,
      message: `El archivo no puede exceder ${maxMB} MB`,
    })
  }
})

export const taskChatStagedAttachmentSchema = z.object({
  attachmentId: taskChatAttachmentIdSchema,
  fileName: z.string(),
  mimeType: z.enum(TASK_CHAT_ALLOWED_MIME_TYPES),
  sizeBytes: z.number().int().positive(),
  source: taskChatAttachmentSourceSchema,
  status: z.literal("pending"),
})

export type TaskChatListQuery = z.infer<typeof taskChatListQuerySchema>
export type TaskChatCreateMessageBody = z.infer<typeof taskChatCreateMessageBodySchema>
export type TaskChatMarkReadBody = z.infer<typeof taskChatMarkReadBodySchema>
export type TaskChatAttachmentRecord = z.infer<typeof taskChatAttachmentRecordSchema>
export type TaskChatAttachmentSource = z.infer<typeof taskChatAttachmentSourceSchema>
export type TaskChatStageAttachmentInput = z.infer<typeof taskChatStageAttachmentInputSchema>
export type TaskChatStagedAttachment = z.infer<typeof taskChatStagedAttachmentSchema>
