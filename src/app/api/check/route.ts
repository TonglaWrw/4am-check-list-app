import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { query } = await req.json()

  if (!query || query.trim().length < 1) {
    return NextResponse.json({ results: [] })
  }

  const results = await prisma.attendee.findMany({
    where: {
      memberName: { contains: query, mode: 'insensitive' },
    },
    take: 10,
  })

  return NextResponse.json({ results })
}
