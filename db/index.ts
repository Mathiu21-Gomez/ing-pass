import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { getEnv } from "@/lib/env"
import * as schema from "./schema"

const createDb = () => {
  const env = getEnv()
  const sql = neon(env.DATABASE_URL)

  return drizzle(sql, { schema })
}

export type Database = ReturnType<typeof createDb>

let cachedDb: Database | undefined

export function getDb(): Database {
  if (!cachedDb) {
    cachedDb = createDb()
  }

  return cachedDb
}

export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const target = getDb() as unknown as Record<PropertyKey, unknown>
    const value = Reflect.get(target, prop)

    return typeof value === "function" ? value.bind(target) : value
  },
})
