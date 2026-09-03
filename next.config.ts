import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // Uploaded images are served from object storage. Restrict remote patterns to
  // the configured public base so we never proxy arbitrary hosts.
  images: {
    remotePatterns: process.env.STORAGE_PUBLIC_BASE_URL
      ? [new URL(`${process.env.STORAGE_PUBLIC_BASE_URL}/**`)]
      : [],
  },
}

export default config
