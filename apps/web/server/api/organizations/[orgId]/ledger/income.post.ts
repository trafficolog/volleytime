import { ledgerService, requireCanManageContent } from '@volley-time/core'

/** Ручной доход (взнос, спонсорство, прочее). Task 6.8.9. */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const entry = await ledgerService.addIncome(
    ctx,
    event.context.organization!.id,
    await readBody(event),
  )
  return { entry }
})
