import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Security headers on every response. There is no Content-Security-Policy yet: Next.js inlines
// scripts, so a policy needs nonces and a production build to test against.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera stays allowed for this site because expense submission has a "Take a photo" button.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" }]
    : []),
];

const nextConfig = (phase: string): NextConfig => ({
  // Keep local production builds from replacing a running dev server's artifacts. Vercel always
  // reads the build from ".next", so the separate folder is only used off Vercel.
  distDir: phase === PHASE_DEVELOPMENT_SERVER || process.env.VERCEL ? ".next" : ".next-build",
  serverExternalPackages: ["tesseract.js"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
});

export default nextConfig;
