'use client'
// components/AmplifyProvider.tsx
import { Amplify } from 'aws-amplify'
import { getAmplifyConfig } from '@/lib/amplifyConfig'

// Configure Amplify immediately at module load time (not in useEffect)
Amplify.configure(getAmplifyConfig())

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
