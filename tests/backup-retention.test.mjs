import assert from "node:assert/strict"
import test from "node:test"

import { planBackupRetention } from "../deploy/scripts/backup-retention.mjs"

const key = (stamp, reason) =>
  `production/mongodb/success/${stamp.slice(0, 4)}/${stamp.slice(4, 6)}/${stamp}_production_${reason}_current_incoming.archive.gz`

test("keeps newest daily and the two most recent commit-boundary dailies", () => {
  const backups = [
    key("20260420T020000Z", "daily"),
    key("20260420T030000Z", "pre-deploy"),
    key("20260420T040000Z", "pre-deploy"),
    key("20260420T050000Z", "pre-deploy"),
    key("20260420T080000Z", "post-deploy"),
    key("20260421T020000Z", "daily"),
    key("20260421T030000Z", "pre-deploy"),
    key("20260421T060000Z", "post-deploy"),
    key("20260422T020000Z", "daily"),
  ]

  const result = planBackupRetention({
    archiveKeys: backups,
    nowIso: "2026-04-26T02:00:00.000Z",
  })

  assert.deepEqual(result.keepArchiveKeys, [
    key("20260420T020000Z", "daily"),
    key("20260421T020000Z", "daily"),
    key("20260422T020000Z", "daily"),
  ])
  assert.deepEqual(result.deleteArchiveKeys, [
    key("20260420T030000Z", "pre-deploy"),
    key("20260420T040000Z", "pre-deploy"),
    key("20260420T050000Z", "pre-deploy"),
    key("20260420T080000Z", "post-deploy"),
    key("20260421T030000Z", "pre-deploy"),
    key("20260421T060000Z", "post-deploy"),
  ])
})

test("keeps every successful backup newer than 72 hours", () => {
  const oldDaily = key("20260420T020000Z", "daily")
  const oldPostDeploy = key("20260420T060000Z", "post-deploy")
  const recentPostDeploy = key("20260423T060000Z", "post-deploy")
  const newestDaily = key("20260424T020000Z", "daily")

  const result = planBackupRetention({
    archiveKeys: [oldDaily, oldPostDeploy, recentPostDeploy, newestDaily],
    nowIso: "2026-04-26T02:00:00.000Z",
  })

  assert.deepEqual(result.keepArchiveKeys, [
    recentPostDeploy,
    newestDaily,
  ])
  assert.deepEqual(result.deleteArchiveKeys, [oldDaily, oldPostDeploy])
})

test("ignores malformed and in-progress backup keys", () => {
  const daily = key("20260424T020000Z", "daily")
  const malformed = "production/mongodb/success/not-a-backup.archive.gz"
  const inProgress = "production/mongodb/in-progress/20260424T030000Z_production_pre-deploy_current_incoming.archive.gz"

  const result = planBackupRetention({
    archiveKeys: [daily, malformed, inProgress],
    nowIso: "2026-04-26T02:00:00.000Z",
  })

  assert.deepEqual(result.keepArchiveKeys, [daily])
  assert.deepEqual(result.deleteArchiveKeys, [])
  assert.deepEqual(result.ignoredArchiveKeys, [malformed, inProgress])
})

test("deletes old commit and delayed backups that are outside preserved windows", () => {
  const backups = [
    key("20260420T020000Z", "daily"),
    key("20260420T030000Z", "pre-deploy"),
    key("20260420T060000Z", "post-deploy"),
    key("20260421T020000Z", "daily"),
  ]

  const result = planBackupRetention({
    archiveKeys: backups,
    nowIso: "2026-04-26T02:00:00.000Z",
  })

  assert.deepEqual(result.keepArchiveKeys, [
    key("20260420T020000Z", "daily"),
    key("20260421T020000Z", "daily"),
  ])
  assert.deepEqual(result.deleteArchiveKeys, [
    key("20260420T030000Z", "pre-deploy"),
    key("20260420T060000Z", "post-deploy"),
  ])
})
