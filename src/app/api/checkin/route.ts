import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { uid, attendance } = await req.json()

  if (attendance === 'ลา') {
    // find ลา section
    const laSection = await prisma.section.findFirst({ where: { name: 'ลา' } })
    const current = await prisma.attendee.findUnique({ where: { uid }, select: { sectionId: true } })

    const attendee = await prisma.attendee.update({
      where: { uid },
      data: {
        attendance,
        attendanceAt: new Date(),
        prevSectionId: current?.sectionId ?? null,
        sectionId: laSection?.id ?? null,
      },
    })
    return NextResponse.json({ attendee })
  }

  // un-ลา: restore previous section
  const current = await prisma.attendee.findUnique({ where: { uid }, select: { attendance: true, prevSectionId: true } })
  const wasLa = current?.attendance === 'ลา'

  const attendee = await prisma.attendee.update({
    where: { uid },
    data: {
      attendance,
      attendanceAt: new Date(),
      ...(wasLa ? { sectionId: current?.prevSectionId ?? null, prevSectionId: null } : {}),
    },
  })
  return NextResponse.json({ attendee })
}
