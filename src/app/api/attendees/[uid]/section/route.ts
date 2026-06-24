import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const { sectionId, position } = await req.json()
  const attendee = await prisma.attendee.update({
    where: { uid },
    data: {
      sectionId: sectionId ? Number(sectionId) : null,
      position: position !== undefined ? (position !== null ? Number(position) : null) : undefined,
    },
  })
  return NextResponse.json({ attendee })
}
