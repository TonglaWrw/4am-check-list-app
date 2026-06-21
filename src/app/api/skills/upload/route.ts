import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const filename = `skill_${Date.now()}${path.extname(file.name)}`
  const filepath = path.join(process.cwd(), 'public', 'image', filename)
  await writeFile(filepath, buffer)

  const skill = await prisma.skill.create({ data: { imagePath: `/image/${filename}` } })
  return NextResponse.json({ skill })
}
