import { describe, expect, it } from "vitest"

import {
  TASK_CHAT_DEFAULT_LIMIT,
  TASK_CHAT_MAX_ATTACHMENTS,
  taskChatAttachmentRecordsSchema,
  taskChatCreateMessageBodySchema,
  taskChatListQuerySchema,
  taskChatMarkReadBodySchema,
} from "@/lib/task-chat-schemas"

describe("taskChatListQuerySchema", () => {
  it("applies defaults when query params are omitted", () => {
    const parsed = taskChatListQuerySchema.parse({})

    expect(parsed).toEqual({
      cursor: undefined,
      limit: TASK_CHAT_DEFAULT_LIMIT,
    })
  })

  it("rejects invalid cursor values", () => {
    const parsed = taskChatListQuerySchema.safeParse({
      cursor: "not-a-uuid",
      limit: "10",
    })

    expect(parsed.success).toBe(false)
  })
})

describe("taskChatCreateMessageBodySchema", () => {
  it("accepts text-only messages and trims text", () => {
    const parsed = taskChatCreateMessageBodySchema.parse({
      text: "  Hola equipo  ",
      clientRequestId: "11111111-1111-4111-8111-111111111111",
    })

    expect(parsed.text).toBe("Hola equipo")
    expect(parsed.attachmentIds).toBeUndefined()
  })

  it("accepts image-only messages", () => {
    const parsed = taskChatCreateMessageBodySchema.parse({
      attachmentIds: ["11111111-1111-4111-8111-111111111111"],
      clientRequestId: "22222222-2222-4222-8222-222222222222",
    })

    expect(parsed.attachmentIds).toEqual([
      "11111111-1111-4111-8111-111111111111",
    ])
  })

  it("rejects empty payloads without text or attachments", () => {
    const parsed = taskChatCreateMessageBodySchema.safeParse({
      text: "   ",
      clientRequestId: "33333333-3333-4333-8333-333333333333",
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects duplicate attachment ids", () => {
    const duplicateId = "44444444-4444-4444-8444-444444444444"
    const parsed = taskChatCreateMessageBodySchema.safeParse({
      attachmentIds: [duplicateId, duplicateId],
      clientRequestId: "55555555-5555-4555-8555-555555555555",
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects messages that exceed the attachment limit", () => {
    const attachmentIds = Array.from({ length: TASK_CHAT_MAX_ATTACHMENTS + 1 }, (_, index) => (
      `00000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`
    ))

    const parsed = taskChatCreateMessageBodySchema.safeParse({
      attachmentIds,
      clientRequestId: "66666666-6666-4666-8666-666666666666",
    })

    expect(parsed.success).toBe(false)
  })
})

describe("taskChatMarkReadBodySchema", () => {
  it("requires a valid message id", () => {
    const parsed = taskChatMarkReadBodySchema.safeParse({
      lastReadMessageId: "not-a-uuid",
    })

    expect(parsed.success).toBe(false)
  })
})

describe("taskChatAttachmentRecordsSchema", () => {
  it("allows valid image attachment records", () => {
    const parsed = taskChatAttachmentRecordsSchema.parse([
      {
        id: "77777777-7777-4777-8777-777777777777",
        type: "image/png",
        sizeBytes: 1024,
      },
    ])

    expect(parsed).toHaveLength(1)
  })

  it("rejects non-image attachments", () => {
    const parsed = taskChatAttachmentRecordsSchema.safeParse([
      {
        id: "88888888-8888-4888-8888-888888888888",
        type: "application/pdf",
        sizeBytes: 1024,
      },
    ])

    expect(parsed.success).toBe(false)
  })
})
