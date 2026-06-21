import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { prisma } from '@/lib/prisma'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const skill = await prisma.skill.findUnique({ where: { id: Number(id) } })
  if (!skill) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await prisma.attendeeSkill.deleteMany({ where: { skillId: Number(id) } })
  await prisma.skill.delete({ where: { id: Number(id) } })

  // delete from Vercel Blob if it's a blob URL
  if (skill.imagePath.startsWith('https://')) {
    try { await del(skill.imagePath) } catch {}
  }

  return NextResponse.json({ ok: true })
}
