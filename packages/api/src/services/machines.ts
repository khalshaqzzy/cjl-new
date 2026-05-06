import type {
  AdminMachine,
  AdminMachineCommandResponse,
  AdminMachineListResponse,
} from "@cjl/contracts"
import { ConflictError, DependencyError, NotFoundError } from "../errors.js"
import { env } from "../env.js"
import { saveAuditLog } from "./common.js"

type MachineDefinition = {
  machineId: string
  type: "washer" | "dryer"
  number: number
  label: string
  statusPath: string
  onCommandPath: string
  offCommandPath: string
}

const letters = ["A", "B", "C", "D", "E"] as const

const machineDefinitions: MachineDefinition[] = [
  ...letters.map((letter, index) => ({
    machineId: `dryer-${index + 1}`,
    type: "dryer" as const,
    number: index + 1,
    label: `Dryer ${index + 1}`,
    statusPath: `${letter}1`,
    onCommandPath: `${letter}1`,
    offCommandPath: `${letter}1`,
  })),
  ...letters.map((letter, index) => ({
    machineId: `washer-${index + 1}`,
    type: "washer" as const,
    number: index + 1,
    label: `Washer ${index + 1}`,
    statusPath: `${letter}3`,
    onCommandPath: `${letter}2`,
    offCommandPath: `${letter}3`,
  })),
]

const resolveFirebaseBaseUrl = () => {
  const configured = env.FIREBASE_DATABASE_URL?.trim()
  if (!configured) {
    throw new DependencyError(
      "FIREBASE_DATABASE_URL belum dikonfigurasi",
      undefined,
      { code: "firebase_database_not_configured" }
    )
  }

  return configured.replace(/\/+$/, "")
}

const firebaseUrl = (path: string) => {
  const baseUrl = resolveFirebaseBaseUrl()
  const normalizedPath = path.split("/").map(encodeURIComponent).join("/")
  return `${baseUrl}/${normalizedPath}.json`
}

const fetchFirebaseResponse = async (path: string, init?: RequestInit) => {
  let response: Response
  try {
    response = await fetch(firebaseUrl(path), {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(8_000),
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    })
  } catch (error) {
    throw new DependencyError("Firebase Realtime Database tidak dapat diakses", error)
  }

  return response
}

const readFirebaseErrorBody = async (response: Response) => response.text().catch(() => "")

const assertFirebaseOk = async (response: Response) => {
  if (response.ok) {
    return
  }

  const body = await readFirebaseErrorBody(response)
  throw new DependencyError("Firebase Realtime Database menolak request", undefined, {
    details: {
      status: response.status,
      body: body.slice(0, 400),
    },
    exposeDetails: true,
  })
}

const fetchFirebaseJson = async <T>(path: string, init?: RequestInit) => {
  const response = await fetchFirebaseResponse(path, init)
  await assertFirebaseOk(response)

  return (await response.json()) as T
}

const getFirebaseValueWithEtag = async (path: string) => {
  const response = await fetchFirebaseResponse(path, {
    headers: {
      "X-Firebase-ETag": "true",
    },
  })
  await assertFirebaseOk(response)
  const value = await response.json() as unknown
  const etag = response.headers.get("etag")
  if (value !== null && !etag) {
    throw new DependencyError("Firebase tidak mengembalikan ETag untuk validasi update")
  }

  return {
    value,
    etag,
  }
}

const putFirebaseValueIfUnchanged = async (
  path: string,
  value: "0" | "1",
  etag: string,
  commandPath: string
) => {
  const response = await fetchFirebaseResponse(path, {
    method: "PUT",
    headers: {
      "if-match": etag,
    },
    body: JSON.stringify(value),
  })

  if (response.status === 412) {
    throw new ConflictError(`Path mesin ${commandPath} berubah sebelum update; status tidak diubah`)
  }

  await assertFirebaseOk(response)
}

const normalizeMachineStatus = (value: unknown): AdminMachine["status"] => {
  if (value === "0" || value === 0) {
    return "0"
  }

  if (value === "1" || value === 1) {
    return "1"
  }

  return "unknown"
}

const mapMachine = (
  definition: MachineDefinition,
  statusValues: Record<string, unknown>
): AdminMachine => ({
  machineId: definition.machineId,
  type: definition.type,
  number: definition.number,
  label: definition.label,
  status: normalizeMachineStatus(statusValues[definition.statusPath]),
  statusPath: definition.statusPath,
  onCommandPath: definition.onCommandPath,
  offCommandPath: definition.offCommandPath,
})

const getMachineDefinition = (machineId: string) => {
  const definition = machineDefinitions.find((machine) => machine.machineId === machineId)
  if (!definition) {
    throw new NotFoundError("Mesin tidak ditemukan")
  }

  return definition
}

const getMachineStatusValues = async () => {
  const values = await fetchFirebaseJson<Record<string, unknown> | null>("Mesin")
  return values ?? {}
}

export const listMachines = async (): Promise<AdminMachineListResponse> => {
  const statusValues = await getMachineStatusValues()
  return {
    items: machineDefinitions.map((definition) => mapMachine(definition, statusValues)),
  }
}

export const commandMachine = async (
  machineId: string,
  targetStatus: "0" | "1"
): Promise<AdminMachineCommandResponse> => {
  const definition = getMachineDefinition(machineId)
  const commandPath = targetStatus === "1" ? definition.onCommandPath : definition.offCommandPath
  const firebasePath = `Mesin/${commandPath}`

  try {
    const { value: existingValue, etag } = await getFirebaseValueWithEtag(firebasePath)
    if (existingValue === null) {
      throw new NotFoundError(`Path mesin ${commandPath} tidak ditemukan`)
    }

    await putFirebaseValueIfUnchanged(firebasePath, targetStatus, etag!, commandPath)

    await saveAuditLog("machine.command.sent", "machine", machineId, {
      commandPath,
      statusPath: definition.statusPath,
      targetStatus,
      previousValue: existingValue,
    })
  } catch (error) {
    if (error instanceof NotFoundError) {
      await saveAuditLog("machine.command.failed", "machine", machineId, {
        commandPath,
        statusPath: definition.statusPath,
        targetStatus,
        reason: error.message,
      })
      throw error
    }

    await saveAuditLog("machine.command.failed", "machine", machineId, {
      commandPath,
      statusPath: definition.statusPath,
      targetStatus,
      reason: error instanceof Error ? error.message : "unknown",
    })
    throw error
  }

  const statusValues = await getMachineStatusValues()
  return {
    ok: true,
    machine: mapMachine(definition, statusValues),
    command: {
      path: commandPath,
      targetStatus,
    },
  }
}
