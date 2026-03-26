import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { admin } from "better-auth/plugins"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { getEnv } from "@/lib/env"

const env = getEnv()

export const auth = betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    emailAndPassword: {
        enabled: true,
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: "trabajador",
                input: true,
            },
            position: {
                type: "string",
                required: true,
                defaultValue: "",
                input: true,
            },
            emailPersonal: {
                type: "string",
                required: false,
                defaultValue: "",
                input: true,
                fieldName: "emailPersonal",
            },
            scheduleType: {
                type: "string",
                required: false,
                defaultValue: "fijo",
                input: true,
                fieldName: "scheduleType",
            },
            workerStatus: {
                type: "string",
                required: false,
                input: true,
                fieldName: "workerStatus",
            },
            active: {
                type: "boolean",
                required: false,
                defaultValue: true,
                input: true,
            },
        },
    },
    plugins: [admin(), nextCookies()],
})
