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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await prisma.attendee.updateMany({
    where: { sectionId: Number(id) },
    data: { sectionId: null, position: null },
  })
  return NextResponse.json({ cleared: result.count })
}
