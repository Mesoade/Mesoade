import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { StorageDriver } from './index.ts'
import { publicUrl } from './index.ts'

/** Development driver: writes under ./storage-dev, served by /uploads/[...key]. */
export function localDriver(): StorageDriver {
  const root = resolve(process.cwd(), 'storage-dev')

  function pathFor(key: string): string {
    const full = resolve(root, key)
    // Keys are generated internally, but never let one escape the root.
    if (full !== root && !full.startsWith(root + '/')) {
      throw new Error(`refusing to write outside storage root: ${key}`)
    }
    return full
  }

  return {
    async put(key, body, _contentType) {
      const path = pathFor(key)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, body)
      return { key, url: publicUrl(key) }
    },
    async delete(key) {
      await rm(pathFor(key), { force: true })
    },
    urlFor(key) {
      return publicUrl(key)
    },
  }
}

export const LOCAL_STORAGE_ROOT = join(process.cwd(), 'storage-dev')
