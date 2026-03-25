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
  images: {
    unoptimized: true,
  },
}

export default nextConfig
