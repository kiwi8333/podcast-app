import dns from "node:dns/promises";
import net from "node:net";

function isPrivateIPv4(ip) {
  const [a, b] = ip.split(".").map(Number);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10
  if (/^f[cd]/.test(lower)) return true; // unique local fc00::/7
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice("::ffff:".length);
    if (net.isIPv4(v4)) return isPrivateIPv4(v4);
  }
  return false;
}

function isPrivateIP(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unrecognized format — fail closed
}

// Blocks requests to loopback/private/link-local/metadata addresses so these
// routes can't be used to reach internal network services (SSRF). Checks the
// resolved DNS address, not just the literal hostname, since a public-looking
// hostname can still resolve to a private IP.
export async function assertPublicHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }

  const hostname = parsed.hostname;

  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) throw new Error("This host is not allowed");
    return parsed;
  }

  if (hostname.toLowerCase() === "localhost") {
    throw new Error("This host is not allowed");
  }

  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0 || records.some((r) => isPrivateIP(r.address))) {
    throw new Error("This host is not allowed");
  }

  return parsed;
}
