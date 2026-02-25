"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { authClient } from "@/lib/auth-client"

type UserRole = "admin" | "coordinador" | "trabajador" | "externo"

interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  position: string
  emailPersonal: string | null
  image: string | null
  active: boolean | null
  scheduleType: string | null
  workerStatus: string | null
}

interface AuthContextType {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await authClient.getSession()
        if (data?.user) {
          setUser(data.user as unknown as AuthUser)
        }
      } catch {
        // No active session
      } finally {
        setIsLoading(false)
      }
    }
    checkSession()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await authClient.signIn.email({
        email,
        password,
      })

      if (result.error) {
        return { success: false, error: result.error.message || "Credenciales incorrectas" }
      }

      if (result.data?.user) {
        const authUser = result.data.user as unknown as AuthUser
        // Check if user is active
        if (authUser.active === false) {
          await authClient.signOut()
          return { success: false, error: "Tu cuenta está desactivada. Contacta al administrador." }
        }
        setUser(authUser)
        return { success: true }
      }

      return { success: false, error: "Error inesperado al iniciar sesión" }
    } catch {
      return { success: false, error: "Error de conexión. Intenta nuevamente." }
    }
  }, [])

  const logout = useCallback(async () => {
    await authClient.signOut()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
