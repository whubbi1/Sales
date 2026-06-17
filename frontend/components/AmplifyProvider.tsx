'use client'
// components/AmplifyProvider.tsx
// Configure AWS Amplify cote client uniquement

import { Amplify } from 'aws-amplify'
import { getAmplifyConfig } from '@/lib/amplifyConfig'
import { useEffect, useState } from 'react'

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    // Configure Amplify uniquement cote client
    Amplify.configure(getAmplifyConfig())
    setConfigured(true)
  }, [])

  if (!configured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return <>{children}</>
}
