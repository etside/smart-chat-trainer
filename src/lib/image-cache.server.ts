/**
 * Tiny in-memory LRU cache with TTL.
 * Keys are image URLs (or hashes). Values are cached vision analysis results.
 * Speedy, no deps, no I/O — just a Map with eviction.
 *
 * The cache is module-scoped, so it survives hot reloads but resets on PM2 restart.
 */

const MAX_ENTRIES = 500
const TTL_MS = 60 * 60 * 1000 // 1 hour — same product image may be sent again later

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class ImageAnalysisCache {
  private store = new Map<string, CacheEntry<any>>()
  private accessOrder: string[] = [] // LRU tracking

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      // also remove from accessOrder (lazy cleanup on next write)
      return null
    }
    // Move to front (most recently used)
    this._touch(key)
    return entry.value as T
  }

  set<T>(key: string, value: T): void {
    if (this.store.size >= MAX_ENTRIES && !this.store.has(key)) {
      // Evict least recently used
      const lru = this.accessOrder.shift()
      if (lru) this.store.delete(lru)
    }
    this.store.set(key, { value, expiresAt: Date.now() + TTL_MS })
    this._touch(key)
  }

  private _touch(key: string) {
    const idx = this.accessOrder.indexOf(key)
    if (idx >= 0) this.accessOrder.splice(idx, 1)
    this.accessOrder.push(key)
  }

  get size() {
    return this.store.size
  }
}

/** Singleton shared across the app */
export const visionCache = new ImageAnalysisCache()