import assert from "node:assert/strict"
import test from "node:test"

import {
  archiveToManifestKey,
  formatAsiaJakartaTimestamp,
  parseBackupKey,
  selectLatestBackup,
  selectLatestRestorableBackup,
} from "../deploy/scripts/backup-catalog.mjs"

const key = (stamp, reason) =>
  `production/mongodb/success/${stamp.slice(0, 4)}/${stamp.slice(4, 6)}/${stamp}_production_${reason}_current_incoming.archive.gz`

test("selects the newest successful production backup", () => {
  const oldest = key("20260420T020000Z", "daily")
  const newest = key("20260421T040000Z", "post-deploy")
  const middle = key("20260421T030000Z", "pre-deploy")

  assert.equal(selectLatestBackup([oldest, newest, middle])?.key, newest)
})

test("restorable latest selection excludes pre-restore safety backups", () => {
  const lastKnownGood = key("20260421T040000Z", "post-deploy")
  const safetyBackup = key("20260421T050000Z", "pre-restore")

  assert.equal(selectLatestBackup([lastKnownGood, safetyBackup])?.key, safetyBackup)
  assert.equal(selectLatestRestorableBackup([lastKnownGood, safetyBackup])?.key, lastKnownGood)
})

test("ignores malformed and non-success backup keys", () => {
  const valid = key("20260421T040000Z", "post-deploy")
  const inProgress = valid.replace("/success/", "/in-progress/")

  assert.equal(selectLatestBackup(["not-a-backup", inProgress, valid])?.key, valid)
  assert.equal(parseBackupKey(inProgress), null)
})

test("maps archive key to matching manifest key", () => {
  assert.equal(
    archiveToManifestKey(key("20260421T040000Z", "post-deploy")),
    "production/mongodb/manifests/2026/04/20260421T040000Z_production_post-deploy_current_incoming.json",
  )
})

test("formats backup timestamp in GMT+7", () => {
  assert.equal(
    formatAsiaJakartaTimestamp("20260421T190102Z"),
    "2026-04-22T02:01:02+07:00 (GMT+7)",
  )
})
