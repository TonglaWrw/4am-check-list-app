import crypto from 'crypto'

export const SESSION_COOKIE = 'session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 3 // 3 days, in seconds

function getSecret() {
  return process.env.AUTH_SECRET || `${process.env.AUTH_PASSWORD || 'admin1234'}:4am-checklist-session`
}

function sign(payload: string) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
}

export function checkCredentials(username: string, password: string) {
  const expectedUser = process.env.AUTH_USERNAME || 'admin4am'
  const expectedPass = process.env.AUTH_PASSWORD || 'admin1234'
  return username === expectedUser && password === expectedPass
}

export function createSessionToken(username: string) {
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000
  const payload = `${username}.${expiresAt}`
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [username, expiresAtStr, signature] = parts
  const payload = `${username}.${expiresAtStr}`
  const expected = sign(payload)
  if (expected.length !== signature.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return false
  const expiresAt = Number(expiresAtStr)
  return Number.isFinite(expiresAt) && Date.now() <= expiresAt
}
