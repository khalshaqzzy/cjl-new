import type { Collection } from "mongodb"
import type { Store, IncrementResponse } from "express-rate-limit"
import { getDatabase } from "./db.js"
import type { RateLimitDocument } from "./types.js"

export class MongoRateLimitStore implements Store {
  windowMs!: number
  localKeys = false

  init(options: { windowMs: number }) {
    this.windowMs = options.windowMs
  }

  private collection = (): Collection<RateLimitDocument> =>
    getDatabase().collection<RateLimitDocument>("rate_limits")

  async increment(key: string): Promise<IncrementResponse> {
    const now = Date.now()
    const resetTime = new Date(now + this.windowMs)
    const existing = await this.collection().findOne({ _id: key })

    if (!existing || existing.resetTime.getTime() <= now) {
      await this.collection().updateOne(
        { _id: key },
        {
          $set: {
            totalHits: 1,
            resetTime,
          },
        },
        { upsert: true }
      )

      return {
        totalHits: 1,
        resetTime,
      }
    }

    const totalHits = existing.totalHits + 1
    await this.collection().updateOne(
      { _id: key },
      {
        $set: {
          totalHits,
          resetTime: existing.resetTime,
        },
      }
    )

    return {
      totalHits,
      resetTime: existing.resetTime,
    }
  }

  async decrement(key: string) {
    const existing = await this.collection().findOne({ _id: key })
    if (!existing) {
      return
    }

    const totalHits = Math.max(existing.totalHits - 1, 0)
    if (totalHits === 0) {
      await this.collection().deleteOne({ _id: key })
      return
    }

    await this.collection().updateOne(
      { _id: key },
      {
        $set: {
          totalHits,
        },
      }
    )
  }

  async resetKey(key: string) {
    await this.collection().deleteOne({ _id: key })
  }

  async resetAll() {
    await this.collection().deleteMany({})
  }
}
