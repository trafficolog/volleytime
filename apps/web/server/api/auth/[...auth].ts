import { auth } from '@volley-time/auth'

export default defineEventHandler((event) => {
  return auth.handler(toWebRequest(event))
})
