import { DateTime } from "luxon"
import { env } from "../env.js"

export const nowJakarta = () => DateTime.now().setZone(env.APP_TIMEZONE)

export const toIso = (value: DateTime = nowJakarta()) =>
  value.toUTC().toISO() ?? new Date().toISOString()

export const formatDateTime = (iso: string) =>
  DateTime.fromISO(iso).setZone(env.APP_TIMEZONE).toFormat("dd LLL yyyy, HH:mm")

export const formatRelativeLabel = (iso: string) => {
  const dt = DateTime.fromISO(iso).setZone(env.APP_TIMEZONE)
  const diffHours = nowJakarta().diff(dt, "hours").hours

  if (diffHours < 1) {
    return "Baru saja"
  }

  if (diffHours < 24) {
    return `${Math.floor(diffHours)} jam lalu`
  }

  if (diffHours < 48) {
    return "Kemarin"
  }

  if (diffHours < 24 * 7) {
    return `${Math.floor(diffHours / 24)} hari lalu`
  }

  return formatDateTime(iso)
}

export const formatWeightLabel = (weightKg: number) => `${weightKg.toFixed(1)} kg`

export const monthKeyFromIso = (iso: string) =>
  DateTime.fromISO(iso).setZone(env.APP_TIMEZONE).toFormat("yyyy-MM")

export const isArchivedMonth = (monthKey: string) =>
  monthKey < nowJakarta().toFormat("yyyy-MM")

export const monthLabel = (monthKey: string) =>
  DateTime.fromFormat(monthKey, "yyyy-MM", { zone: env.APP_TIMEZONE }).toFormat("LLLL yyyy")
