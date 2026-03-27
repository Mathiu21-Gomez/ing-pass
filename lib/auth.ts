import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { admin } from "better-auth/plugins"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { getEnv } from "@/lib/env"

function normalizeHost(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const normalized = trimmed.includes("://") ? trimmed : `https://${trimmed}`

  try {
    return new URL(normalized).host
  } catch {
    return null
  }
}

export function getAllowedAuthHosts(source: NodeJS.ProcessEnv = process.env) {
  const env = getEnv(source)
  const hosts = new Set<string>()

  hosts.add(new URL(env.BETTER_AUTH_URL).host)

  if (source.VERCEL_URL) {
    const vercelHost = normalizeHost(source.VERCEL_URL)

    if (vercelHost) {
      hosts.add(vercelHost)
    }
  }

  for (const value of env.BETTER_AUTH_ALLOWED_HOSTS?.split(",") ?? []) {
    const host = normalizeHost(value)

    if (host) {
      hosts.add(host)
    }
  }

  return [...hosts]
}

export function getTrustedAuthOrigins(source: NodeJS.ProcessEnv = process.env) {
  return getAllowedAuthHosts(source).map((host) => {
    const protocol = host.startsWith("localhost:") || host.startsWith("127.0.0.1:")
      ? "http"
      : "https"

    return `${protocol}://${host}`
  })
}

const createAuth = () => {
  const env = getEnv()

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: getTrustedAuthOrigins(),
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
}

type AuthInstance = ReturnType<typeof createAuth>

let cachedAuth: AuthInstance | undefined

export function getAuth(): AuthInstance {
  if (!cachedAuth) {
    cachedAuth = createAuth()
  }

  return cachedAuth
}

export const auth: AuthInstance = new Proxy({} as AuthInstance, {
  get(_target, prop) {
    const target = getAuth() as unknown as Record<PropertyKey, unknown>
    const value = Reflect.get(target, prop)

    return typeof value === "function" ? value.bind(target) : value
  },
})
