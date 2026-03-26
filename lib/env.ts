import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL debe ser una URL valida"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET debe tener al menos 32 caracteres"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL debe ser una URL valida"),
})

export type AppEnv = z.infer<typeof envSchema>

let cachedEnv: AppEnv | undefined

export function getEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (source === process.env && cachedEnv) {
    return cachedEnv
  }

  const parsed = envSchema.safeParse({
    DATABASE_URL: source.DATABASE_URL,
    BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: source.BETTER_AUTH_URL,
  })

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")

    throw new Error(`Variables de entorno invalidas:\n${details}`)
  }

  if (source === process.env) {
    cachedEnv = parsed.data
  }

  return parsed.data
}
