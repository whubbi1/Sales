'use client'
// components/AmplifyProvider.tsx
// Configure AWS Amplify côté client

import { Amplify } from 'aws-amplify'
import { amplifyConfig } from '@/lib/amplifyConfig'
import { useEffect } from 'react'

Amplify.configure(amplifyConfig, { ssr: true })

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    Amplify.configure(amplifyConfig, { ssr: false })
  }, [])

  return <>{children}</>
}
