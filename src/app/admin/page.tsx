'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

type Skill = { id: number; imagePath: string }
type Attendee = { uid: string; memberName: string; job: string; sectionId: number | null; skills: Skill[]; tags: string[] }

const ALL_TAGS = ['อาวุธเทพ', 'หัวหน้าทีม']

const JOBS = ['IRONCRAD', 'BLOODSTORM', 'CELESTUNE', 'NIGHTWAKER', 'NUMINA', 'SYLPH', 'DRAGONSVELTE']

function AdminContent() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])

  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ memberName: '', job: '' })
  const [selectedMember, setSelectedMember] = useState<Attendee | null>(null)
  const [memberSkills, setMemberSkills] = useState<Skill[]>([])
  const [memberQuery, setMemberQuery] = useState('')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function flash(msg: string) {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  async function loadSkills() {
    const res = await fetch('/api/skills')
    const data = await res.json()
    setSkills(data.skills)
  }

  async function loadAttendees() {
    const res = await fetch('/api/attendees')
    const data = await res.json()
    setAttendees(data.attendees)
  }

  useEffect(() => { loadSkills(); loadAttendees() }, [])

  async function handleEdit(a: Attendee) {
    setEditingUid(a.uid)
    setEditForm({ memberName: a.memberName, job: a.job })
  }

  async function handleEditSave(uid: string) {
    await fetch(`/api/attendees/${uid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setAttendees((prev) => prev.map((a) => a.uid === uid ? { ...a, ...editForm } : a))
    if (selectedMember?.uid === uid) setSelectedMember((m) => m ? { ...m, ...editForm } : m)
    setEditingUid(null)
    flash('แก้ไขสำเร็จ')
  }

  async function handleDelete(uid: string, name: string) {
    if (!confirm(`ลบ "${name}" ออกจากระบบ?`)) return
    await fetch(`/api/attendees/${uid}`, { method: 'DELETE' })
    setAttendees((prev) => prev.filter((a) => a.uid !== uid))
    if (selectedMember?.uid === uid) setSelectedMember(null)
    flash('ลบ member สำเร็จ')
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/skills/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (selectedMember) {
        await fetch(`/api/attendees/${selectedMember.uid}/skills`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId: data.skill.id }),
        })
        setMemberSkills((prev) => [...prev, data.skill])
      }
    }
    await loadSkills()
    setUploading(false)
    flash('อัปโหลดสำเร็จ')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleDeleteSkill(id: number) {
    if (!confirm('ลบรูป skill นี้ออกจากระบบ?')) return
    await fetch(`/api/skills/${id}`, { method: 'DELETE' })
    setSkills((prev) => prev.filter((s) => s.id !== id))
    setMemberSkills((prev) => prev.filter((s) => s.id !== id))
    flash('ลบสำเร็จ')
  }

  async function selectMember(a: Attendee) {
    setSelectedMember(a)
    const res = await fetch(`/api/attendees/${a.uid}/skills`)
    const data = await res.json()
    setMemberSkills(data.skills)
  }

  async function toggleTag(tag: string) {
    if (!selectedMember) return
    const has = selectedMember.tags?.includes(tag)
    const tags = has
      ? (selectedMember.tags ?? []).filter((t) => t !== tag)
      : [...(selectedMember.tags ?? []), tag]
    await fetch(`/api/attendees/${selectedMember.uid}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    })
    setSelectedMember({ ...selectedMember, tags })
    setAttendees((prev) => prev.map((a) => a.uid === selectedMember.uid ? { ...a, tags } : a))
  }

  async function toggleSkill(skill: Skill) {
    if (!selectedMember) return
    const has = memberSkills.some((s) => s.id === skill.id)
    if (has) {
      await fetch(`/api/attendees/${selectedMember.uid}/skills`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id }),
      })
      setMemberSkills((prev) => prev.filter((s) => s.id !== skill.id))
    } else {
      await fetch(`/api/attendees/${selectedMember.uid}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id }),
      })
      setMemberSkills((prev) => [...prev, skill])
    }
  }

  const filteredMembers = attendees.filter((a) =>
    a.memberName.toLowerCase().includes(memberQuery.toLowerCase()) ||
    a.job.toLowerCase().includes(memberQuery.toLowerCase())
  )

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Admin — Assign Skill</h1>
          <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">← กลับหน้าหลัก</a>
        </div>

        {message && <p className="text-green-400 text-center mb-4 font-medium">{message}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Member list */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="font-semibold text-white mb-3">เลือก Member</h2>
            <input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="ค้นหา..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 mb-3 text-sm focus:outline-none focus:border-blue-500"
            />
            <div className="space-y-1 max-h-[520px] overflow-y-auto">
              {filteredMembers.map((a) => (
                <div key={a.uid} className={`rounded-lg text-sm transition-colors border border-transparent ${selectedMember?.uid === a.uid ? 'bg-blue-900 border-blue-700' : 'hover:bg-gray-800'}`}>
                  {editingUid === a.uid ? (
                    <div className="px-3 py-2 space-y-2">
                      <input
                        value={editForm.memberName}
                        onChange={(e) => setEditForm((f) => ({ ...f, memberName: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs focus:outline-none"
                        placeholder="ชื่อ"
                      />
                      <select
                        value={editForm.job}
                        onChange={(e) => setEditForm((f) => ({ ...f, job: e.target.value }))}
                        className="w-full bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs focus:outline-none"
                      >
                        {JOBS.map((j) => <option key={j} value={j}>{j}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditSave(a.uid)}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded px-2 py-1 text-xs">บันทึก</button>
                        <button onClick={() => setEditingUid(null)}
                          className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded px-2 py-1 text-xs">ยกเลิก</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 px-3 pt-2">
                        <button onClick={() => selectMember(a)} className="flex-1 text-left flex items-center justify-between gap-2 min-w-0">
                          <span className={`font-medium truncate ${selectedMember?.uid === a.uid ? 'text-white' : 'text-gray-300'}`}>{a.memberName}</span>
                          <span className="text-xs text-gray-500 shrink-0">{a.job}</span>
                        </button>
                        <button onClick={() => handleEdit(a)} title="แก้ไข"
                          className="text-gray-500 hover:text-yellow-400 px-1 transition-colors text-xs shrink-0">✎</button>
                        <button onClick={() => handleDelete(a.uid, a.memberName)} title="ลบ"
                          className="text-gray-500 hover:text-red-400 px-1 transition-colors text-xs shrink-0">✕</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Skill panel */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-4">
            {selectedMember ? (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-white text-lg">{selectedMember.memberName}</h2>
                    <p className="text-xs text-blue-300 mb-2">{selectedMember.job}</p>
                    <div className="flex gap-2">
                      {ALL_TAGS.map((tag) => {
                        const has = selectedMember.tags?.includes(tag)
                        return (
                          <button key={tag} onClick={() => toggleTag(tag)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              has ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-transparent text-gray-400 border-gray-600 hover:border-yellow-400 hover:text-yellow-400'
                            }`}>
                            {tag === 'อาวุธเทพ' ? '⚔ ' : '👑 '}{tag}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Upload button */}
                  <label className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    uploading ? 'bg-gray-700 text-gray-400' : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}>
                    {uploading ? 'กำลังอัปโหลด...' : '+ อัปโหลดรูปสกิล'}
                    <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                  </label>
                </div>

                {/* Assigned skills */}
                {memberSkills.length > 0 && (
                  <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                    <p className="text-xs text-gray-400 mb-2">Skill ที่ assign แล้ว ({memberSkills.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {memberSkills.map((s) => (
                        <div key={s.id} className="relative group w-10 h-10 shrink-0">
                          <Image src={s.imagePath} alt="skill icon" width={40} height={40} className="w-10 h-10 rounded-full object-cover border-2 border-green-500" />
                          <button onClick={() => toggleSkill(s)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs hidden group-hover:flex items-center justify-center leading-none">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All skills grid */}
                <p className="text-xs text-gray-400 mb-2">รูป skill ทั้งหมด — คลิกเพื่อ assign / hover เพื่อลบ</p>
                {skills.length === 0 ? (
                  <p className="text-gray-500 text-sm">ยังไม่มีรูป skill — อัปโหลดได้เลย</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                    {skills.map((s) => {
                      const has = memberSkills.some((ms) => ms.id === s.id)
                      return (
                        <div key={s.id} className="relative group w-10 h-10 shrink-0">
                          <button onClick={() => toggleSkill(s)}
                            className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-colors ${
                              has ? 'border-green-500' : 'border-transparent hover:border-gray-500'
                            }`}>
                            <Image src={s.imagePath} alt="skill icon" width={40} height={40} className="object-cover w-full h-full" />
                            {has && (
                              <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                <span className="text-green-400 text-lg font-bold">✓</span>
                              </div>
                            )}
                          </button>
                          <button onClick={() => handleDeleteSkill(s.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-white text-xs hidden group-hover:flex items-center justify-center leading-none z-10">
                            ✕
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
                ← เลือก member จากรายการ
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { setAuthed(true); setPwError('') }
    else setPwError('รหัสผ่านไม่ถูกต้อง')
  }

  if (authed) return <AdminContent />

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <form onSubmit={handleLogin} className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl p-8 w-80">
        <h2 className="text-lg font-bold text-white mb-1">Admin — ยืนยันตัวตน</h2>
        <p className="text-sm text-gray-400 mb-5">ใส่รหัสผ่านเพื่อเข้าหน้า Admin</p>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus
          placeholder="รหัสผ่าน"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 mb-2" />
        {pwError && <p className="text-red-400 text-xs mb-3">{pwError}</p>}
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium transition-colors mt-1">
          เข้าสู่ระบบ
        </button>
        <a href="/" className="block text-center text-xs text-gray-500 hover:text-gray-300 mt-4 transition-colors">← กลับหน้าหลัก</a>
      </form>
    </main>
  )
}
