import { AsyncLocalStorage } from "node:async_hooks"

export type RequestActorType = "admin" | "customer" | "anonymous" | "system"

export type RequestContext = {
  requestId: string
  actorType: RequestActorType
  actorId: string
  actorSource: "http" | "session" | "system"
  origin?: string
  userAgent?: string
  ipHash?: string
  method?: string
  path?: string
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>()

export const withRequestContext = <T>(context: RequestContext, work: () => T) =>
  requestContextStorage.run(context, work)

export const getRequestContext = () => requestContextStorage.getStore()

export const updateRequestContext = (patch: Partial<RequestContext>) => {
  const context = requestContextStorage.getStore()
  if (!context) {
    return
  }

  Object.assign(context, patch)
}
