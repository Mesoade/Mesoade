import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin-auth'
import LoginForm from './LoginForm'

// Not linked from anywhere public, and explicitly kept out of search indexes.
export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect('/admin')
  return (
    <main className="wrap" style={{ maxWidth: 380, padding: '110px 20px' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 22px' }}>Moderator sign in</h1>
      <div className="card">
        <LoginForm />
      </div>
    </main>
  )
}
