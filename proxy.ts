import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

export async function proxy(request: NextRequest) {
    const sessionCookie = getSessionCookie(request)

    // If no session cookie exists, redirect to login
    if (!sessionCookie) {
        return NextResponse.redirect(new URL("/", request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/admin/:path*", "/coordinador/:path*", "/trabajador/:path*", "/externo/:path*"],
}
