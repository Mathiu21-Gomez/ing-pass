import { getAuth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

const authHandler = {
  handler(request: Request) {
    return getAuth().handler(request)
  },
}

export const { GET, POST } = toNextJsHandler(authHandler)
