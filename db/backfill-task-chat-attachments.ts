import dotenv from "dotenv"
dotenv.config()

import { readFile } from "node:fs/promises"
import path from "node:path"

import { eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { taskChatAttachments } from "@/db/schema"

const legacyRoot = path.join(process.cwd(), ".task-chat-storage")

async function run() {
  const pending = await db
    .select({
      id: taskChatAttachments.id,
      storageKey: taskChatAttachments.storageKey,
    })
    .from(taskChatAttachments)
    .where(isNull(taskChatAttachments.blobDataBase64))

  if (pending.length === 0) {
    console.log("No hay adjuntos staged legacy para backfill.")
    return
  }

  let migrated = 0

  for (const attachment of pending) {
    const filePath = path.join(legacyRoot, attachment.storageKey)
    const fileBuffer = await readFile(filePath)

    await db
      .update(taskChatAttachments)
      .set({ blobDataBase64: fileBuffer.toString("base64") })
      .where(eq(taskChatAttachments.id, attachment.id))

    migrated += 1
    console.log(`Migrado ${attachment.id} desde ${attachment.storageKey}`)
  }

  console.log(`Backfill completado. ${migrated} adjunto(s) migrados a DB.`)
}

run().catch((error) => {
  console.error("Error en backfill de adjuntos task chat:", error)
  process.exit(1)
})
