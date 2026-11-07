import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // The link-preview cards draw text with the site's own fonts, which Satori
  // reads off disk. Without this the .ttf files are left out of the deployed
  // functions and the cards fail at request time.
  outputFileTracingIncludes: {
    '/opengraph-image': ['./src/app/_og/*.ttf'],
    '/s/[index]/opengraph-image': ['./src/app/_og/*.ttf'],
  },
  // Uploaded images are served from object storage. Restrict remote patterns to
  // the configured public base so we never proxy arbitrary hosts.
  //
  // Only an absolute origin is a "remote" pattern. The local driver's default
  // (/uploads) is same-origin and needs no entry -- and passing it to new URL()
  // would throw at config load, taking the whole build down.
  images: {
    remotePatterns: /^https?:\/\//.test(process.env.STORAGE_PUBLIC_BASE_URL ?? '')
      ? [new URL(`${process.env.STORAGE_PUBLIC_BASE_URL}/**`)]
      : [],
  },
}

export default config
