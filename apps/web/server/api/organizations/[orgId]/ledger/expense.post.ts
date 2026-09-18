import { ledgerService, requireCanManageContent } from '@volley-time/core'

/** Расход: валидация в сервисе (zod) → 422 на дробные/отрицательные суммы и чужие категории (6.8.7). */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const entry = await ledgerService.addExpense(
    ctx,
    event.context.organization!.id,
    await readBody(event),
  )
  return { entry }
})
