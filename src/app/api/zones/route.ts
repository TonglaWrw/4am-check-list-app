import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const zones = await prisma.zone.findMany({
    orderBy: { id: 'asc' },
    include: {
      sections: {
        orderBy: { id: 'asc' },
        include: {
          attendees: {
            include: { skills: { include: { skill: true } } },
            orderBy: [{ position: 'asc' }, { memberName: 'asc' }],
          },
          practiceAttendees: {
            include: { skills: { include: { skill: true } } },
            orderBy: [{ practicePosition: 'asc' }, { memberName: 'asc' }],
          },
        },
      },
    },
  })
  return NextResponse.json({
    zones: zones.map((z) => ({
      ...z,
      sections: z.sections.map((s) => {
        const rows = z.isPractice ? s.practiceAttendees : s.attendees
        return {
          ...s,
          attendees: rows.map((a) => ({
            ...a,
            sectionId: z.isPractice ? a.practiceSectionId : a.sectionId,
            position: z.isPractice ? a.practicePosition : a.position,
            skills: a.skills.map((as) => as.skill),
          })),
        }
      }),
    })),
  })
}
