import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

export interface ApiUser {
  id: string
  name: string
  email: string
  role: string
  position: string
  active: boolean | null
}

type AuthSuccess = { user: ApiUser; error: null }
type AuthFailure = { user: null; error: NextResponse }
export type AuthResult = AuthSuccess | AuthFailure

export async function getAuthUser(request: NextRequest): Promise<AuthResult> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user) {
      return {
        user: null,
        error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
      }
    }

    const u = session.user as unknown as ApiUser

    if (u.active === false) {
      return {
        user: null,
        error: NextResponse.json({ error: "Cuenta desactivada" }, { status: 403 }),
      }
    }

    return { user: u, error: null }
  } catch {
    return {
      user: null,
      error: NextResponse.json({ error: "Error de autenticación" }, { status: 401 }),
    }
  }
}

export function requireRole(user: ApiUser, roles: string[]): NextResponse | null {
  if (!roles.includes(user.role)) {
    return NextResponse.json(
      { error: `Sin permisos suficientes (rol: '${user.role}', requerido: ${roles.join("/")})` },
      { status: 403 }
    )
  }
  return null
}
