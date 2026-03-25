import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const buildCspReportOnly = () =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' https: data:",
    "img-src 'self' https: data: blob:",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline' https:",
    "connect-src 'self' https: http:",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ")

export function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const appEnv = process.env.APP_ENV ?? "local"

  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

  if (request.nextUrl.protocol === "https:") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
  }

  if (appEnv === "staging") {
    response.headers.set("Content-Security-Policy-Report-Only", buildCspReportOnly())
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
