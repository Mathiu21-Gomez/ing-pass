import { describe, it, expect } from "vitest"
import { validateAttachments } from "@/lib/validate-attachments"

const validAtt = {
  id: "1",
  name: "foto.jpg",
  type: "image/jpeg",
  size: 1000,
  data: btoa("x".repeat(100)), // base64 válido pequeño
}

describe("validateAttachments", () => {
  it("returns null for undefined/null", () => {
    expect(validateAttachments(undefined)).toBeNull()
    expect(validateAttachments(null)).toBeNull()
  })

  it("returns null for empty array", () => {
    expect(validateAttachments([])).toBeNull()
  })

  it("returns null for a valid attachment", () => {
    expect(validateAttachments([validAtt])).toBeNull()
  })

  it("returns error when not an array", () => {
    expect(validateAttachments("not-an-array")).not.toBeNull()
  })

  it("returns error when exceeding max attachments", () => {
    const tooMany = Array(6).fill(validAtt)
    expect(validateAttachments(tooMany)).not.toBeNull()
  })

  it("returns error for disallowed MIME type", () => {
    const bad = { ...validAtt, type: "application/x-executable" }
    expect(validateAttachments([bad])).not.toBeNull()
  })

  it("returns error when total decoded size exceeds 5MB", () => {
    // base64 de 7.5MB → decoded ~5.6MB > 5MB límite
    const bigData = "A".repeat(7_500_000) // ~5.6MB decoded
    const big = { ...validAtt, data: bigData }
    expect(validateAttachments([big])).not.toBeNull()
  })

  it("allows data URLs (data:image/jpeg;base64,...)", () => {
    const withPrefix = { ...validAtt, data: `data:image/jpeg;base64,${validAtt.data}` }
    expect(validateAttachments([withPrefix])).toBeNull()
  })
})
