import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { getEnv } from "@/lib/env"
import * as schema from "./schema"

const env = getEnv()

const sql = neon(env.DATABASE_URL)

export const db = drizzle(sql, { schema })
