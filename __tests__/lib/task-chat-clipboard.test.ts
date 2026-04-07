import { describe, expect, it } from "vitest"

import { extractTaskChatClipboardFiles } from "@/lib/task-chat-clipboard"

function makeFile(name: string, type: string) {
  return new File([new Uint8Array([1, 2, 3])], name, { type })
}

describe("extractTaskChatClipboardFiles", () => {
  it("returns image files directly exposed in clipboardData.files", () => {
    const png = makeFile("capture.png", "image/png")
    const txt = makeFile("note.txt", "text/plain")

    const result = extractTaskChatClipboardFiles({
      files: [png, txt],
    })

    expect(result).toEqual([png])
  })

  it("falls back to clipboard items when files is empty", () => {
    const png = makeFile("capture.png", "image/png")

    const result = extractTaskChatClipboardFiles({
      files: [],
      items: [
        {
          type: "image/png",
          getAsFile: () => png,
        },
      ],
    })

    expect(result).toEqual([png])
  })
})
