'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { authApi } from '../../lib/api'
import type { LoginRequest } from '../../lib/types'

export default function LoginPage() {
  const [form, setForm] = useState<LoginRequest>({ email: '', password: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const updateField = (field: keyof LoginRequest, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await authApi.login(form)
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      router.push('/chat')
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        setError(requestError.response?.data?.message ?? 'Email or password is incorrect.')
      } else {
        setError('Unable to connect to the server. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-aside" aria-label="Chat introduction">
        <div className="brand-lockup"><span className="brand-mark">C</span><span>Convo</span></div>
        <div className="aside-content">
          <p className="eyebrow">A quieter place to talk</p>
          <h1>Make room for better conversations.</h1>
          <p>Keep your people, ideas, and useful little moments in one shared space.</p>
        </div>
        <span className="aside-note">Private by default · Made for real talk</span>
      </section>

      <section className="auth-card" aria-labelledby="login-title">
        <div className="mobile-brand brand-lockup"><span className="brand-mark">C</span><span>Convo</span></div>
        <div className="form-heading">
          <p className="eyebrow">Your space is waiting</p>
          <h2 id="login-title">Welcome back</h2>
          <p>Sign in to continue the conversation.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={(event) => updateField('password', event.target.value)} required />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}{!isSubmitting && <span aria-hidden="true">→</span>}</button>
        </form>
        <p className="form-footer">New here? <Link className="link-button" href="/register">Create an account</Link></p>
      </section>
    </main>
  )
}
