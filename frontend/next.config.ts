import type { NextConfig } from 'next'
import { withAmplifyHosting } from '@aws-amplify/adapter-nextjs'

const nextConfig: NextConfig = {
  images: { unoptimized: true },
}

export default withAmplifyHosting(nextConfig)
