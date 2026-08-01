import { NextRequest, NextResponse } from 'next/server'
import { checkCredentials, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (typeof username !== 'string' || typeof password !== 'string' || !checkCredentials(username, password)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, createSessionToken(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
