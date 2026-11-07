import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.178.98"],
  async headers() {
    return [
      {
        // Category artwork is requested by every phone at every question: let browsers keep it.
        // Not "immutable" because file names are not content-hashed: replace a file under a new name.
        source: "/categories/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
