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
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const { login, user, isAuthenticated, isLoading } = useAuth()
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
              : "/trabajador/mi-jornada"
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
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div
        className={cn(
          "w-full max-w-md transition-all duration-500",
          isLoggingIn && !error && "opacity-0 scale-95 translate-y-4"
        )}
      >
        {/* Logo con float animation */}
        <div className="mb-8 flex flex-col items-center gap-3 animate-fade-in-up">
          <div className="animate-float">
            <Image
              src="/Logo BIMakers con Texto Gris.png"
              alt="BIMakers"
              width={200}
              height={67}
              priority
              className="object-contain"
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
              Ingeniería PASS
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
                {isLoggingIn && !error ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Ingresando...
                  </div>
                ) : (
                  "Ingresar"
                )}
              </Button>
            </form>


          </CardContent>
        </Card>
      </div>
    </main>
  )
}
