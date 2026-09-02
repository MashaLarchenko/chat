'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { authApi } from '../../lib/api'
import type { AuthRequest } from '../../lib/types'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState<AuthRequest>({ email: '', password: '', name: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (field: keyof AuthRequest, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await authApi.register({
        email: form.email,
        password: form.password,
        name: form.name?.trim() || undefined,
      })
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      router.push('/chat')
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        setError(requestError.response?.data?.message ?? 'Could not create this account.')
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

      <section className="auth-card" aria-labelledby="register-title">
        <div className="mobile-brand brand-lockup"><span className="brand-mark">C</span><span>Convo</span></div>
        <div className="form-heading">
          <p className="eyebrow">Start your space</p>
          <h2 id="register-title">Create account</h2>
          <p>Join the conversation in a few seconds.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" autoComplete="name" placeholder="Your name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" placeholder="Create a password" value={form.password} onChange={(event) => updateField('password', event.target.value)} minLength={6} required />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Create account'}{!isSubmitting && <span aria-hidden="true">→</span>}</button>
        </form>
        <p className="form-footer">Already have an account? <Link className="link-button" href="/login">Sign in</Link></p>
      </section>
    </main>
  )
}
