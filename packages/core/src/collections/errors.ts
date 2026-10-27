/** Ошибки сборов (21.2.4); статусы — `CODE_STATUS` в apps/web/server/utils/handle-errors.ts. */
export class CollectionError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'CollectionError'
  }
}

/** Нет сбора в этой группе или черновик для игрока: чужой сбор неотличим от несуществующего. */
export class CollectionNotFoundError extends CollectionError {
  constructor(id: number) {
    super('collection.not_found', `Collection ${id} not found`)
  }
}

/** Действие требует другого статуса сбора (взнос — только в активный, правка — до закрытия). */
export class CollectionNotActiveError extends CollectionError {
  constructor() {
    super('collection.not_active', 'Сбор закрыт для этого действия')
  }
}

/** Создание сборов и взносов выключено до выкладки полного релиза (COLLECTIONS_ENABLED). */
export class CollectionsDisabledError extends CollectionError {
  constructor() {
    super('collection.disabled', 'Сборы пока недоступны')
  }
}
