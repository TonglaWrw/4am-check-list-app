import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const list = Array.isArray(body) ? body : [body]

  const created = await prisma.attendee.createMany({
    data: list.map((p: any) => ({
      uid: p.uid,
      memberName: p.memberName,
      job: p.job || null,
    })),
    skipDuplicates: true,
  })

  return NextResponse.json({ count: created.count })
}

export async function GET() {
  const attendees = await prisma.attendee.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      skills: { include: { skill: true } },
    },
  })
  return NextResponse.json({
    attendees: attendees.map((a) => ({
      ...a,
      skills: a.skills.map((s) => s.skill),
    })),
  })
}
