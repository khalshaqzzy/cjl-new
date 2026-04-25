#!/usr/bin/env node
import { readFileSync } from "node:fs"

const BACKUP_KEY_PATTERN =
  /(?:^|\/)(\d{8}T\d{6}Z)_production_(daily|pre-deploy|post-deploy)_[^/]+\.archive\.gz$/

const HOURS_72_MS = 72 * 60 * 60 * 1000

const parseBackupKey = (key) => {
  if (!key.includes("/success/")) {
    return null
  }

  const match = key.match(BACKUP_KEY_PATTERN)
  if (!match) {
    return null
  }

  const timestamp = match[1]
  const reason = match[2]
  const iso = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(9, 11)}:${timestamp.slice(11, 13)}:${timestamp.slice(13, 15)}.000Z`
  const timeMs = Date.parse(iso)

  if (!Number.isFinite(timeMs)) {
    return null
  }

  return {
    key,
    timestamp,
    reason,
    timeMs,
  }
}

const sortByTimeThenKey = (left, right) =>
  left.timeMs - right.timeMs || left.key.localeCompare(right.key)

const archiveToManifestKey = (archiveKey) =>
  archiveKey
    .replace("/success/", "/manifests/")
    .replace(/\.archive\.gz$/, ".json")

export const planBackupRetention = ({ archiveKeys, nowIso }) => {
  const nowMs = Date.parse(nowIso)
  if (!Number.isFinite(nowMs)) {
    throw new Error(`Invalid nowIso: ${nowIso}`)
  }

  const parsed = []
  const ignoredArchiveKeys = []

  for (const key of archiveKeys) {
    const backup = parseBackupKey(key)
    if (backup) {
      parsed.push(backup)
    } else {
      ignoredArchiveKeys.push(key)
    }
  }

  parsed.sort(sortByTimeThenKey)

  const keep = new Set()
  const recentCutoffMs = nowMs - HOURS_72_MS
  for (const backup of parsed) {
    if (backup.timeMs > recentCutoffMs) {
      keep.add(backup.key)
    }
  }

  const dailyBackups = parsed.filter((backup) => backup.reason === "daily")
  const newestDaily = dailyBackups.at(-1)
  if (newestDaily) {
    keep.add(newestDaily.key)
  }

  const commitBoundaryDailies = []
  for (let index = 0; index < dailyBackups.length; index += 1) {
    const daily = dailyBackups[index]
    const nextDaily = dailyBackups[index + 1]
    const hasCommitBeforeNextDaily = parsed.some(
      (backup) =>
        backup.reason === "pre-deploy" &&
        backup.timeMs > daily.timeMs &&
        (!nextDaily || backup.timeMs < nextDaily.timeMs),
    )

    if (hasCommitBeforeNextDaily) {
      commitBoundaryDailies.push(daily)
    }
  }

  for (const backup of commitBoundaryDailies.slice(-2)) {
    keep.add(backup.key)
  }

  const keepArchiveKeys = parsed
    .filter((backup) => keep.has(backup.key))
    .map((backup) => backup.key)
  const deleteArchiveKeys = parsed
    .filter((backup) => !keep.has(backup.key))
    .map((backup) => backup.key)

  return {
    keepArchiveKeys,
    deleteArchiveKeys,
    deleteManifestKeys: deleteArchiveKeys.map(archiveToManifestKey),
    ignoredArchiveKeys,
  }
}

const isCli = process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href

if (isCli) {
  const inputPath = process.argv[2]
  const input = inputPath ? readFileSync(inputPath, "utf8") : readFileSync(0, "utf8")
  const payload = JSON.parse(input)
  const result = planBackupRetention(payload)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
