"use client"

import React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const { login, user, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated && user) {
      const target = user.role === "admin" ? "/admin/dashboard" : "/trabajador/mi-jornada"
      // Small delay to let exit animation play
      setTimeout(() => router.push(target), 400)
    }
  }, [isAuthenticated, user, router])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const success = login(email)
    if (success) {
      setIsLoggingIn(true)
    } else {
      setError("Credenciales incorrectas o usuario inactivo")
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div
        className={cn(
          "w-full max-w-md transition-all duration-500",
          isLoggingIn && "opacity-0 scale-95 translate-y-4"
        )}
      >
        {/* Logo con float animation */}
        <div className="mb-8 flex flex-col items-center gap-3 animate-fade-in-up">
          <div className="animate-float">
            <Image
              src="/logo.svg"
              alt="Ingeniera PASS"
              width={200}
              height={87}
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
              Ingeniera PASS
            </h1>
            <p className="text-sm text-muted-foreground">
              Control de tiempos y gestión de proyectos
            </p>
          </div>
        </div>

        <Card className="animate-scale-in card-hover">
          <CardHeader>
            <CardTitle className="text-lg">Iniciar sesión</CardTitle>
            <CardDescription>
              Ingresa tu email corporativo para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@empresa.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  defaultValue="demo"
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive animate-fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full btn-press" disabled={isLoggingIn}>
                {isLoggingIn ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Ingresando...
                  </div>
                ) : (
                  "Ingresar"
                )}
              </Button>
            </form>

            <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Cuentas de prueba:
              </p>
              <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <button
                  type="button"
                  className="cursor-pointer text-left hover:text-foreground transition-colors btn-press"
                  onClick={() => setEmail("admin@empresa.cl")}
                >
                  <span className="font-medium text-foreground">Admin:</span>{" "}
                  admin@empresa.cl
                </button>
                <button
                  type="button"
                  className="cursor-pointer text-left hover:text-foreground transition-colors btn-press"
                  onClick={() => setEmail("jperez@empresa.cl")}
                >
                  <span className="font-medium text-foreground">Trabajador:</span>{" "}
                  jperez@empresa.cl
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
