import { memberService } from '@volley-time/core'

export default defineApiHandler(async (event) => {
  const ctx = createServiceContextFromEvent(event)
  const left = await memberService.leaveOrg(ctx, event.context.organization!.id)
  return { member: left }
})
