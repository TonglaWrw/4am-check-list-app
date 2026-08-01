import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const section = await prisma.section.update({
    where: { id: Number(id) },
    data: { name: name.trim() },
  })
  return NextResponse.json({ section })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { kind } = await req.json().catch(() => ({ kind: undefined }))
  const isPractice = kind === 'practice'
  const result = await prisma.attendee.updateMany({
    where: isPractice ? { practiceSectionId: Number(id) } : { sectionId: Number(id) },
    data: isPractice ? { practiceSectionId: null, practicePosition: null } : { sectionId: null, position: null },
  })
  return NextResponse.json({ cleared: result.count })
}
