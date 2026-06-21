import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const { memberName, job } = await req.json()
  const attendee = await prisma.attendee.update({
    where: { uid },
    data: { memberName, job },
  })
  return NextResponse.json({ attendee })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  await prisma.attendeeSkill.deleteMany({ where: { attendeeUid: uid } })
  await prisma.attendee.delete({ where: { uid } })
  return NextResponse.json({ ok: true })
}
