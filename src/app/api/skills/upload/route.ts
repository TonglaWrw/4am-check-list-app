import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import path from 'path'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 })

  const filename = `skill_${Date.now()}${path.extname(file.name)}`
  const blob = await put(filename, file, { access: 'public' })

  const skill = await prisma.skill.create({ data: { imagePath: blob.url } })
  return NextResponse.json({ skill })
}
