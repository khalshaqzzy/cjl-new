import type { LeaderboardSnapshotDocument, OrderDocument } from "../types.js"
import { getDatabase } from "../db.js"
import { createId } from "./ids.js"
import { isArchivedMonth, monthKeyFromIso, nowJakarta } from "./time.js"

type LeaderboardRowInternal = {
  rank: number
  customerId: string
  maskedAlias: string
  earnedStamps: number
  latestQualifyingAt: string
}

const db = () => getDatabase()

export const buildMaskedAlias = (name: string) => {
  const primaryName = name.trim().split(/\s+/)[0] ?? "Pelanggan"
  if (primaryName.length <= 2) {
    return `${primaryName[0] ?? "P"}***`
  }

  if (primaryName.length <= 4) {
    return `${primaryName.slice(0, 1)}***${primaryName.slice(-1)}`
  }

  return `${primaryName.slice(0, 2)}***${primaryName.slice(-2)}`
}

const computeLiveRows = async (monthKey: string): Promise<LeaderboardRowInternal[]> => {
  const orders = await db()
    .collection<OrderDocument>("orders")
    .find({
      status: { $ne: "Voided" }
    })
    .toArray()

  const monthOrders = orders.filter(
    (order) => monthKeyFromIso(order.createdAt) === monthKey && order.earnedStamps > 0
  )

  const scoreMap = new Map<
    string,
    {
      customerId: string
      maskedAlias: string
      earnedStamps: number
      latestQualifyingAt: string
    }
  >()

  for (const order of monthOrders) {
    const current = scoreMap.get(order.customerId)
    if (!current) {
      scoreMap.set(order.customerId, {
        customerId: order.customerId,
        maskedAlias: buildMaskedAlias(order.customerName),
        earnedStamps: order.earnedStamps,
        latestQualifyingAt: order.createdAt
      })
      continue
    }

    scoreMap.set(order.customerId, {
      customerId: order.customerId,
      maskedAlias: current.maskedAlias,
      earnedStamps: current.earnedStamps + order.earnedStamps,
      latestQualifyingAt:
        current.latestQualifyingAt > order.createdAt ? current.latestQualifyingAt : order.createdAt
    })
  }

  return [...scoreMap.values()]
    .sort((left, right) => {
      if (right.earnedStamps !== left.earnedStamps) {
        return right.earnedStamps - left.earnedStamps
      }

      if (left.latestQualifyingAt !== right.latestQualifyingAt) {
        return left.latestQualifyingAt.localeCompare(right.latestQualifyingAt)
      }

      return left.customerId.localeCompare(right.customerId)
    })
    .map((row, index) => ({
      rank: index + 1,
      customerId: row.customerId,
      maskedAlias: row.maskedAlias,
      earnedStamps: row.earnedStamps,
      latestQualifyingAt: row.latestQualifyingAt
    }))
}

const getLatestSnapshot = async (monthKey: string) =>
  db()
    .collection<LeaderboardSnapshotDocument>("leaderboard_snapshots")
    .find({ monthKey })
    .sort({ version: -1 })
    .limit(1)
    .next()

const persistSnapshot = async (monthKey: string, reason: string, rows: LeaderboardRowInternal[]) => {
  const latestSnapshot = await getLatestSnapshot(monthKey)
  const nextVersion = (latestSnapshot?.version ?? 0) + 1

  const snapshot: LeaderboardSnapshotDocument = {
    _id: createId("leaderboard"),
    monthKey,
    version: nextVersion,
    rows: rows.slice(0, 20).map(({ rank, customerId, maskedAlias, earnedStamps }) => ({
      rank,
      customerId,
      maskedAlias,
      earnedStamps
    })),
    reason,
    createdAt: nowJakarta().toUTC().toISO() ?? new Date().toISOString()
  }

  await db().collection<LeaderboardSnapshotDocument>("leaderboard_snapshots").insertOne(snapshot)
  return snapshot
}

export const rebuildArchivedLeaderboard = async (monthKey: string, reason: string) => {
  if (!isArchivedMonth(monthKey)) {
    return null
  }

  const liveRows = await computeLiveRows(monthKey)
  return persistSnapshot(monthKey, reason, liveRows)
}

export const computeLeaderboardRows = async (monthKey: string, limit: number) => {
  if (!isArchivedMonth(monthKey)) {
    return (await computeLiveRows(monthKey)).slice(0, limit)
  }

  const snapshot = await getLatestSnapshot(monthKey)
  if (snapshot) {
    return snapshot.rows.slice(0, limit).map((row) => ({
      ...row,
      latestQualifyingAt: snapshot.createdAt
    }))
  }

  const liveRows = await computeLiveRows(monthKey)
  await persistSnapshot(monthKey, "initial-archive-build", liveRows)
  return liveRows.slice(0, limit)
}
