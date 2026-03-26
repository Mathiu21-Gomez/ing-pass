import { useAuth } from "@/lib/contexts/auth-context"
import { type Module, type Action } from "@/lib/permissions"

/** Returns whether the current user has the given permission */
export function usePermission(module: Module, action: Action): boolean {
  const { hasPermission } = useAuth()
  return hasPermission(module, action)
}

/** Returns the full permissions set and the hasPermission checker */
export function usePermissions() {
  const { permissions, hasPermission } = useAuth()
  return { permissions, hasPermission, can: hasPermission }
}
