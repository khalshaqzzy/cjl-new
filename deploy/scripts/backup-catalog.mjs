#!/usr/bin/env node

export const BACKUP_KEY_PATTERN =
  /(?:^|\/)(\d{8}T\d{6}Z)_production_(daily|pre-deploy|post-deploy|pre-restore)_[^/]+\.archive\.gz$/

const toIsoFromStamp = (timestamp) =>
  `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(9, 11)}:${timestamp.slice(11, 13)}:${timestamp.slice(13, 15)}.000Z`

const pad = (value) => String(value).padStart(2, "0")

export const formatAsiaJakartaTimestamp = (timestamp) => {
  const date = new Date(toIsoFromStamp(timestamp))
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid backup timestamp: ${timestamp}`)
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}T${pad(values.hour)}:${pad(values.minute)}:${pad(values.second)}+07:00 (GMT+7)`
}

export const archiveToManifestKey = (archiveKey) =>
  archiveKey
    .replace("/success/", "/manifests/")
    .replace(/\.archive\.gz$/, ".json")

export const parseBackupKey = (key) => {
  if (!key.includes("/success/")) {
    return null
  }

  const match = key.match(BACKUP_KEY_PATTERN)
  if (!match) {
    return null
  }

  const timestamp = match[1]
  const reason = match[2]
  const iso = toIsoFromStamp(timestamp)
  const timeMs = Date.parse(iso)

  if (!Number.isFinite(timeMs)) {
    return null
  }

  return {
    key,
    timestamp,
    reason,
    timeMs,
    createdAtUtc: iso,
    createdAtAsiaJakarta: formatAsiaJakartaTimestamp(timestamp),
  }
}

export const sortByTimeThenKey = (left, right) =>
  left.timeMs - right.timeMs || left.key.localeCompare(right.key)

export const selectLatestBackup = (archiveKeys) => {
  const parsed = archiveKeys
    .map(parseBackupKey)
    .filter((backup) => backup !== null)
    .sort(sortByTimeThenKey)

  return parsed.at(-1) ?? null
}

export const selectLatestRestorableBackup = (archiveKeys) => {
  const parsed = archiveKeys
    .map(parseBackupKey)
    .filter((backup) => backup !== null)
    .filter((backup) => ["daily", "pre-deploy", "post-deploy"].includes(backup.reason))
    .sort(sortByTimeThenKey)

  return parsed.at(-1) ?? null
}
