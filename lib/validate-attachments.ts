const MAX_ATTACHMENTS = 5
const MAX_TOTAL_BYTES = 5 * 1024 * 1024 // 5 MB decoded
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
])

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

  let totalDecoded = 0

  for (const att of attachments as RawAttachment[]) {
    if (typeof att.type !== "string" || !ALLOWED_MIME_TYPES.has(att.type))
      return `Tipo de archivo no permitido: ${att.type}`

    if (typeof att.data !== "string")
      return "El campo data de cada adjunto debe ser una cadena base64"

    // Strip data URL prefix if present (data:image/png;base64,...)
    const base64 = att.data.includes(",") ? att.data.split(",")[1] : att.data

    // Estimate decoded size: base64 length * 3/4
    const decodedSize = Math.floor(base64.length * 0.75)
    totalDecoded += decodedSize

    if (totalDecoded > MAX_TOTAL_BYTES)
      return `El tamaño total de los adjuntos supera el límite de ${MAX_TOTAL_BYTES / 1024 / 1024} MB`
  }

  return null
}
