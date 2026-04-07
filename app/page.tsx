"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useAuth } from "@/lib/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Loader2 } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const { login, user, isAuthenticated, isLoading } = useAuth()
  const { theme } = useTheme()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated && user) {
      const target =
        user.role === "admin"
          ? "/admin/dashboard"
          : user.role === "coordinador"
            ? "/coordinador/dashboard"
            : user.role === "externo"
              ? "/externo/proyectos"
              : "/trabajador/home"
      setTimeout(() => router.push(target), 400)
    }
  }, [isAuthenticated, user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoggingIn(true)
    const result = await login(email, password)
    if (!result.success) {
      setError(result.error || "Credenciales incorrectas o usuario inactivo")
      setIsLoggingIn(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background dark:bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background dark:bg-background transition-colors duration-300">

      {/* ── Left — Form ── */}
      <div className="flex w-full flex-col justify-center px-8 py-12 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm">

          {/* Logo mobile */}
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <Image
              src="/Logo BIMakers con Texto Gris.png"
              alt="BIMakers"
              width={120}
              height={40}
              priority
              className="object-contain"
            />
          </div>

          <div className="mb-10">
            <h1 className="text-3xl font-bold text-foreground dark:text-foreground">
              Iniciar sesión
            </h1>
            <p className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground">
              Ingresá tus credenciales para acceder al sistema
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground dark:text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@empresa.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:border-border dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground dark:text-muted-foreground">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:border-border dark:bg-card dark:text-foreground dark:placeholder:text-muted-foreground"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-colors"
            >
              {isLoggingIn && !error ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* ── Right — Branding ── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-muted dark:bg-surface-0 transition-colors duration-300"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(100,116,139,0.15) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/60 via-transparent to-transparent dark:from-blue-950/30 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-6 px-12 text-center">
          <div className="flex items-center justify-center rounded-2xl bg-card/80 p-6 ring-1 ring-border backdrop-blur dark:bg-muted/20 dark:ring-border">
            <Image
              src="/Logo BIMakers con Texto Gris.png"
              alt="BIMakers"
              width={180}
              height={60}
              priority
              className="object-contain"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground dark:text-foreground">
              Ingeniería PASS
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
              Sistema de control de tiempos y gestión de proyectos para equipos de ingeniería
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {["Proyectos", "Tareas", "Jornadas", "Reportes"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground dark:border-border dark:bg-card/60 dark:text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
