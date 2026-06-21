import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const rows = await prisma.attendeeSkill.findMany({
    where: { attendeeUid: uid },
    include: { skill: true },
  })
  return NextResponse.json({ skills: rows.map((r) => r.skill) })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const { skillId } = await req.json()
  await prisma.attendeeSkill.upsert({
    where: { attendeeUid_skillId: { attendeeUid: uid, skillId: Number(skillId) } },
    create: { attendeeUid: uid, skillId: Number(skillId) },
    update: {},
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const { skillId } = await req.json()
  await prisma.attendeeSkill.delete({
    where: { attendeeUid_skillId: { attendeeUid: uid, skillId: Number(skillId) } },
  })
  return NextResponse.json({ ok: true })
}
