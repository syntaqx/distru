import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repo sits under a folder with sibling lockfiles; pin the workspace root.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
