'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

type Skill = { id: number; imagePath: string }
type Attendee = {
  uid: string; memberName: string; job: string
  sectionId: number | null; attendance: string | null; skills: Skill[]; tags: string[]
}
type Section = { id: number; name: string; attendees: Attendee[] }
type Zone = { id: number; name: string; label: string; sections: Section[] }

const JOBS = ['Ironclad', 'BLOODSTORM', 'CELESTUNE', 'NIGHTWAKER', 'NUMINA', 'SYLPH', 'Dragonsvelte']
const JOB_COLOR: Record<string, string> = {
  Ironclad: '#f59e0b', BLOODSTORM: '#ef4444', CELESTUNE: '#3b82f6',
  NIGHTWAKER: '#06b6d4', NUMINA: '#a855f7', SYLPH: '#ec4899', Dragonsvelte: '#22c55e',
}
const JOB_ICON: Record<string, string> = {
  Ironclad: 'https://cdn.discordapp.com/emojis/1497898275871789166.png',
  SYLPH: 'https://cdn.discordapp.com/emojis/1497905719146709185.png',
  NUMINA: 'https://cdn.discordapp.com/emojis/1489512270202535987.png',
  BLOODSTORM: 'https://cdn.discordapp.com/emojis/1489501000652820510.png',
  NIGHTWAKER: 'https://cdn.discordapp.com/emojis/1497905458139107429.png',
  CELESTUNE: 'https://cdn.discordapp.com/emojis/1489508116403060846.png',
  Dragonsvelte: 'https://cdn.discordapp.com/emojis/1489508543307583488.png',
}
function jobColor(job: string) { return JOB_COLOR[job] ?? '#6b7280' }
const SPECIAL = ['ลา', 'สำรอง']
const CAPACITY = 6

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// ─── Slot Modal (add / edit) ──────────────────────────────────────────────────
type ModalState =
  | { type: 'add'; sectionId: number; sectionName: string }
  | { type: 'edit'; member: Attendee; sectionId: number }

function SlotModal({ state, onClose, onRefresh }: {
  state: ModalState; onClose: () => void; onRefresh: () => void
}) {
  // shared state
  const [tab, setTab] = useState<'pick' | 'new'>('pick')
  const [editTab, setEditTab] = useState<'skills' | 'swap'>('skills')
  const [allAttendees, setAllAttendees] = useState<Attendee[]>([])
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [query, setQuery] = useState('')
  // new member form
  const [form, setForm] = useState({ uid: '', memberName: '', job: JOBS[0] })
  const [newTags, setNewTags] = useState<string[]>([])
  const [newSkills, setNewSkills] = useState<Skill[]>([])
  // edit member skills
  const [memberSkills, setMemberSkills] = useState<Skill[]>(
    state.type === 'edit' ? state.member.skills : []
  )
  const [memberTags, setMemberTags] = useState<string[]>(
    state.type === 'edit' ? (state.member.tags ?? []) : []
  )
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const editFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/attendees').then((r) => r.json()),
      fetch('/api/skills').then((r) => r.json()),
    ]).then(([a, s]) => { setAllAttendees(a.attendees); setAllSkills(s.skills) })
  }, [])

  const unassigned = allAttendees
    .filter((a) => a.sectionId === null)
    .filter((a) => a.memberName.toLowerCase().includes(query.toLowerCase()) || a.uid.includes(query))

  async function assignExisting(uid: string) {
    await fetch(`/api/attendees/${uid}/section`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: state.sectionId }),
    })
    onRefresh(); onClose()
  }

  async function removeFromSection() {
    if (state.type !== 'edit') return
    await fetch(`/api/attendees/${state.member.uid}/section`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: null }),
    })
    onRefresh(); onClose()
  }

  async function toggleMemberTag(tag: string) {
    if (state.type !== 'edit') return
    const has = memberTags.includes(tag)
    const tags = has ? memberTags.filter((t) => t !== tag) : [...memberTags, tag]
    await fetch(`/api/attendees/${state.member.uid}/tags`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    })
    setMemberTags(tags)
    onRefresh()
  }

  async function swapMember(newUid: string) {
    if (state.type !== 'edit') return
    // move current out, new in
    await fetch(`/api/attendees/${state.member.uid}/section`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: null }),
    })
    await fetch(`/api/attendees/${newUid}/section`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: state.sectionId }),
    })
    onRefresh(); onClose()
  }

  async function toggleMemberSkill(skill: Skill) {
    if (state.type !== 'edit') return
    const uid = state.member.uid
    const has = memberSkills.some((s) => s.id === skill.id)
    if (has) {
      await fetch(`/api/attendees/${uid}/skills`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id }),
      })
      setMemberSkills((prev) => prev.filter((s) => s.id !== skill.id))
    } else {
      await fetch(`/api/attendees/${uid}/skills`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id }),
      })
      setMemberSkills((prev) => [...prev, skill])
    }
    onRefresh()
  }

  async function handleUploadForEdit(e: React.ChangeEvent<HTMLInputElement>) {
    if (state.type !== 'edit') return
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/skills/upload', { method: 'POST', body: fd })
      const data = await res.json()
      setAllSkills((prev) => (prev.some((s) => s.id === data.skill.id) ? prev : [...prev, data.skill]))
      // auto-assign to this member
      await fetch(`/api/attendees/${state.member.uid}/skills`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: data.skill.id }),
      })
      setMemberSkills((prev) => [...prev, data.skill])
    }
    setUploading(false)
    if (editFileRef.current) editFileRef.current.value = ''
    onRefresh()
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/skills/upload', { method: 'POST', body: fd })
      const data = await res.json()
      setAllSkills((prev) => (prev.some((s) => s.id === data.skill.id) ? prev : [...prev, data.skill]))
      setNewSkills((prev) => [...prev, data.skill])
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function toggleSkill(skill: Skill) {
    setNewSkills((prev) =>
      prev.some((s) => s.id === skill.id) ? prev.filter((s) => s.id !== skill.id) : [...prev, skill]
    )
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.uid.trim() || !form.memberName.trim()) { setErr('กรุณาใส่ UID และชื่อ'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/attendees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ uid: form.uid.trim(), memberName: form.memberName.trim(), job: form.job, tags: newTags }]),
      })
      if (!res.ok) { setErr('UID ซ้ำหรือเกิดข้อผิดพลาด'); setSaving(false); return }
      for (const skill of newSkills) {
        await fetch(`/api/attendees/${form.uid}/skills`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId: skill.id }),
        })
      }
      await fetch(`/api/attendees/${form.uid}/section`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: state.sectionId }),
      })
      onRefresh(); onClose()
    } catch { setErr('เกิดข้อผิดพลาด') }
    setSaving(false)
  }

  // ── EDIT modal ──
  if (state.type === 'edit') {
    const m = state.member
    return (
      <Modal onClose={onClose}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              {m.tags?.includes('หัวหน้าทีม') && <span className="text-yellow-500">👑</span>}
              <h2 className="text-lg font-bold text-gray-900">{m.memberName}</h2>
              {m.tags?.includes('อาวุธเทพ') && (
                <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">⚔ อาวุธเทพ</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {JOB_ICON[m.job] && <img src={JOB_ICON[m.job]} alt={m.job} width={16} height={16} className="object-contain" />}
              <p className="text-sm font-semibold" style={{ color: jobColor(m.job) }}>{m.job}</p>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">UID: {m.uid}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Tags */}
        <div className="flex gap-2 mb-4">
          {[{ tag: 'หัวหน้าทีม', icon: '👑', cls: 'border-yellow-400 text-yellow-700 bg-yellow-50' }, { tag: 'อาวุธเทพ', icon: '⚔', cls: 'border-orange-400 text-orange-700 bg-orange-50' }].map(({ tag, icon, cls }) => {
            const has = memberTags.includes(tag)
            return (
              <button key={tag} type="button" onClick={() => toggleMemberTag(tag)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${has ? cls : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                <span>{icon}</span>{tag}
              </button>
            )
          })}
        </div>

        {/* Edit Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setEditTab('skills')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${editTab === 'skills' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Skill
          </button>
          <button onClick={() => { setEditTab('swap'); setQuery('') }}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${editTab === 'swap' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            เปลี่ยนคน
          </button>
        </div>

        {editTab === 'skills' && (
          <div>
            {/* Current skills */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Skill ที่มี ({memberSkills.length})</p>
              <label className={`cursor-pointer text-xs px-3 py-1 rounded-full font-medium transition-colors ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
                {uploading ? 'กำลังอัปโหลด...' : '+ อัปโหลดรูป'}
                <input ref={editFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUploadForEdit} disabled={uploading} />
              </label>
            </div>
            {memberSkills.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3 p-2 bg-green-50 rounded-xl border border-green-200">
                {memberSkills.map((s) => (
                  <div key={s.id} className="relative group">
                    <Image src={s.imagePath} alt="skill" width={40} height={40} className="rounded-full border-2 border-green-400 object-cover" />
                    <button onClick={() => toggleMemberSkill(s)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs hidden group-hover:flex items-center justify-center leading-none">✕</button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">คลิกเพื่อเพิ่ม/ลบ</p>
            {allSkills.length === 0
              ? <p className="text-gray-400 text-sm text-center py-4">ยังไม่มีรูป skill</p>
              : (
                <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto bg-gray-50 rounded-xl p-2">
                  {allSkills.map((s) => {
                    const has = memberSkills.some((ms) => ms.id === s.id)
                    return (
                      <button key={s.id} type="button" onClick={() => toggleMemberSkill(s)}
                        className={`rounded-lg overflow-hidden border-2 transition-colors aspect-square ${has ? 'border-green-500 ring-2 ring-green-200' : 'border-transparent hover:border-gray-300'}`}>
                        <Image src={s.imagePath} alt="skill" width={40} height={40} className="object-cover w-full h-full" />
                      </button>
                    )
                  })}
                </div>
              )
            }
          </div>
        )}

        {editTab === 'swap' && (
          <div>
            <p className="text-xs text-gray-400 mb-3">เลือกสมาชิกใหม่เพื่อสลับกับ <span className="font-semibold text-gray-700">{m.memberName}</span></p>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อหรือ UID..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400 text-gray-900 placeholder-gray-400" />
            {unassigned.length === 0
              ? <p className="text-gray-400 text-sm text-center py-4">ไม่มีสมาชิกที่ยังไม่ได้ assign</p>
              : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {unassigned.map((a) => (
                    <button key={a.uid} onClick={() => swapMember(a.uid)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors text-left">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ background: jobColor(a.job) }}>
                        {a.memberName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{a.memberName}</p>
                        <div className="flex items-center gap-1">
                          {JOB_ICON[a.job] && <img src={JOB_ICON[a.job]} alt={a.job} width={12} height={12} className="object-contain" />}
                          <p className="text-xs font-medium" style={{ color: jobColor(a.job) }}>{a.job}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{a.uid}</span>
                    </button>
                  ))}
                </div>
              )
            }
          </div>
        )}

        <hr className="my-4" />
        <button onClick={removeFromSection}
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl py-2.5 text-sm font-medium transition-colors">
          ย้ายออกจาก section
        </button>
      </Modal>
    )
  }

  // ── ADD modal ──
  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">เพิ่มสมาชิก → <span className="text-blue-600">{state.sectionName}</span></h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
        {(['pick', 'new'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'pick' ? 'เลือกสมาชิก' : 'เพิ่มสมาชิกใหม่'}
          </button>
        ))}
      </div>

      {tab === 'pick' && (
        <div>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อหรือ UID..."
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-400 text-gray-900 placeholder-gray-400" />
          {unassigned.length === 0
            ? <p className="text-gray-400 text-sm text-center py-8">ไม่มีสมาชิกที่ยังไม่ได้ assign</p>
            : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {unassigned.map((a) => (
                  <button key={a.uid} onClick={() => assignExisting(a.uid)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors text-left">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: jobColor(a.job) }}>
                      {a.memberName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{a.memberName}</p>
                      <div className="flex items-center gap-1">
                        {JOB_ICON[a.job] && <img src={JOB_ICON[a.job]} alt={a.job} width={12} height={12} className="object-contain" />}
                        <p className="text-xs font-medium" style={{ color: jobColor(a.job) }}>{a.job}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{a.uid}</span>
                  </button>
                ))}
              </div>
            )}
        </div>
      )}

      {tab === 'new' && (
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">UID</label>
            <input value={form.uid} onChange={(e) => setForm((f) => ({ ...f, uid: e.target.value }))}
              placeholder="เช่น 9405303500"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-gray-900 placeholder-gray-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">ชื่อ</label>
            <input value={form.memberName} onChange={(e) => setForm((f) => ({ ...f, memberName: e.target.value }))}
              placeholder="ชื่อ member"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-gray-900 placeholder-gray-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">อาชีพ</label>
            <select value={form.job} onChange={(e) => setForm((f) => ({ ...f, job: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-gray-900">
              {JOBS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Skill</label>
              <label className={`cursor-pointer text-xs px-3 py-1 rounded-full font-medium transition-colors ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
                {uploading ? 'กำลังอัปโหลด...' : '+ อัปโหลดรูป'}
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
            {allSkills.length > 0 ? (
              <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto bg-gray-50 rounded-xl p-2">
                {allSkills.map((s) => {
                  const selected = newSkills.some((ns) => ns.id === s.id)
                  return (
                    <button key={s.id} type="button" onClick={() => toggleSkill(s)}
                      className={`rounded-lg overflow-hidden border-2 transition-colors aspect-square ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'}`}>
                      <Image src={s.imagePath} alt="skill" width={40} height={40} className="object-cover w-full h-full" />
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-xl">ยังไม่มีรูป skill — อัปโหลดได้เลย</p>
            )}
            {newSkills.length > 0 && (
              <p className="text-xs text-blue-600 mt-1.5 font-medium">เลือกแล้ว {newSkills.length} skill</p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Tag</label>
            <div className="flex gap-2">
              {[{ tag: 'หัวหน้าทีม', icon: '👑', cls: 'border-yellow-400 text-yellow-700 bg-yellow-50' }, { tag: 'อาวุธเทพ', icon: '⚔', cls: 'border-orange-400 text-orange-700 bg-orange-50' }].map(({ tag, icon, cls }) => {
                const has = newTags.includes(tag)
                return (
                  <button key={tag} type="button"
                    onClick={() => setNewTags((prev) => has ? prev.filter((t) => t !== tag) : [...prev, tag])}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${has ? cls : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                    <span>{icon}</span>{tag}
                  </button>
                )
              })}
            </div>
          </div>

          {err && <p className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2">{err}</p>}

          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
            {saving ? 'กำลังบันทึก...' : 'เพิ่มสมาชิก'}
          </button>
        </form>
      )}
    </Modal>
  )
}

// ─── Member Card ──────────────────────────────────────────────────────────────
function MemberCard({ member, adminMode, onClick }: {
  member: Attendee; adminMode: boolean; onClick: () => void
}) {
  const isLeader = member.tags?.includes('หัวหน้าทีม')
  const borderColor = isLeader ? '#eab308' : jobColor(member.job)

  return (
    <div
      onClick={adminMode ? onClick : undefined}
      className={`relative rounded-xl p-3 bg-white shadow-sm border-2 text-center transition-shadow ${adminMode ? 'cursor-pointer hover:shadow-md hover:ring-2 ring-blue-300' : ''}`}
      style={{ borderColor }}>
      {adminMode && <div className="absolute top-1.5 right-1.5 text-gray-300 text-xs">✎</div>}
      <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5">
        <img src="https://cdn.discordapp.com/emojis/1485667835182059622.png" alt="4AM" width={16} height={16} className="object-contain" />
        {isLeader && <span className="text-yellow-500 text-xs">👑</span>}
      </div>
      <p className="font-bold text-gray-900 text-sm leading-tight mb-0.5">{member.memberName}</p>
      <div className="flex items-center justify-center gap-1 mb-1">
        {JOB_ICON[member.job] && (
          <img src={JOB_ICON[member.job]} alt={member.job} width={14} height={14} className="object-contain" />
        )}
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: jobColor(member.job) }}>{member.job}</p>
      </div>
      {member.tags?.includes('อาวุธเทพ') && (
        <span className="inline-block bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold px-2 py-0.5 rounded-full mb-1">⚔ อาวุธเทพ</span>
      )}
      {member.skills.length > 0 && (
        <div className="flex justify-center gap-1 mb-1.5 flex-wrap">
          {member.skills.map((s) => <Image key={s.id} src={s.imagePath} alt="skill" width={18} height={18} className="rounded-full object-cover" />)}
        </div>
      )}
      <p className="text-gray-400 text-xs">UID: {member.uid}</p>
    </div>
  )
}

// ─── Empty Slot ───────────────────────────────────────────────────────────────
function EmptySlot({ adminMode, onClick }: { adminMode: boolean; onClick: () => void }) {
  return (
    <div
      onClick={adminMode ? onClick : undefined}
      className={`rounded-xl border-2 border-dashed text-center py-6 transition-colors ${adminMode ? 'border-blue-300 text-blue-400 hover:bg-blue-50 hover:border-blue-500 cursor-pointer' : 'border-gray-200 text-gray-300'}`}>
      {adminMode ? (
        <>
          <p className="text-2xl font-light leading-none mb-0.5">+</p>
          <p className="text-xs font-semibold tracking-wide">ADD</p>
        </>
      ) : (
        <p className="text-xs">ว่าง</p>
      )}
    </div>
  )
}

// ─── Section Column ───────────────────────────────────────────────────────────
function SectionColumn({ section, label, adminMode, capped, onSlotClick }: {
  section: Section; label?: string; adminMode: boolean; capped?: boolean
  onSlotClick: (type: 'add' | 'edit', member?: Attendee) => void
}) {
  const sorted = [...section.attendees].sort((a, b) => {
    const aL = a.tags?.includes('หัวหน้าทีม') ? 0 : 1
    const bL = b.tags?.includes('หัวหน้าทีม') ? 0 : 1
    return aL - bL
  })
  const emptyCount = capped ? Math.max(0, CAPACITY - sorted.length) : 0

  return (
    <div>
      <div className="flex items-center gap-1 mb-2 justify-center">
        <span className="text-gray-400 text-sm">×</span>
        <h2 className="font-bold text-gray-700">{label ?? section.name}</h2>
        <span className="text-xs text-gray-400">({section.attendees.length})</span>
      </div>
      <div className="flex flex-col gap-2">
        {sorted.map((m) => (
          <MemberCard key={m.uid} member={m} adminMode={adminMode} onClick={() => onSlotClick('edit', m)} />
        ))}
        {Array.from({ length: emptyCount }, (_, i) => (
          <EmptySlot key={`e${i}`} adminMode={adminMode} onClick={() => onSlotClick('add')} />
        ))}
        {!capped && sorted.length === 0 && (
          <EmptySlot adminMode={adminMode} onClick={() => onSlotClick('add')} />
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type ViewMode = 'TeamA' | 'TeamB' | 'TeamC' | 'ลา' | 'สำรอง' | 'ทั้งหมด'

export default function Home() {
  const [zones, setZones] = useState<Zone[]>([])
  const [view, setView] = useState<ViewMode>('TeamA')
  const [adminMode, setAdminMode] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [search, setSearch] = useState('')
  const [slotModal, setSlotModal] = useState<ModalState | null>(null)

  async function load() {
    const res = await fetch('/api/zones')
    const data = await res.json()
    setZones(data.zones)
  }
  useEffect(() => { load() }, [])

  async function handleAdminToggle() {
    if (adminMode) { setAdminMode(false); return }
    setShowModal(true); setPassword(''); setPwError('')
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { setAdminMode(true); setShowModal(false); setPassword(''); setPwError('') }
    else setPwError('รหัสผ่านไม่ถูกต้อง')
  }

  function zoneOf(name: string) { return zones.find((z) => z.name === name) }

  function getSections(): { section: Section; label?: string; capped?: boolean }[] {
    if (view === 'ทั้งหมด') {
      const regular = ['TeamA', 'TeamB', 'TeamC'].flatMap((t) =>
        (zoneOf(t)?.sections ?? []).filter((s) => !SPECIAL.includes(s.name)).map((s) => ({ section: s, capped: true }))
      )
      const special = SPECIAL.flatMap((sp) =>
        zones.flatMap((z) => z.sections.filter((s) => s.name === sp).map((s) => ({ section: s })))
      )
      return [...regular, ...special]
    }
    if (view === 'ลา' || view === 'สำรอง') {
      return zones.flatMap((z) => z.sections.filter((s) => s.name === view)).map((s) => ({ section: s }))
    }
    return (zoneOf(view)?.sections ?? []).filter((s) => !SPECIAL.includes(s.name)).map((s) => ({ section: s, capped: true }))
  }

  const rawSections = getSections()
  const q = search.trim().toLowerCase()
  const sections = q
    ? rawSections.map(({ section, label, capped }) => ({
        label, capped,
        section: { ...section, attendees: section.attendees.filter((a) => a.memberName.toLowerCase().includes(q) || a.uid.includes(q)) },
      })).filter(({ section }) => section.attendees.length > 0)
    : rawSections

  const allMembers = rawSections.flatMap((s) => s.section.attendees)
  const laSection = zones.flatMap((z) => z.sections).find((s) => s.name === 'ลา')
  const laCount = laSection?.attendees.length ?? 0
  const maCount = allMembers.length - laCount

  const TABS: ViewMode[] = ['TeamA', 'TeamB', 'TeamC', 'ลา', 'สำรอง', 'ทั้งหมด']
  const TAB_COLOR: Partial<Record<ViewMode, string>> = { ลา: 'bg-red-500 text-white', สำรอง: 'bg-yellow-500 text-white' }
  const TAB_INACTIVE: Partial<Record<ViewMode, string>> = { ลา: 'text-red-500 border border-red-300', สำรอง: 'text-yellow-600 border border-yellow-300' }
  const colCount = Math.min(sections.length, 5)

  function openSlotModal(section: Section, type: 'add' | 'edit', member?: Attendee) {
    if (!adminMode) return
    if (type === 'edit' && member) {
      setSlotModal({ type: 'edit', member, sectionId: section.id })
    } else {
      setSlotModal({ type: 'add', sectionId: section.id, sectionName: section.name })
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-6">
      <div className="max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-4 items-center justify-center flex-wrap">
          {TABS.map((t) => (
            <button key={t} onClick={() => setView(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${view === t ? (TAB_COLOR[t] ?? 'bg-gray-800 text-white') : (TAB_INACTIVE[t] ?? 'bg-white text-gray-600 hover:bg-gray-200')}`}>
              {t}
              {t === 'ลา' && laCount > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${view === 'ลา' ? 'bg-white/30 text-white' : 'bg-red-500 text-white'}`}>{laCount}</span>
              )}
            </button>
          ))}
          <button onClick={handleAdminToggle}
            className={`ml-3 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${adminMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400'}`}>
            {adminMode ? '✎ Admin Mode' : '✎ แก้ไข'}
          </button>
        </div>

        {adminMode && <p className="text-center text-blue-600 text-sm mb-2 font-medium">คลิกที่ card หรือช่องว่าง เพื่อเพิ่ม/แก้ไข</p>}

        {/* Search */}
        <div className="relative mb-4 max-w-sm mx-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ หรือ UID..."
            className="w-full bg-white border-2 border-gray-400 rounded-full pl-8 pr-9 py-1.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 shadow-sm" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">✕</button>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-xl font-bold text-gray-800 tracking-wide">
              {view === 'ทั้งหมด' ? 'ทั้งหมด' : view === 'ลา' || view === 'สำรอง' ? `${view} (ทุก Team)` : (zoneOf(view)?.label ?? view)}
            </h1>
            <div className="flex gap-2 text-sm">
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">มา: {maCount}</span>
              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">ลา: {laCount}</span>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">รวม: {allMembers.length}</span>
            </div>
          </div>

          {q && sections.length === 0 && (
            <p className="text-center text-gray-400 py-8">ไม่พบ "{search}"</p>
          )}

          {view === 'ทั้งหมด' ? (
            <div className="space-y-8">
              {Array.from({ length: Math.ceil(sections.length / 5) }, (_, rowIdx) => {
                const row = sections.slice(rowIdx * 5, rowIdx * 5 + 5)
                return (
                  <div key={rowIdx} className="grid grid-cols-5 gap-4">
                    {row.map(({ section, label, capped }) => (
                      <SectionColumn key={section.id} section={section} label={label} adminMode={adminMode} capped={capped}
                        onSlotClick={(type, member) => openSlotModal(section, type, member)} />
                    ))}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid gap-4 min-w-max" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(160px, 1fr))` }}>
                {sections.map(({ section, label, capped }) => (
                  <SectionColumn key={section.id} section={section} label={label} adminMode={adminMode} capped={capped}
                    onSlotClick={(type, member) => openSlotModal(section, type, member)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slot Modal */}
      {slotModal && (
        <SlotModal state={slotModal} onClose={() => setSlotModal(null)} onRefresh={load} />
      )}

      {/* Password Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form onSubmit={handlePasswordSubmit} className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h2 className="text-lg font-bold text-gray-800 mb-1">เข้าสู่ Admin Mode</h2>
            <p className="text-sm text-gray-400 mb-4">ใส่รหัสผ่านเพื่อแก้ไขข้อมูล</p>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus
              placeholder="รหัสผ่าน"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 mb-2" />
            {pwError && <p className="text-red-500 text-xs mb-2">{pwError}</p>}
            <div className="flex gap-2 mt-1">
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium transition-colors">เข้าสู่ระบบ</button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg py-2 text-sm transition-colors">ยกเลิก</button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
