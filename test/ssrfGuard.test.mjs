import test from "node:test";
import assert from "node:assert/strict";
import { assertPublicHttpUrl, readCappedText } from "../lib/ssrfGuard.js";

// Every case here uses an IP literal or a scheme the guard rejects before it
// resolves anything, so the suite never touches DNS or the network.

const rejects = async (url, why) =>
  assert.rejects(() => assertPublicHttpUrl(url), Error, `expected rejection: ${why}`);

test("rejects loopback in both families", async () => {
  await rejects("http://127.0.0.1/", "IPv4 loopback");
  await rejects("http://127.255.255.254/", "anywhere in 127/8");
  await rejects("http://[::1]/", "IPv6 loopback");
});

test("rejects RFC1918 and carrier-grade NAT space", async () => {
  await rejects("http://10.0.0.1/", "10/8");
  await rejects("http://172.16.0.1/", "172.16/12 low edge");
  await rejects("http://172.31.255.255/", "172.16/12 high edge");
  await rejects("http://192.168.1.1/", "192.168/16");
  await rejects("http://100.64.0.1/", "100.64/10 CGNAT");
});

test("rejects the cloud metadata address", async () => {
  // The single most valuable SSRF target on any cloud host.
  await rejects("http://169.254.169.254/latest/meta-data/", "link-local metadata");
});

test("rejects reserved ranges that are not privately routable either", async () => {
  await rejects("http://0.0.0.0/", "0/8");
  await rejects("http://192.0.0.1/", "IETF protocol assignments");
  await rejects("http://198.18.0.1/", "benchmarking range");
  await rejects("http://239.255.255.250/", "multicast");
});

test("rejects both spellings of an IPv4-mapped IPv6 address", async () => {
  // The compact form was already caught; the expanded one read as an
  // ordinary public v6 address until the hex tail was decoded.
  await rejects("http://[::ffff:127.0.0.1]/", "compact v4-mapped");
  await rejects("http://[0:0:0:0:0:ffff:7f00:1]/", "expanded v4-mapped, hex tail");
  await rejects("http://[::ffff:10.0.0.1]/", "v4-mapped private");
});

test("rejects transition prefixes that embed a v4 target", async () => {
  await rejects("http://[2002:7f00:1::]/", "6to4");
  await rejects("http://[64:ff9b::7f00:1]/", "NAT64");
});

test("rejects unique-local and link-local IPv6", async () => {
  await rejects("http://[fd00::1]/", "unique local");
  await rejects("http://[fe80::1]/", "link local");
});

test("rejects non-http schemes", async () => {
  await rejects("file:///etc/passwd", "file");
  await rejects("gopher://8.8.8.8/", "gopher");
  await rejects("javascript:alert(1)", "javascript");
});

test("rejects credentials in the URL", async () => {
  // Reads as "example.com" to a human skimming a feed; connects to 127.0.0.1.
  await rejects("http://example.com@127.0.0.1/", "userinfo hides the real host");
  await rejects("http://user:pass@8.8.8.8/", "credentials at all");
});

test("rejects localhost by name without resolving it", async () => {
  await rejects("http://localhost:3000/", "localhost");
  await rejects("http://anything.localhost/", ".localhost suffix");
});

test("rejects malformed input rather than passing it through", async () => {
  await rejects("not a url", "unparseable");
  await rejects("", "empty");
});

test("allows an ordinary public address", async () => {
  // The guard has to stay useful: a public IP literal needs no DNS and must
  // come back parsed, or every one of the rejections above proves nothing.
  const parsed = await assertPublicHttpUrl("https://8.8.8.8/feed.xml");
  assert.equal(parsed.hostname, "8.8.8.8");
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.pathname, "/feed.xml");
});

test("readCappedText refuses a body larger than the cap", async () => {
  const body = "x".repeat(5000);
  await assert.rejects(
    () => readCappedText(new Response(body), 1000),
    /too large/i,
    "should stop reading rather than buffer the whole body"
  );
});

test("readCappedText refuses on a declared content-length over the cap", async () => {
  // The cheap check: refuse before reading a single byte when the origin
  // already told us how big it is.
  const response = new Response("short", { headers: { "content-length": "999999" } });
  await assert.rejects(() => readCappedText(response, 1000), /too large/i);
});

test("readCappedText returns a body within the cap", async () => {
  assert.equal(await readCappedText(new Response("hello"), 1000), "hello");
});
