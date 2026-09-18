export class PlanError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'PlanError'
  }
}
export class PlanNotFoundError extends PlanError {
  constructor(id: number) {
    super('plan.not_found', `Plan ${id} not found`)
  }
}
export class PlanNotAvailableError extends PlanError {
  constructor() {
    super('plan.not_available', 'Plan is not available (archived or wrong org)')
  }
}
