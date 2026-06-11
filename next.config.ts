import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        // Allow GLB and other large assets to load properly
        source: "/sofa.glb",
        headers: [
          {
            key: "Content-Type",
            value: "model/gltf-binary",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
