'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'

type Skill = { id: number; imagePath: string }
type Attendee = {
  uid: string; memberName: string; job: string
  sectionId: number | null; position: number | null; attendance: string | null; skills: Skill[]; tags: string[]
}
type Section = { id: number; name: string; attendees: Attendee[] }
type Zone = { id: number; name: string; label: string; sections: Section[] }

const JOBS = ['IRONCLAD', 'BLOODSTORM', 'CELESTUNE', 'NIGHTWAKER', 'NUMINA', 'SYLPH', 'DRAGONSVELTE']
const JOB_COLOR: Record<string, string> = {
  IRONCLAD: '#f59e0b', BLOODSTORM: '#ef4444', CELESTUNE: '#3b82f6',
  NIGHTWAKER: '#06b6d4', NUMINA: '#a855f7', SYLPH: '#ec4899', DRAGONSVELTE: '#22c55e',
}
const JOB_ICON: Record<string, string> = {
  IRONCLAD: 'https://cdn.discordapp.com/emojis/1497898275871789166.png',
  SYLPH: 'https://cdn.discordapp.com/emojis/1497905719146709185.png',
  NUMINA: 'https://cdn.discordapp.com/emojis/1489512270202535987.png',
  BLOODSTORM: 'https://cdn.discordapp.com/emojis/1489501000652820510.png',
  NIGHTWAKER: 'https://cdn.discordapp.com/emojis/1497905458139107429.png',
  CELESTUNE: 'https://cdn.discordapp.com/emojis/1489508116403060846.png',
  DRAGONSVELTE: 'https://cdn.discordapp.com/emojis/1489508543307583488.png',
}
function jobColor(job: string) { return JOB_COLOR[job] ?? '#6b7280' }
const SPECIAL = ['ลา', 'สำรอง']
const CAPACITY = 6

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', border: '1px solid rgba(255,255,255,0.15)' }}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// ─── Slot Modal (add / edit) ──────────────────────────────────────────────────
type ModalState =
  | { type: 'add'; sectionId: number; sectionName: string; position: number }
  | { type: 'edit'; member: Attendee; sectionId: number; teamAttendees: Attendee[] }

function SlotModal({ state, onClose, onRefresh, onQuickMove, onOptimisticMove, onOptimisticSkillUpdate }: {
  state: ModalState; onClose: () => void; onRefresh: () => void
  onQuickMove?: (uid: string, target: 'ลา' | 'สำรอง') => void
  onOptimisticMove?: (uid: string, targetSectionId: number | null, newMember?: Attendee, newPosition?: number | null) => void
  onOptimisticSkillUpdate?: (uid: string, skills: Skill[]) => void
}) {
  // shared state
  const [tab, setTab] = useState<'pick' | 'new'>('pick')
  const [editTab, setEditTab] = useState<'skills' | 'swap'>('skills')
  const [allAttendees, setAllAttendees] = useState<Attendee[]>([])
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [query, setQuery] = useState('')
  const [jobFilter, setJobFilter] = useState<string | null>(null)
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
  const [leaderConflict, setLeaderConflict] = useState<Attendee | null>(null)
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
    .filter((a) => !jobFilter || a.job === jobFilter)

  async function assignExisting(uid: string) {
    const pos = state.type === 'add' ? state.position : null
    const member = allAttendees.find((a) => a.uid === uid)
    onOptimisticMove?.(uid, state.sectionId, member ? { ...member, sectionId: state.sectionId, position: pos } : undefined, pos)
    onClose()
    fetch(`/api/attendees/${uid}/section`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: state.sectionId, position: pos }),
    })
  }

  async function removeFromSection() {
    if (state.type !== 'edit') return
    onOptimisticMove?.(state.member.uid, null)
    onClose()
    fetch(`/api/attendees/${state.member.uid}/section`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: null, position: null }),
    })
  }

  async function toggleMemberTag(tag: string) {
    if (state.type !== 'edit') return
    const has = memberTags.includes(tag)

    // Check for leader conflict before assigning
    if (tag === 'หัวหน้าทีม' && !has) {
      const currentLeader = state.teamAttendees.find(
        (a) => a.uid !== state.member.uid && a.tags?.includes('หัวหน้าทีม')
      )
      if (currentLeader) {
        setLeaderConflict(currentLeader)
        return
      }
    }

    const tags = has ? memberTags.filter((t) => t !== tag) : [...memberTags, tag]
    setMemberTags(tags)
    fetch(`/api/attendees/${state.member.uid}/tags`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    })
  }

  async function confirmLeaderSwap() {
    if (state.type !== 'edit' || !leaderConflict) return
    const oldTags = (leaderConflict.tags ?? []).filter((t) => t !== 'หัวหน้าทีม')
    const newTagsList = [...memberTags.filter((t) => t !== 'หัวหน้าทีม'), 'หัวหน้าทีม']
    setMemberTags(newTagsList)
    setLeaderConflict(null)
    Promise.all([
      fetch(`/api/attendees/${leaderConflict.uid}/tags`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: oldTags }),
      }),
      fetch(`/api/attendees/${state.member.uid}/tags`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTagsList }),
      }),
    ])
  }

  async function swapMember(newUid: string) {
    if (state.type !== 'edit') return
    const incomingMember = allAttendees.find((a) => a.uid === newUid)
    onOptimisticMove?.(state.member.uid, null)
    onOptimisticMove?.(newUid, state.sectionId, incomingMember ? { ...incomingMember, sectionId: state.sectionId, position: null } : undefined)
    onClose()
    Promise.all([
      fetch(`/api/attendees/${state.member.uid}/section`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: null, position: null }),
      }),
      fetch(`/api/attendees/${newUid}/section`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: state.sectionId, position: null }),
      }),
    ])
  }

  async function toggleMemberSkill(skill: Skill) {
    if (state.type !== 'edit') return
    const uid = state.member.uid
    const has = memberSkills.some((s) => s.id === skill.id)
    if (has) {
      const updated = memberSkills.filter((s) => s.id !== skill.id)
      setMemberSkills(updated)
      onOptimisticSkillUpdate?.(uid, updated)
      fetch(`/api/attendees/${uid}/skills`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id }),
      })
    } else {
      const updated = [...memberSkills, skill]
      setMemberSkills(updated)
      onOptimisticSkillUpdate?.(uid, updated)
      fetch(`/api/attendees/${uid}/skills`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id }),
      })
    }
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
    const uid = form.uid.trim()
    const memberName = form.memberName.trim()
    if (!uid || !memberName) { setErr('กรุณาใส่ UID และชื่อ'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/attendees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ uid, memberName, job: form.job, tags: newTags }]),
      })
      if (!res.ok) { setErr('UID ซ้ำหรือเกิดข้อผิดพลาด'); setSaving(false); return }

      // Optimistic: add new member to section immediately
      const pos = state.type === 'add' ? state.position : null
      const newMember: Attendee = {
        uid, memberName, job: form.job, tags: newTags, skills: newSkills,
        sectionId: state.sectionId, position: pos, attendance: null,
      }
      onOptimisticMove?.(uid, state.sectionId, newMember, pos)
      onClose()

      // Background: assign skills + section then sync
      const tasks: Promise<unknown>[] = newSkills.map((skill) =>
        fetch(`/api/attendees/${uid}/skills`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId: skill.id }),
        })
      )
      tasks.push(fetch(`/api/attendees/${uid}/section`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: state.sectionId, position: pos }),
      }))
      Promise.all(tasks).then(() => onRefresh())
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
              <h2 className="text-lg font-bold text-white">{m.memberName}</h2>
            </div>
            <div className="flex items-center gap-1">
              {JOB_ICON[m.job] && <img src={JOB_ICON[m.job]} alt={m.job} width={16} height={16} className="object-contain" />}
              <p className="text-sm font-semibold" style={{ color: jobColor(m.job) }}>{m.job}</p>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">UID: {m.uid}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        {/* Tags + Quick move */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(() => {
            const has = memberTags.includes('หัวหน้าทีม')
            return (
              <button type="button" onClick={() => toggleMemberTag('หัวหน้าทีม')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${has ? 'border-yellow-400 text-yellow-300 bg-yellow-900/40' : 'border-white/20 text-gray-400 hover:border-white/40'}`}>
                <span>👑</span>หัวหน้าทีม
              </button>
            )
          })()}
          {onQuickMove && (
            <>
              <button type="button"
                onClick={() => { onQuickMove(m.uid, 'ลา'); onClose() }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-red-500/50 text-red-400 hover:bg-red-900/40 hover:border-red-400 transition-colors">
                🏃 ลา
              </button>
              <button type="button"
                onClick={() => { onQuickMove(m.uid, 'สำรอง'); onClose() }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-yellow-500/50 text-yellow-400 hover:bg-yellow-900/40 hover:border-yellow-400 transition-colors">
                ⏳ สำรอง
              </button>
            </>
          )}
        </div>

        {/* Leader conflict confirmation */}
        {leaderConflict && (
          <div className="mb-4 p-3 rounded-xl border border-yellow-500/40 bg-yellow-900/20">
            <p className="text-yellow-300 text-sm font-semibold mb-1">⚠️ มีหัวหน้าทีมอยู่แล้ว</p>
            <p className="text-gray-300 text-xs mb-3">
              <span className="text-white font-bold">{leaderConflict.memberName}</span> เป็นหัวหน้าทีมอยู่
              ต้องการเปลี่ยนให้ <span className="text-white font-bold">{m.memberName}</span> เป็นหัวหน้าทีมแทนไหม?
            </p>
            <div className="flex gap-2">
              <button onClick={confirmLeaderSwap}
                className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg py-1.5 text-xs font-semibold transition-colors">
                เปลี่ยนเลย
              </button>
              <button onClick={() => setLeaderConflict(null)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg py-1.5 text-xs transition-colors">
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Edit Tabs */}
        <div className="flex gap-1 mb-4 bg-black/30 rounded-xl p-1">
          <button onClick={() => setEditTab('skills')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${editTab === 'skills' ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
            Skill
          </button>
          <button onClick={() => { setEditTab('swap'); setQuery(''); setJobFilter(null) }}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${editTab === 'swap' ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
            เปลี่ยนคน
          </button>
        </div>

        {editTab === 'skills' && (
          <div>
            {/* Current skills */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Skill ที่มี ({memberSkills.length})</p>
              <div className="flex flex-col items-end gap-1">
                <label className={`cursor-pointer text-xs px-3 py-1 rounded-full font-medium transition-colors ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
                  {uploading ? 'กำลังอัปโหลด...' : '+ อัปโหลดรูป'}
                  <input ref={editFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUploadForEdit} disabled={uploading} />
                </label>
                <p className="text-xs text-yellow-400/80">⚠ อัปรูปสกิลเท่านั้นนะ อย่าไปเอารูปใครมาอัป</p>
              </div>
            </div>
            {memberSkills.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3 p-2 bg-green-50 rounded-xl border border-green-200">
                {memberSkills.map((s) => (
                  <div key={s.id} className="relative group w-10 h-10 shrink-0">
                    <Image src={s.imagePath} alt="skill" width={40} height={40} className="w-10 h-10 rounded-full border-2 border-green-400 object-cover" />
                    <button onClick={() => toggleMemberSkill(s)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs hidden group-hover:flex items-center justify-center leading-none">✕</button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">คลิกเพื่อเพิ่ม/ลบ</p>
            {allSkills.length === 0
              ? <p className="text-gray-400 text-sm text-center py-4">ยังไม่มีรูป skill</p>
              : (
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto bg-black/20 rounded-xl p-2">
                  {allSkills.map((s) => {
                    const has = memberSkills.some((ms) => ms.id === s.id)
                    return (
                      <button key={s.id} type="button" onClick={() => toggleMemberSkill(s)}
                        className={`w-10 h-10 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${has ? 'border-green-500 ring-2 ring-green-200' : 'border-transparent hover:border-gray-300'}`}>
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
            <p className="text-xs text-gray-400 mb-3">เลือกสมาชิกใหม่เพื่อสลับกับ <span className="font-semibold text-white">{m.memberName}</span></p>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อหรือ UID..."
              className="w-full border border-white/20 rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:border-blue-400 text-white placeholder-gray-500 bg-black/30" />
            <div className="flex flex-wrap gap-1 mb-3">
              {JOBS.map((j) => (
                <button key={j} type="button" onClick={() => setJobFilter(jobFilter === j ? null : j)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${jobFilter === j ? 'text-white border-transparent' : 'bg-transparent border-white/20 text-gray-400 hover:border-white/40 hover:text-white'}`}
                  style={jobFilter === j ? { background: jobColor(j), borderColor: jobColor(j) } : {}}>
                  {JOB_ICON[j] && <img src={JOB_ICON[j]} alt={j} width={12} height={12} className="object-contain" />}
                  {j}
                </button>
              ))}
            </div>
            {unassigned.length === 0
              ? <p className="text-gray-400 text-sm text-center py-4">ไม่มีสมาชิกที่ยังไม่ได้ assign</p>
              : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {unassigned.map((a) => (
                    <button key={a.uid} onClick={() => swapMember(a.uid)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 border border-transparent hover:border-white/20 transition-colors text-left">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ background: jobColor(a.job) }}>
                        {a.memberName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm">{a.memberName}</p>
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

        <hr className="my-4 border-white/10" />
        <button onClick={removeFromSection}
          className="w-full bg-red-900/30 hover:bg-red-800/40 text-red-400 border border-red-500/30 rounded-xl py-2.5 text-sm font-medium transition-colors">
          ย้ายออกจาก section
        </button>
      </Modal>
    )
  }

  // ── ADD modal ──
  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">เพิ่มสมาชิก → <span className="text-blue-400">{state.sectionName}</span></h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
      </div>

      <div className="flex gap-1 mb-5 bg-black/30 rounded-xl p-1">
        {(['pick', 'new'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
            {t === 'pick' ? 'เลือกสมาชิก' : 'เพิ่มสมาชิกใหม่'}
          </button>
        ))}
      </div>

      {tab === 'pick' && (
        <div>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อหรือ UID..."
            className="w-full border border-white/20 rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:border-blue-400 text-white placeholder-gray-500 bg-black/30" />
          <div className="flex flex-wrap gap-1 mb-3">
            {JOBS.map((j) => (
              <button key={j} type="button" onClick={() => setJobFilter(jobFilter === j ? null : j)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${jobFilter === j ? 'text-white border-transparent' : 'bg-transparent border-white/20 text-gray-400 hover:border-white/40 hover:text-white'}`}
                style={jobFilter === j ? { background: jobColor(j), borderColor: jobColor(j) } : {}}>
                {JOB_ICON[j] && <img src={JOB_ICON[j]} alt={j} width={12} height={12} className="object-contain" />}
                {j}
              </button>
            ))}
          </div>
          {unassigned.length === 0
            ? <p className="text-gray-400 text-sm text-center py-8">ไม่มีสมาชิกที่ยังไม่ได้ assign</p>
            : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {unassigned.map((a) => (
                  <button key={a.uid} onClick={() => assignExisting(a.uid)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 border border-transparent hover:border-white/20 transition-colors text-left">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: jobColor(a.job) }}>
                      {a.memberName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white text-sm">{a.memberName}</p>
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
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">UID</label>
            <input value={form.uid} onChange={(e) => setForm((f) => ({ ...f, uid: e.target.value }))}
              placeholder="เช่น 9405303500"
              className="w-full border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-white placeholder-gray-500 bg-black/30" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">ชื่อ</label>
            <input value={form.memberName} onChange={(e) => setForm((f) => ({ ...f, memberName: e.target.value }))}
              placeholder="ชื่อ member"
              className="w-full border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-white placeholder-gray-500 bg-black/30" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">อาชีพ</label>
            <select value={form.job} onChange={(e) => setForm((f) => ({ ...f, job: e.target.value }))}
              className="w-full border border-white/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-white bg-[#1a1a2e]">
              {JOBS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Skill</label>
              <div className="flex flex-col items-end gap-1">
                <label className={`cursor-pointer text-xs px-3 py-1 rounded-full font-medium transition-colors ${uploading ? 'bg-white/10 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
                  {uploading ? 'กำลังอัปโหลด...' : '+ อัปโหลดรูป'}
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
                <p className="text-xs text-yellow-400/80">⚠ อัปรูปสกิลเท่านั้นนะ อย่าไปเอารูปใครมาอัป</p>
              </div>
            </div>
            {allSkills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto bg-black/20 rounded-xl p-2">
                {allSkills.map((s) => {
                  const selected = newSkills.some((ns) => ns.id === s.id)
                  return (
                    <button key={s.id} type="button" onClick={() => toggleSkill(s)}
                      className={`w-10 h-10 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${selected ? 'border-blue-500 ring-2 ring-blue-400/30' : 'border-transparent hover:border-white/30'}`}>
                      <Image src={s.imagePath} alt="skill" width={40} height={40} className="object-cover w-full h-full" />
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-3 bg-black/20 rounded-xl">ยังไม่มีรูป skill — อัปโหลดได้เลย</p>
            )}
            {newSkills.length > 0 && (
              <p className="text-xs text-blue-400 mt-1.5 font-medium">เลือกแล้ว {newSkills.length} skill</p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 block">Tag</label>
            <div className="flex gap-2">
              {(() => {
                const has = newTags.includes('หัวหน้าทีม')
                return (
                  <button type="button"
                    onClick={() => setNewTags((prev) => has ? prev.filter((t) => t !== 'หัวหน้าทีม') : [...prev, 'หัวหน้าทีม'])}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${has ? 'border-yellow-400 text-yellow-300 bg-yellow-900/40' : 'border-white/20 text-gray-400 hover:border-white/40'}`}>
                    <span>👑</span>หัวหน้าทีม
                  </button>
                )
              })()}
            </div>
          </div>

          {err && <p className="text-red-400 text-xs bg-red-900/30 border border-red-500/30 rounded-lg px-3 py-2">{err}</p>}

          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-gray-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
            {saving ? 'กำลังบันทึก...' : 'เพิ่มสมาชิก'}
          </button>
        </form>
      )}
    </Modal>
  )
}

// ─── Compact Member Row (for overview) ───────────────────────────────────────
function CompactMemberRow({ member, adminMode, onClick }: {
  member: Attendee; adminMode: boolean; onClick: () => void
}) {
  const isLeader = member.tags?.includes('หัวหน้าทีม')
  const color = jobColor(member.job)
  return (
    <div onClick={adminMode ? onClick : undefined}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${adminMode ? 'cursor-pointer hover:bg-white/10' : ''}`}
      style={{ borderLeft: `3px solid ${color}`, background: isLeader ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)' }}>
      {isLeader && <span className="text-yellow-400 text-xs leading-none">👑</span>}
      <span className="text-white text-xs font-semibold truncate flex-1">{member.memberName}</span>
      {JOB_ICON[member.job] && <img src={JOB_ICON[member.job]} alt={member.job} width={12} height={12} className="object-contain shrink-0" />}
    </div>
  )
}

// ─── Compact Empty Slot ───────────────────────────────────────────────────────
function CompactEmptySlot({ adminMode, onClick }: { adminMode: boolean; onClick: () => void }) {
  return (
    <div onClick={adminMode ? onClick : undefined}
      className={`flex items-center justify-center px-2 py-1 rounded-lg border border-dashed text-xs transition-all ${adminMode ? 'border-blue-500/40 text-blue-400/60 hover:bg-blue-500/10 cursor-pointer' : 'border-white/10 text-white/15'}`}>
      {adminMode ? '+ ADD' : 'ว่าง'}
    </div>
  )
}

// ─── Section Header (inline editable in admin mode) ──────────────────────────
function SectionHeader({ section, adminMode, onRename }: {
  section: Section; adminMode: boolean; onRename?: (id: number, name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(section.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setValue(section.name) }, [section.name])

  function startEdit() {
    if (!adminMode || !onRename) return
    setEditing(true)
    setTimeout(() => { inputRef.current?.select() }, 0)
  }

  function save() {
    setEditing(false)
    const trimmed = value.trim()
    if (!trimmed || trimmed === section.name) { setValue(section.name); return }
    onRename?.(section.id, trimmed)
  }

  return (
    <div className="flex items-center justify-center gap-1.5 shrink-0 min-w-0 px-1">
      {editing ? (
        <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setValue(section.name) } }}
          className="text-center text-white text-base font-black w-full bg-white/10 border border-blue-400 rounded-lg px-2 py-0.5 outline-none" />
      ) : (
        <>
          <p
            onClick={startEdit}
            className={`text-center font-black text-base text-white truncate ${adminMode && onRename ? 'cursor-pointer hover:text-blue-300 transition-colors' : ''}`}>
            {section.name}
          </p>
          {adminMode && onRename && <span className="text-white/25 text-xs shrink-0">✎</span>}
        </>
      )}
      <span className="text-white/30 text-xs shrink-0">({section.attendees.length})</span>
    </div>
  )
}

// ─── Zone Panel (shows all sections of a zone) ────────────────────────────────
function ZonePanel({ zone, adminMode, search, jobFilter, onSlotClick, compact = false, onDragStart, onDropSection, onSwap, dragOverSectionId, setDragOverSectionId, onRename }: {
  zone: Zone; adminMode: boolean; search: string; jobFilter?: string | null; compact?: boolean
  onSlotClick: (section: Section, type: 'add' | 'edit', member?: Attendee, slotIdx?: number) => void
  onDragStart?: (uid: string, sectionId: number, position: number) => void
  onDropSection?: (sectionId: number, position: number) => void
  onSwap?: (targetUid: string, targetSectionId: number, targetPosition: number) => void
  dragOverSectionId?: number | null
  setDragOverSectionId?: (id: number | null) => void
  onRename?: (id: number, name: string) => void
}) {
  const q = search.trim().toLowerCase()
  const sections = zone.sections.filter((s) => !SPECIAL.includes(s.name))
  return (
    <div className={`${compact ? '' : 'h-full'} flex flex-col gap-2 p-3 rounded-xl`}
      style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(3px)' }}>
      <div className="flex items-center gap-2 shrink-0">
        <Image src="/logo-4am.png" alt="4AM" width={28} height={28} className="object-contain" />
        <p className="text-xs font-bold text-white/60 uppercase tracking-widest">TACTICAL HUB — {zone.name.replace('Team', '')}</p>
      </div>
      <div className={`flex gap-2 ${compact ? 'flex-col sm:flex-row' : 'flex-1 min-h-0'}`}>
        {sections.map((sec) => {
          // build slot map: slot index 0..CAPACITY-1 → member
          const slotMap = new Map<number, Attendee>()
          const unpositioned: Attendee[] = []
          for (const m of sec.attendees) {
            if (m.position !== null && m.position !== undefined) slotMap.set(m.position, m)
            else unpositioned.push(m)
          }
          let nextFree = 0
          for (const m of unpositioned) {
            while (slotMap.has(nextFree)) nextFree++
            slotMap.set(nextFree, m)
            nextFree++
          }

          return (
            <div key={sec.id}
              className={`flex-1 flex flex-col gap-1.5 min-w-0 rounded-lg transition-colors ${compact ? '' : 'overflow-y-auto'}`}>
              <SectionHeader section={sec} adminMode={adminMode} onRename={onRename} />
              {(q || jobFilter) ? (
                // search/filter mode: show matching members only
                sec.attendees
                  .filter((a) => (!q || a.memberName.toLowerCase().includes(q) || a.uid.includes(q)) && (!jobFilter || a.job === jobFilter))
                  .map((m) => (
                    <MemberCard key={m.uid} member={m} adminMode={adminMode} compact={compact}
                      onClick={() => onSlotClick(sec, 'edit', m)}
                      onDragStart={(uid) => onDragStart?.(uid, sec.id, m.position ?? 0)}
                      onDropOnMember={(targetUid) => onSwap?.(targetUid, sec.id, m.position ?? 0)}
                      />
                  ))
              ) : (
                // normal mode: CAPACITY fixed slots
                Array.from({ length: CAPACITY }, (_, slotIdx) => {
                  const m = slotMap.get(slotIdx)
                  return m ? (
                    <MemberCard key={m.uid} member={m} adminMode={adminMode} compact={compact}
                      onClick={() => onSlotClick(sec, 'edit', m)}
                      onDragStart={(uid) => onDragStart?.(uid, sec.id, slotIdx)}
                      onDropOnMember={(targetUid) => onSwap?.(targetUid, sec.id, slotIdx)}
                      />
                  ) : (
                    <EmptySlot key={`empty-${slotIdx}`} adminMode={adminMode}
                      onClick={() => onSlotClick(sec, 'add', undefined, slotIdx)}
                      onDrop={() => onDropSection?.(sec.id, slotIdx)} />
                  )
                })
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Special Zone Panel (ลา / สำรอง) ─────────────────────────────────────────
function SpecialZonePanel({ label, sections, adminMode, search, jobFilter, onSlotClick, onDragStart, onDropSection, onSwap, dragOverSectionId, setDragOverSectionId }: {
  label: string; sections: Section[]; adminMode: boolean; search: string; jobFilter?: string | null
  onSlotClick: (section: Section, type: 'add' | 'edit', member?: Attendee, slotIdx?: number) => void
  onDragStart?: (uid: string, sectionId: number, position: number) => void
  onDropSection?: (sectionId: number, position: number) => void
  onSwap?: (targetUid: string, targetSectionId: number, targetPosition: number) => void
  dragOverSectionId?: number | null
  setDragOverSectionId?: (id: number | null) => void
}) {
  const q = search.trim().toLowerCase()
  const allMembers = sections.flatMap((s) =>
    s.attendees.filter((a) =>
      (!q || a.memberName.toLowerCase().includes(q) || a.uid.includes(q)) &&
      (!jobFilter || a.job === jobFilter)
    )
  )
  const sec = sections[0]
  const isOver = sec && dragOverSectionId === sec.id
  return (
    <div className="h-full flex flex-col gap-2 p-3 rounded-xl"
      style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(3px)' }}>
      <div className="flex items-center gap-2 shrink-0">
        <Image src="/logo-4am.png" alt="4AM" width={28} height={28} className="object-contain" />
        <p className="text-xs font-bold text-white/60 uppercase tracking-widest">TACTICAL HUB — {label} <span className="text-white/30 font-normal normal-case">({allMembers.length})</span></p>
      </div>
      <div className={`flex-1 overflow-y-auto flex flex-col gap-1.5 rounded-lg transition-colors ${isOver && adminMode ? 'bg-blue-500/15 ring-2 ring-blue-400/50' : ''}`}
        onDragOver={adminMode && sec ? (e) => { e.preventDefault(); setDragOverSectionId?.(sec.id) } : undefined}
        onDragLeave={adminMode ? () => setDragOverSectionId?.(null) : undefined}
        onDrop={adminMode && sec ? (e) => { e.preventDefault(); setDragOverSectionId?.(null); onDropSection?.(sec.id, allMembers.length) } : undefined}>
        {allMembers.map((m, idx) => {
          const mSec = sections.find((s) => s.attendees.some((a) => a.uid === m.uid))
          return (
            <MemberCard key={m.uid} member={m} adminMode={adminMode}
              onClick={() => sec && onSlotClick(sec, 'edit', m)}
              onDragStart={(uid) => onDragStart?.(uid, mSec?.id ?? sec?.id ?? 0, m.position ?? idx)}
              onDropOnMember={(targetUid) => mSec && onSwap?.(targetUid, mSec.id, m.position ?? idx)} />
          )
        })}
        {allMembers.length === 0 && <p className="text-white/20 text-xs text-center py-4">ไม่มี</p>}
        {adminMode && sec && <EmptySlot adminMode={adminMode} onClick={() => onSlotClick(sec, 'add')} />}
      </div>
    </div>
  )
}

// ─── Member Card ──────────────────────────────────────────────────────────────
function MemberCard({ member, adminMode, onClick, compact = false, onDragStart, onDropOnMember }: {
  member: Attendee; adminMode: boolean; onClick: () => void; compact?: boolean
  onDragStart?: (uid: string) => void
  onDropOnMember?: (targetUid: string) => void
}) {
  const [showSkillTooltip, setShowSkillTooltip] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const isLeader = member.tags?.includes('หัวหน้าทีม')
  const color = jobColor(member.job)
  const borderColor = color
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)

  const visibleSkillsMobile = member.skills.slice(0, 4)
  const hiddenSkillsMobile = member.skills.slice(4)
  const visibleSkillsDesktop = member.skills.slice(0, 6)
  const hiddenSkillsDesktop = member.skills.slice(6)

  return (
    <div
      draggable={adminMode}
      onDragStart={adminMode ? (e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.(member.uid) } : undefined}
      onDragOver={adminMode ? (e) => { e.preventDefault(); setIsDragOver(true) } : undefined}
      onDragLeave={adminMode ? () => setIsDragOver(false) : undefined}
      onDrop={adminMode ? (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); onDropOnMember?.(member.uid) } : undefined}
      onClick={adminMode ? onClick : undefined}
      className={`relative rounded-xl overflow-hidden transition-all h-[90px] sm:h-[110px] ${adminMode ? 'cursor-grab active:cursor-grabbing hover:brightness-110' : ''} ${isDragOver ? 'ring-2 ring-yellow-400 brightness-125' : ''}`}
      style={{
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor,
        background: `rgba(${r},${g},${b},0.12)`,
        boxShadow: isLeader ? `0 0 14px rgba(245,158,11,0.35)` : `0 2px 8px rgba(0,0,0,0.4)`,
      }}>

      {adminMode && <div className="absolute top-1.5 right-1.5 text-white/25 text-xs z-10">✎</div>}

      {/* Layout: icon | name+job | skills */}
      <div className="relative z-10 h-full flex items-center overflow-hidden">

        {/* Left: job icon — compact on < xl */}
        <div className="shrink-0 flex items-center justify-center w-10 xl:w-[72px]">
          {JOB_ICON[member.job] && (
            <img src={JOB_ICON[member.job]} alt={member.job}
              className="object-contain w-8 h-8 xl:w-14 xl:h-14" />
          )}
        </div>

        {/* Center: name + job */}
        <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
          <div className="flex items-center gap-1">
            {isLeader && <span className="text-yellow-400 text-xs">👑</span>}
            <p className="font-bold leading-tight truncate text-xs xl:text-base" style={{ color: '#ffffff' }}>{member.memberName}</p>
          </div>
          <p className="text-[9px] xl:text-xs font-black uppercase tracking-widest truncate" style={{ color }}>{member.job}</p>
        </div>

        {/* Right: skills — < xl: 1 แถวนอน 4 อัน | xl+: 2 col 6 อัน */}
        <div className="shrink-0 flex items-center justify-center pr-1.5 xl:pr-3">
          {member.skills.length > 0 && (
            <>
              {/* Mobile + Tablet (< xl) */}
              <div className="flex xl:hidden items-center gap-0.5">
                <div className="flex flex-row gap-0.5">
                  {visibleSkillsMobile.map((s) => (
                    <Image key={s.id} src={s.imagePath} alt="skill" width={28} height={28} className="rounded-full object-cover" style={{ width: 28, height: 28 }} />
                  ))}
                </div>
                {hiddenSkillsMobile.length > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); setShowSkillTooltip(true) }}
                    className="w-6 h-6 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white text-[10px] font-bold hover:bg-white/30 transition-colors shrink-0">
                    +{hiddenSkillsMobile.length}
                  </button>
                )}
              </div>
              {/* Desktop (xl+) */}
              <div className="hidden xl:flex items-center gap-1">
                <div className="grid grid-cols-2 gap-1" style={{ width: 76 }}>
                  {visibleSkillsDesktop.map((s) => (
                    <Image key={s.id} src={s.imagePath} alt="skill" width={36} height={36} className="rounded-full object-cover w-full h-auto aspect-square" />
                  ))}
                </div>
                {hiddenSkillsDesktop.length > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); setShowSkillTooltip(true) }}
                    className="w-7 h-7 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white text-xs font-bold hover:bg-white/30 transition-colors shrink-0">
                    +{hiddenSkillsDesktop.length}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Skill modal — rendered via portal outside card */}
        {showSkillTooltip && createPortal(
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            onClick={() => setShowSkillTooltip(false)}>
            <div className="rounded-2xl p-5 max-w-sm w-full mx-4"
              style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', border: '1px solid rgba(255,255,255,0.15)' }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-bold">{member.memberName}</p>
                <button onClick={() => setShowSkillTooltip(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
              </div>
              <p className="text-gray-400 text-xs mb-3 uppercase tracking-wide">Skills ทั้งหมด ({member.skills.length})</p>
              <div className="flex gap-3 flex-wrap justify-center">
                {member.skills.map((s) => (
                  <Image key={s.id} src={s.imagePath} alt="skill" width={52} height={52} className="rounded-full object-cover border-2 border-white/20" />
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}

      </div>
    </div>
  )
}

// ─── Empty Slot ───────────────────────────────────────────────────────────────
function EmptySlot({ adminMode, onClick, onDrop }: { adminMode: boolean; onClick: () => void; onDrop?: () => void }) {
  const [isDragOver, setIsDragOver] = useState(false)
  return (
    <div
      onClick={adminMode ? onClick : undefined}
      onDragOver={adminMode ? (e) => { e.preventDefault(); setIsDragOver(true) } : undefined}
      onDragLeave={adminMode ? () => setIsDragOver(false) : undefined}
      onDrop={adminMode ? (e) => { e.preventDefault(); setIsDragOver(false); onDrop?.() } : undefined}
      className={`rounded-xl border-2 border-dashed text-center transition-all flex flex-col items-center justify-center h-[90px] sm:h-[110px] ${
        isDragOver && adminMode
          ? 'border-yellow-400 bg-yellow-400/15 scale-[1.02]'
          : adminMode
            ? 'border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:border-blue-400 cursor-pointer'
            : 'border-white/10 text-white/20'
      }`}
      style={{ backdropFilter: 'blur(4px)', background: isDragOver ? undefined : 'rgba(255,255,255,0.03)' }}>
      {adminMode ? (
        <>
          <p className="text-2xl font-light leading-none mb-0.5">{isDragOver ? '↓' : '+'}</p>
          <p className="text-xs font-semibold tracking-wide">{isDragOver ? 'วางที่นี่' : 'ADD'}</p>
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
  const sorted = section.attendees
  const emptyCount = capped ? Math.max(0, CAPACITY - sorted.length) : 0

  return (
    <div>
      <div className="flex items-center gap-1 mb-2 justify-center">
        <span className="text-white/40 text-sm">×</span>
        <h2 className="font-bold text-white/80">{label ?? section.name}</h2>
        <span className="text-xs text-white/40">({section.attendees.length})</span>
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
  const [view, setView] = useState<ViewMode>('ทั้งหมด')
  const [adminMode, setAdminMode] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [search, setSearch] = useState('')
  const [slotModal, setSlotModal] = useState<ModalState | null>(null)
  const [dragged, setDragged] = useState<{ uid: string; sectionId: number | null; position: number | null } | null>(null)
  const [dragOverSectionId, setDragOverSectionId] = useState<number | null>(null)
  const [pageJobFilter, setPageJobFilter] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const captureRef = useRef<HTMLDivElement>(null)

  async function handleCapture() {
    if (!captureRef.current) return
    setCapturing(true)
    try {
      const { domToPng } = await import('modern-screenshot')
      const dataUrl = await domToPng(captureRef.current, { scale: 2 })
      const link = document.createElement('a')
      link.download = `checklist-${new Date().toISOString().slice(0, 16).replace('T', '_')}.png`
      link.href = dataUrl
      link.click()
    } finally {
      setCapturing(false)
    }
  }

  async function handleDrop(targetSectionId: number, position?: number) {
    if (!dragged) return
    const uid = dragged.uid
    optimisticMoveAttendee(uid, targetSectionId, undefined, position ?? null)
    setDragged(null)
    fetch(`/api/attendees/${uid}/section`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: targetSectionId, position: position ?? null }),
    })
  }

  async function handleRename(sectionId: number, name: string) {
    setZones((prev) => prev.map((z) => ({
      ...z,
      sections: z.sections.map((s) => s.id === sectionId ? { ...s, name } : s),
    })))
    fetch(`/api/sections/${sectionId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }

  async function handleQuickMove(uid: string, target: 'ลา' | 'สำรอง') {
    const targetSection = zones.flatMap((z) => z.sections).find((s) => s.name === target)
    if (!targetSection) return
    optimisticMoveAttendee(uid, targetSection.id)
    fetch(`/api/attendees/${uid}/section`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: targetSection.id, position: null }),
    })
  }

  async function handleSwap(targetUid: string, targetSectionId: number, targetPosition: number | null) {
    if (!dragged || dragged.uid === targetUid) return
    const { uid, sectionId, position } = dragged
    optimisticSwapAttendees(uid, targetSectionId, targetPosition, targetUid, sectionId, position)
    setDragged(null)
    Promise.all([
      fetch(`/api/attendees/${uid}/section`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: targetSectionId, position: targetPosition }),
      }),
      fetch(`/api/attendees/${targetUid}/section`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, position }),
      }),
    ])
  }

  async function load() {
    const res = await fetch('/api/zones')
    const data = await res.json()
    setZones(data.zones)
  }

  function optimisticMoveAttendee(uid: string, targetSectionId: number | null, newMember?: Attendee, newPosition?: number | null) {
    setZones((prev) => {
      let attendee: Attendee | undefined = newMember
      if (!attendee) {
        for (const z of prev)
          for (const s of z.sections) {
            const f = s.attendees.find((a) => a.uid === uid)
            if (f) { attendee = f; break }
          }
      }
      if (!attendee) return prev
      const updated = { ...attendee, sectionId: targetSectionId, position: newPosition !== undefined ? newPosition : attendee.position }
      return prev.map((z) => ({
        ...z,
        sections: z.sections.map((s) => {
          const hasMember = s.attendees.some((a) => a.uid === uid)
          const isTarget = targetSectionId !== null && s.id === targetSectionId
          if (hasMember && isTarget) {
            // ย้ายใน section เดียวกัน — อัพเดท position ใหม่
            return { ...s, attendees: s.attendees.map((a) => a.uid === uid ? updated : a) }
          }
          if (hasMember) return { ...s, attendees: s.attendees.filter((a) => a.uid !== uid) }
          if (isTarget) return { ...s, attendees: [...s.attendees, updated] }
          return s
        }),
      }))
    })
  }

  function optimisticSkillUpdate(uid: string, skills: Skill[]) {
    setZones((prev) => prev.map((z) => ({
      ...z,
      sections: z.sections.map((s) => ({
        ...s,
        attendees: s.attendees.map((a) => a.uid === uid ? { ...a, skills } : a),
      })),
    })))
  }

  function optimisticSwapAttendees(uid1: string, sec1: number | null, pos1: number | null, uid2: string, sec2: number | null, pos2: number | null) {
    setZones((prev) => prev.map((z) => ({
      ...z,
      sections: z.sections.map((s) => ({
        ...s,
        attendees: s.attendees.map((a) => {
          if (a.uid === uid1) return { ...a, sectionId: sec1, position: pos1 }
          if (a.uid === uid2) return { ...a, sectionId: sec2, position: pos2 }
          return a
        }),
      })),
    })))
  }
  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    try {
      const stored = localStorage.getItem('adminSession')
      if (stored) {
        const { timestamp } = JSON.parse(stored)
        if (Date.now() - timestamp < 5 * 60 * 60 * 1000) setAdminMode(true)
        else localStorage.removeItem('adminSession')
      }
    } catch { /* ignore */ }
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [])

  async function handleAdminToggle() {
    if (adminMode) {
      setAdminMode(false)
      try { localStorage.removeItem('adminSession') } catch { /* ignore */ }
      return
    }
    setShowModal(true); setPassword(''); setPwError('')
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      setAdminMode(true); setShowModal(false); setPassword(''); setPwError('')
      try { localStorage.setItem('adminSession', JSON.stringify({ timestamp: Date.now() })) } catch { /* ignore */ }
    } else setPwError('รหัสผ่านไม่ถูกต้อง')
  }

  function zoneOf(name: string) { return zones.find((z) => z.name === name) }

  function openSlotModal(section: Section, type: 'add' | 'edit', member?: Attendee, slotIdx?: number) {
    if (!adminMode) return
    if (type === 'edit' && member) {
      const teamAttendees = section.attendees
      setSlotModal({ type: 'edit', member, sectionId: section.id, teamAttendees })
    } else {
      setSlotModal({ type: 'add', sectionId: section.id, sectionName: section.name, position: slotIdx ?? 0 })
    }
  }

  const allSections = zones.flatMap((z) => z.sections)
  const laCount = allSections.filter((s) => s.name === 'ลา').reduce((n, s) => n + s.attendees.length, 0)
  const sarongCount = allSections.filter((s) => s.name === 'สำรอง').reduce((n, s) => n + s.attendees.length, 0)
  const totalCount = allSections.reduce((n, s) => n + s.attendees.length, 0)
  const warAttendees = allSections.filter((s) => !SPECIAL.includes(s.name)).flatMap((s) => s.attendees)
  const jobCounts = JOBS.map((job) => ({ job, count: warAttendees.filter((a) => a.job === job).length }))

  const TABS: ViewMode[] = ['ทั้งหมด', 'TeamA', 'TeamB', 'TeamC', 'ลา', 'สำรอง']
  const TAB_ACTIVE: Partial<Record<ViewMode, string>> = { ลา: 'bg-red-500 text-white border-red-500', สำรอง: 'bg-yellow-500 text-white border-yellow-500' }
  const TAB_INACTIVE: Partial<Record<ViewMode, string>> = { ลา: 'text-red-400 border-red-500/40', สำรอง: 'text-yellow-400 border-yellow-500/40' }

  // Build sections for current view
  const teamZones = view === 'ทั้งหมด'
    ? (['TeamA', 'TeamB', 'TeamC'] as const).map((n) => zoneOf(n)).filter(Boolean) as Zone[]
    : (view === 'ลา' || view === 'สำรอง') ? [] : [zoneOf(view)].filter(Boolean) as Zone[]

  const specialSections = (view === 'ลา' || view === 'สำรอง')
    ? zones.flatMap((z) => z.sections.filter((s) => s.name === view))
    : view === 'ทั้งหมด'
      ? [] // show inline within zone panels for all view
      : []

  const q = search.trim().toLowerCase()

  return (
    <main ref={captureRef} className={`${view === 'ทั้งหมด' ? 'min-h-screen overflow-y-auto' : 'h-screen overflow-hidden'} px-3 py-3 relative`}
      style={{
        backgroundImage: 'url(/bg-dragon.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
      <div className="fixed inset-0 bg-black/60 pointer-events-none" />

      <div className={`${view === 'ทั้งหมด' ? 'flex flex-col gap-2' : 'h-full flex flex-col gap-2'} relative z-10`}>
        {/* Top bar */}
        <div className="flex flex-col gap-2">
          {/* Tabs row — centered */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {TABS.map((t) => (
              <button key={t} onClick={() => setView(t)}
                className={`px-3 py-1.5 sm:px-5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold border transition-colors backdrop-blur flex items-center gap-1.5 ${view === t ? (TAB_ACTIVE[t] ?? 'bg-white/20 text-white border-white/30') : (TAB_INACTIVE[t] ?? 'bg-black/30 text-gray-300 border-white/10 hover:bg-white/10')}`}>
                {t}
                {t === 'ลา' && laCount > 0 && <span className={`text-xs font-bold px-1.5 py-0 rounded-full leading-none ${view === 'ลา' ? 'bg-white/30' : 'bg-red-500 text-white'}`}>{laCount}</span>}
                {t === 'สำรอง' && sarongCount > 0 && <span className={`text-xs font-bold px-1.5 py-0 rounded-full leading-none ${view === 'สำรอง' ? 'bg-white/30' : 'bg-yellow-500 text-black'}`}>{sarongCount}</span>}
              </button>
            ))}
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ หรือ UID..."
                className="w-full bg-black/40 border border-white/20 rounded-full pl-7 pr-7 py-1 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 backdrop-blur" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs">✕</button>}
            </div>

            {/* Job stats */}
            <div className="flex items-center gap-1 flex-wrap">
              {jobCounts.map(({ job, count }) => count > 0 && (
                <button key={job} onClick={() => setPageJobFilter(pageJobFilter === job ? null : job)}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all"
                  style={{
                    borderColor: pageJobFilter === job ? jobColor(job) : `${jobColor(job)}50`,
                    background: pageJobFilter === job ? `${jobColor(job)}40` : `${jobColor(job)}18`,
                    color: jobColor(job),
                    boxShadow: pageJobFilter === job ? `0 0 8px ${jobColor(job)}60` : 'none',
                  }}>
                  {JOB_ICON[job] && <img src={JOB_ICON[job]} alt={job} width={13} height={13} className="object-contain" />}
                  {count}
                </button>
              ))}
              <span className="bg-white/5 text-gray-300 border border-white/10 px-2 py-0.5 rounded-full text-xs font-semibold">รวม {totalCount}</span>
              {laCount > 0 && <span className="bg-red-900/40 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">ลา {laCount}</span>}
              {sarongCount > 0 && <span className="bg-yellow-900/40 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">สำรอง {sarongCount}</span>}
            </div>

            {/* Modify button */}
            <button onClick={handleAdminToggle}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors backdrop-blur ${adminMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-black/30 text-gray-300 border-white/20 hover:border-blue-400 hover:text-white'}`}>
              {adminMode ? '✎ Modify' : '✎ Modify'}
            </button>

            {/* Capture button */}
            <button onClick={handleCapture} disabled={capturing}
              className="px-3 py-1 rounded-full text-xs font-medium border border-white/20 bg-black/30 text-gray-300 hover:border-green-400 hover:text-green-300 transition-colors backdrop-blur disabled:opacity-50">
              {capturing ? '⏳' : '📷'} Capture
            </button>
          </div>
        </div>

        {/* Content */}
        {view === 'ทั้งหมด' ? (
          <div className="flex flex-col gap-3">
            {/* TeamA, TeamB, TeamC แนวตั้ง */}
            {teamZones.map((zone) => (
              <ZonePanel key={zone.id} zone={zone} adminMode={adminMode} search={search} jobFilter={pageJobFilter} onSlotClick={openSlotModal} compact
                onDragStart={(uid, sectionId, position) => setDragged({ uid, sectionId, position })} onDropSection={handleDrop} onSwap={handleSwap}
                dragOverSectionId={dragOverSectionId} setDragOverSectionId={setDragOverSectionId} onRename={handleRename} />
            ))}
            {/* สำรอง + ลา แนวนอน */}
            <div className="flex flex-col sm:flex-row gap-2">
              {(['สำรอง', 'ลา'] as const).map((label) => {
                const secs = zones.flatMap((z) => z.sections.filter((s) => s.name === label))
                return (
                  <div key={label} className="flex-1 min-w-0">
                    <SpecialZonePanel label={label} sections={secs} adminMode={adminMode} search={search} jobFilter={pageJobFilter} onSlotClick={openSlotModal}
                      onDragStart={(uid, sectionId, position) => setDragged({ uid, sectionId, position })} onDropSection={handleDrop} onSwap={handleSwap}
                      dragOverSectionId={dragOverSectionId} setDragOverSectionId={setDragOverSectionId} />
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col sm:flex-row gap-2">
            {/* Team zones */}
            {teamZones.map((zone) => (
              <div key={zone.id} className="flex-1 min-w-0 overflow-y-auto">
                <ZonePanel zone={zone} adminMode={adminMode} search={search} jobFilter={pageJobFilter} onSlotClick={openSlotModal}
                  onDragStart={(uid, sectionId, position) => setDragged({ uid, sectionId, position })} onDropSection={handleDrop} onSwap={handleSwap}
                  dragOverSectionId={dragOverSectionId} setDragOverSectionId={setDragOverSectionId} onRename={handleRename} />
              </div>
            ))}
            {/* Special view (ลา / สำรอง) */}
            {specialSections.length > 0 && (
              <div className="flex-1 min-w-0 overflow-y-auto">
                <SpecialZonePanel label={view as string} sections={specialSections} adminMode={adminMode} search={search} jobFilter={pageJobFilter} onSlotClick={openSlotModal}
                  onDragStart={(uid, sectionId, position) => setDragged({ uid, sectionId, position })} onDropSection={handleDrop} onSwap={handleSwap}
                  dragOverSectionId={dragOverSectionId} setDragOverSectionId={setDragOverSectionId} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slot Modal */}
      {slotModal && (
        <SlotModal state={slotModal} onClose={() => setSlotModal(null)} onRefresh={load} onQuickMove={handleQuickMove} onOptimisticMove={optimisticMoveAttendee} onOptimisticSkillUpdate={optimisticSkillUpdate} />
      )}

      {/* Password Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <form onSubmit={handlePasswordSubmit} className="rounded-2xl shadow-xl p-6 w-80"
            style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <h2 className="text-lg font-bold text-white mb-1">เข้าสู่ Admin Mode</h2>
            <p className="text-sm text-gray-400 mb-4">ใส่รหัสผ่านเพื่อแก้ไขข้อมูล</p>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus
              placeholder="รหัสผ่าน"
              className="w-full border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 mb-2 text-white placeholder-gray-500 bg-black/30" />
            {pwError && <p className="text-red-400 text-xs mb-2">{pwError}</p>}
            <div className="flex gap-2 mt-1">
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium transition-colors">เข้าสู่ระบบ</button>
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg py-2 text-sm transition-colors">ยกเลิก</button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
