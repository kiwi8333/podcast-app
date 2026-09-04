// Applied to every response. None of these change how the app renders; they
// close off the classes of attack that need the browser's cooperation.
//
// The CSP here is deliberately partial. A full script-src would need a nonce
// threaded through every response, and the Pages Router emits inline
// bootstrap scripts — a naive `script-src 'self'` breaks the app outright.
// These three directives need no nonce and are worth having on their own:
// nothing may frame this app (clickjacking), no plugins may load, and a
// injected <base> tag cannot repoint every relative URL on the page.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
