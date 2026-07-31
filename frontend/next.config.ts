import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin Turbopack root to this app so the empty parent lockfile is ignored.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
