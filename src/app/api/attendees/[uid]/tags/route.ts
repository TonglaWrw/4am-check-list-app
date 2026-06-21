import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const { tags } = await req.json()
  const attendee = await prisma.attendee.update({
    where: { uid },
    data: { tags },
  })
  return NextResponse.json({ attendee })
}
