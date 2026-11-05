/** Точка «новая вкладка» в таб-баре: горит, пока вкладку не открывали на этом устройстве. */
export const COLLECTIONS_TAB_SEEN_KEY = 'vt.tabSeen.collections'

type SeenStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Без доступного хранилища точка не показывается: лучше пропустить подсказку, чем навязать её. */
export function isTabUnseen(key: string, storage: SeenStorage | null): boolean {
  if (!storage) return false
  try {
    return storage.getItem(key) === null
  } catch {
    return false
  }
}

export function markTabSeen(key: string, storage: SeenStorage | null): void {
  try {
    storage?.setItem(key, '1')
  } catch {
    // хранилище недоступно (приватный режим): точка не показывалась бы и так
  }
}

export function browserStorage(): SeenStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
