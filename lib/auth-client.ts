import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    // Uses /api/auth by default, no need to specify baseURL
})
