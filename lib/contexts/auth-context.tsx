"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { authClient } from "@/lib/auth-client"
import { DEFAULT_ROLE_PERMISSIONS, type Module, type Action } from "@/lib/permissions"

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
  hasPermission: (module: Module, action: Action) => boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchPermissions(userId: string): Promise<Set<string>> {
  try {
    const res = await fetch(`/api/me/permissions?userId=${userId}`)
    if (!res.ok) throw new Error("fetch failed")
    const data = await res.json()
    return new Set<string>(data.permissions ?? [])
  } catch {
    return new Set<string>()
  }
}

function getFallbackPermissions(role: string): Set<string> {
  const perms = DEFAULT_ROLE_PERMISSIONS[role] ?? []
  return new Set<string>(perms)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  const loadPermissions = useCallback(async (authUser: AuthUser) => {
    const fetched = await fetchPermissions(authUser.id)
    if (fetched.size > 0) {
      setPermissions(fetched)
    } else {
      // Fallback to role-based permissions if permission tables are not seeded yet
      setPermissions(getFallbackPermissions(authUser.role))
    }
  }, [])

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await authClient.getSession()
        if (data?.user) {
          const authUser = data.user as unknown as AuthUser
          setUser(authUser)
          await loadPermissions(authUser)
        }
      } catch {
        // No active session
      } finally {
        setIsLoading(false)
      }
    }
    checkSession()
  }, [loadPermissions])

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

  const logout = useCallback(async () => {
    await authClient.signOut()
    setUser(null)
    setPermissions(new Set())
  }, [])

  const hasPermission = useCallback(
    (module: Module, action: Action) => {
      return permissions.has(`${module}:${action}`)
    },
    [permissions]
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        hasPermission,
        login,
        logout,
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
