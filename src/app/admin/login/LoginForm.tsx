'use client'

import { useActionState } from 'react'
import { login } from '../actions'

export default function LoginForm() {
  const [error, action, pending] = useActionState(login, null)

  return (
    <form action={action}>
      {error && <div className="error">{error}</div>}
      <label className="field">
        <span>Password</span>
        <input type="password" name="password" required autoComplete="current-password" />
      </label>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Sign in'}
      </button>
    </form>
  )
}
