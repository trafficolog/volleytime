export function createPlayerRequestGuard<Key>(getKey: () => Key) {
  let generation = 0

  return {
    begin() {
      const key = getKey()
      const request = ++generation
      return { isCurrent: () => request === generation && key === getKey() }
    },
  }
}
