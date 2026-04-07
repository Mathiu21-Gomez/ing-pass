"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

import { authClient } from "@/lib/auth-client"
import { type Action, type Module } from "@/lib/permissions"

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
  permissions: Set<string>
  permissionsError: string | null
  permissionsStatus: "idle" | "loading" | "ready" | "error"
  hasPermission: (module: Module, action: Action) => boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchPermissions(userId: string): Promise<Set<string>> {
  const res = await fetch(`/api/me/permissions?userId=${userId}`)
  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "No se pudieron cargar los permisos desde la base de datos"
    )
  }

  return new Set<string>(data?.permissions ?? [])
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<Set<string>>(new Set())
  const [permissionsError, setPermissionsError] = useState<string | null>(null)
  const [permissionsStatus, setPermissionsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [isLoading, setIsLoading] = useState(true)

  const clearPermissionsState = useCallback(() => {
    setPermissions(new Set())
    setPermissionsError(null)
    setPermissionsStatus("idle")
  }, [])

  const loadPermissions = useCallback(async (authUser: AuthUser) => {
    setPermissionsStatus("loading")
    setPermissionsError(null)

    try {
      const fetched = await fetchPermissions(authUser.id)
      setPermissions(fetched)
      setPermissionsError(null)
      setPermissionsStatus("ready")
    } catch (error) {
      setPermissions(new Set())
      setPermissionsError(
        error instanceof Error ? error.message : "No se pudieron cargar los permisos desde la base de datos"
      )
      setPermissionsStatus("error")
    }
  }, [])

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await authClient.getSession()

        if (data?.user) {
          const authUser = data.user as unknown as AuthUser
          setUser(authUser)
          await loadPermissions(authUser)
        } else {
          setUser(null)
          clearPermissionsState()
        }
      } catch {
        setUser(null)
        clearPermissionsState()
      } finally {
        setIsLoading(false)
      }
    }

    void checkSession()
  }, [clearPermissionsState, loadPermissions])

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const result = await authClient.signIn.email({ email, password })

        if (result.error) {
          return { success: false, error: result.error.message || "Credenciales incorrectas" }
        }

        if (result.data?.user) {
          const authUser = result.data.user as unknown as AuthUser

          if (authUser.active === false) {
            await authClient.signOut()
            return {
              success: false,
              error: "Tu cuenta está desactivada. Contacta al administrador.",
            }
          }

          setUser(authUser)
          await loadPermissions(authUser)
          return { success: true }
        }

        return { success: false, error: "Error inesperado al iniciar sesión" }
      } catch {
        return { success: false, error: "Error de conexión. Intenta nuevamente." }
      }
    },
    [loadPermissions]
  )

  const refreshSession = useCallback(async () => {
    try {
      const { data } = await authClient.getSession()

      if (data?.user) {
        const authUser = data.user as unknown as AuthUser
        setUser(authUser)
        await loadPermissions(authUser)
      } else {
        setUser(null)
        clearPermissionsState()
      }
    } catch {
      setPermissions(new Set())
      setPermissionsError("No se pudo refrescar la sesión de permisos")
      setPermissionsStatus("error")
    }
  }, [clearPermissionsState, loadPermissions])

  const logout = useCallback(async () => {
    await authClient.signOut()
    setUser(null)
    clearPermissionsState()
  }, [clearPermissionsState])

  const hasPermission = useCallback(
    (module: Module, action: Action) => permissions.has(`${module}:${action}`),
    [permissions]
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        permissionsError,
        permissionsStatus,
        hasPermission,
        login,
        logout,
        refreshSession,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
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
