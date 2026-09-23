import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Submission } from '../server/types.js'
import type { DailyPayload } from '../server/queue.js'
import type { SubmissionStore, PayloadCache } from './store.js'

/**
 * IndexedDB schema（浏览器持久化，藏在 store.ts 的接口后——node 测试永不 import 本文件）。
 * - submissions：keyPath `submissionId`，`put` 天然按主键去重（幂等纪律与 memoryStore 一致）。
 * - payload：单 key `'today'` 的下发物缓存槽。
 */
interface DrillDB extends DBSchema {
  submissions: { key: string; value: Submission }
  payload: { key: string; value: DailyPayload }
}

const DB_NAME = 'interview-drill'
const DB_VERSION = 1
const PAYLOAD_KEY = 'today'

/** 惰性单例握手——首次调用时 openDB 建表，后续复用同一连接 */
function openDrillDB(): Promise<IDBPDatabase<DrillDB>> {
  return openDB<DrillDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('submissions')) {
        db.createObjectStore('submissions', { keyPath: 'submissionId' })
      }
      if (!db.objectStoreNames.contains('payload')) {
        db.createObjectStore('payload')
      }
    },
  })
}

/**
 * idb 实现（浏览器）：返回与 memoryStore 同形状 `{ submissions, cache }`。
 * submissions.all() 依赖 IndexedDB 主键升序——submissionId 铸自 ULID（词典序即时间序），
 * 故按序返回与「插入顺序」在正常联机流下一致（离线回放不依赖严格插入序，按 ULID 时间序即可）。
 */
export function idbStore(): { submissions: SubmissionStore; cache: PayloadCache } {
  const submissions: SubmissionStore = {
    async enqueue(s) {
      const db = await openDrillDB()
      await db.put('submissions', s)   // keyPath submissionId → 同 id 覆盖去重
    },
    async all() {
      const db = await openDrillDB()
      return db.getAll('submissions')
    },
    async remove(ids) {
      const db = await openDrillDB()
      const tx = db.transaction('submissions', 'readwrite')
      await Promise.all([...ids.map(id => tx.store.delete(id)), tx.done])
    },
  }

  const cache: PayloadCache = {
    async save(p) {
      const db = await openDrillDB()
      await db.put('payload', p, PAYLOAD_KEY)
    },
    async load() {
      const db = await openDrillDB()
      return (await db.get('payload', PAYLOAD_KEY)) ?? null
    },
  }

  return { submissions, cache }
}
