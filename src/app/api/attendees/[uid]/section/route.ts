import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const { sectionId, position, kind } = await req.json()
  const isPractice = kind === 'practice'
  const attendee = await prisma.attendee.update({
    where: { uid },
    data: isPractice ? {
      practiceSectionId: sectionId ? Number(sectionId) : null,
      practicePosition: position !== undefined ? (position !== null ? Number(position) : null) : undefined,
    } : {
      sectionId: sectionId ? Number(sectionId) : null,
      position: position !== undefined ? (position !== null ? Number(position) : null) : undefined,
    },
  })
  return NextResponse.json({ attendee })
}
