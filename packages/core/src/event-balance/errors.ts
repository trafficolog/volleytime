export class EventBalanceError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'EventBalanceError'
  }
}

/** Баланса событий не хватает на публикацию (409). */
export class InsufficientEventBalanceError extends EventBalanceError {
  constructor() {
    super('event_balance.insufficient', 'Недостаточно баланса событий')
  }
}

/**
 * Пакет недоступен для покупки (409, 22.2.1): нет такого кода, пакет скрыт или в архиве. Ответ
 * одинаков для всех трёх случаев, чтобы не раскрывать черновики.
 */
export class EventBalancePackageUnavailableError extends EventBalanceError {
  constructor() {
    super('event_balance.package_unavailable', 'Пакет недоступен для покупки')
  }
}

/** Управление каталогом пакетов root-администратором (22.2.1, ADR-22-2-1). */
export class EventBalancePackageError extends EventBalanceError {
  constructor(
    code:
      | 'event_balance_package.not_found'
      | 'event_balance_package.units_taken'
      | 'event_balance_package.stale'
      | 'event_balance_package.archived',
    message: string,
  ) {
    super(code, message)
    this.name = 'EventBalancePackageError'
  }
}
