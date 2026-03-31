const MAX_ATTACHMENTS = 5
const MAX_IMAGE_BYTES = 5 * 1024 * 1024   // 5 MB per image
const MAX_DOC_BYTES   = 10 * 1024 * 1024  // 10 MB per document

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
])

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
])

const ALLOWED_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES])

interface RawAttachment {
  id?: unknown
  name?: unknown
  type?: unknown
  size?: unknown
  data?: unknown
}

export function validateAttachments(attachments: unknown): string | null {
  if (!attachments) return null
  if (!Array.isArray(attachments)) return "attachments debe ser un array"
  if (attachments.length > MAX_ATTACHMENTS)
    return `Máximo ${MAX_ATTACHMENTS} adjuntos por solicitud`

  for (const att of attachments as RawAttachment[]) {
    if (typeof att.type !== "string" || !ALLOWED_MIME_TYPES.has(att.type))
      return `Tipo de archivo no permitido: ${att.type}`

    if (typeof att.data !== "string")
      return "El campo data de cada adjunto debe ser una cadena base64"

    // Strip data URL prefix if present (data:image/png;base64,...)
    const base64 = att.data.includes(",") ? att.data.split(",")[1] : att.data

    // Estimate decoded size: base64 length * 3/4
    const decodedSize = Math.floor(base64.length * 0.75)
    const isImage = IMAGE_MIME_TYPES.has(att.type as string)
    const limitBytes = isImage ? MAX_IMAGE_BYTES : MAX_DOC_BYTES
    const limitMB = limitBytes / 1024 / 1024

    if (decodedSize > limitBytes)
      return `"${att.name}" supera el límite de ${limitMB} MB para ${isImage ? "imágenes" : "documentos"}`
  }

  return null
}
