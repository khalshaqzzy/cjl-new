import path from "node:path"

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: path.join(process.cwd(), "../.."),
  },
  transpilePackages: ["@cjl/contracts"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  logging: {
    browserToTerminal: true,
  },
}

export default nextConfig
