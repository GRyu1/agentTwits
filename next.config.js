/** @type {import('next').NextConfig} */
const nextConfig = {
  // Coinbase AgentKit's barrel re-exports many action providers whose
  // transitive deps are ESM-only (jose, clanker-sdk, @base-org/account, etc).
  // Marking the package as a server-external pkg makes Next skip bundling and
  // load it from node_modules at runtime — the standard fix per Next docs.
  experimental: {
    serverComponentsExternalPackages: [
      '@coinbase/agentkit',
      '@coinbase/cdp-sdk',
    ],
  },
}
module.exports = nextConfig
