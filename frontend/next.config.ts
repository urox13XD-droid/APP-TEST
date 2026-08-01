import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // The `shared/` directory lives one level above this app (see /shared),
  // so Turbopack's module resolution root needs to include the repo root,
  // not just this package.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
