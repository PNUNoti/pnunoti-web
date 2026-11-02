import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow preview/build checks alongside an existing development server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
