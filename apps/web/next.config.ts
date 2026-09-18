import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Foto menu masih memakai Unsplash sampai kafe punya foto sendiri.
    // Sumbernya dibatasi ke satu host supaya URL dari data tidak bisa
    // dipakai memuat gambar dari mana saja.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
