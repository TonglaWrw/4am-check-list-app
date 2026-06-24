import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const zones = await prisma.zone.findMany({
    orderBy: { id: 'asc' },
    include: {
      sections: {
        orderBy: { name: 'asc' },
        include: {
          attendees: {
            include: { skills: { include: { skill: true } } },
            orderBy: [{ position: 'asc' }, { memberName: 'asc' }],
          },
        },
      },
    },
  })
  return NextResponse.json({
    zones: zones.map((z) => ({
      ...z,
      sections: z.sections.map((s) => ({
        ...s,
        attendees: s.attendees.map((a) => ({
          ...a,
          skills: a.skills.map((as) => as.skill),
        })),
      })),
    })),
  })
}
