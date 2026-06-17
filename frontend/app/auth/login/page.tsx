'use client'
// app/auth/login/page.tsx
// Page de connexion Whubbi

import { useState } from 'react'
import { signIn, signInWithRedirect } from 'aws-amplify/auth'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Connexion avec email/mot de passe
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { isSignedIn } = await signIn({ username: email, password })
      if (isSignedIn) {
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Erreur de connexion')
      }
    } finally {
      setLoading(false)
    }
  }

  // Connexion avec Microsoft (Outlook)
  const handleMicrosoftLogin = async () => {
    try {
      await signInWithRedirect({ provider: { custom: 'Microsoft' } })
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Whubbi</h1>
          <p className="text-gray-500 mt-1">Gestion commerciale</p>
        </div>

        {/* Bouton Microsoft */}
        <button
          onClick={handleMicrosoftLogin}
          className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition mb-6"
        >
          <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          Continuer avec Microsoft
        </button>

        <div className="flex items-center gap-3 mb-6">
          <hr className="flex-1 border-gray-200" />
          <span className="text-gray-400 text-sm">ou</span>
          <hr className="flex-1 border-gray-200" />
        </div>

        {/* Formulaire email */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@wcomply.com"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

      </div>
    </div>
  )
}
