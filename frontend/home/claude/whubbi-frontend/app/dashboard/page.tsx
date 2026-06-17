'use client'
// app/dashboard/page.tsx
// Dashboard principal Whubbi

import { useEffect, useState } from 'react'
import { getCurrentUser, signOut } from 'aws-amplify/auth'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ username: string; email?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        setUser({ username: currentUser.username })
      } catch {
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }
    checkUser()
  }, [router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-600">Whubbi</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.username}</span>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Dashboard */}
      <main className="p-6 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Clients', value: '0', color: 'blue' },
            { label: 'Opportunités', value: '0', color: 'green' },
            { label: 'Emails', value: '0', color: 'purple' },
            { label: 'Réunions', value: '0', color: 'orange' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Modules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'Clients', description: 'Gérez vos clients et contacts', icon: '👥' },
            { title: 'Opportunités', description: 'Suivez votre pipeline commercial', icon: '📈' },
            { title: 'Outlook', description: 'Emails et calendrier Microsoft', icon: '📧' },
          ].map((module) => (
            <div key={module.title} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition cursor-pointer">
              <div className="text-3xl mb-3">{module.icon}</div>
              <h3 className="font-semibold text-gray-800">{module.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{module.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
