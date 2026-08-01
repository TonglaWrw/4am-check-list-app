'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (res.ok) {
      window.location.href = from
    } else {
      setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <form onSubmit={handleLogin} className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl p-8 w-80">
        <h2 className="text-lg font-bold text-white mb-1">เข้าสู่ระบบ</h2>
        <p className="text-sm text-gray-400 mb-5">ใส่ชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งาน</p>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus
          placeholder="ชื่อผู้ใช้"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 mb-2" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="รหัสผ่าน"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 mb-2" />
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors mt-1">
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
