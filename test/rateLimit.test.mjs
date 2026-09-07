import test from "node:test";
import assert from "node:assert/strict";
import { allowRequest } from "../lib/rateLimit.js";

// Minimal stand-ins for the Node req/res pair the handlers get. res records
// what the limiter did to it rather than writing anything.
const makeReq = (headers = {}, remoteAddress = "203.0.113.1") => ({
  headers,
  socket: { remoteAddress },
});
const makeRes = () => {
  const res = { statusCode: null, body: null, headers: {} };
  res.setHeader = (k, v) => {
    res.headers[k.toLowerCase()] = v;
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

// The limiter's map is module-level and shared across tests, so every test
// uses a distinct client identity to stay independent of the others.
let seq = 0;
const uniqueIp = () => `198.51.100.${++seq % 250}.${Date.now() % 1000}`;

test("allows up to the limit, then refuses", () => {
  const ip = uniqueIp();
  const req = makeReq({ "x-vercel-forwarded-for": ip });

  for (let i = 0; i < 5; i++) {
    assert.equal(allowRequest(req, makeRes(), { max: 5 }), true, `request ${i + 1} should pass`);
  }

  const res = makeRes();
  assert.equal(allowRequest(req, res, { max: 5 }), false, "the sixth should not");
  assert.equal(res.statusCode, 429);
  // Set as a number of seconds, which is what Node serialises into the header.
  assert.ok(res.headers["retry-after"] > 0, "must tell the caller when to come back");
});

test("a spoofed x-forwarded-for cannot mint a fresh bucket", () => {
  // The whole point of the header ordering: an attacker sending a different
  // X-Forwarded-For per request must still share one bucket, keyed on the
  // socket, because nothing here is a trusted proxy.
  const socketIp = uniqueIp();
  const send = (spoofed) =>
    allowRequest(makeReq({ "x-forwarded-for": spoofed }, socketIp), makeRes(), { max: 3 });

  assert.equal(send("1.1.1.1"), true);
  assert.equal(send("2.2.2.2"), true);
  assert.equal(send("3.3.3.3"), true);
  assert.equal(send("4.4.4.4"), false, "a new spoofed IP must not reset the count");
});

test("the platform-set header does separate genuine clients", () => {
  const a = uniqueIp();
  const b = uniqueIp();
  const send = (ip) => allowRequest(makeReq({ "x-vercel-forwarded-for": ip }), makeRes(), { max: 2 });

  assert.equal(send(a), true);
  assert.equal(send(a), true);
  assert.equal(send(a), false, "client A is out of budget");
  assert.equal(send(b), true, "client B must be unaffected");
});

test("x-forwarded-for is honoured only when explicitly trusted", () => {
  const socketIp = uniqueIp();
  const clientIp = uniqueIp();
  const req = makeReq({ "x-forwarded-for": `${clientIp}, 10.0.0.1` }, socketIp);

  process.env.TRUST_PROXY_HEADERS = "1";
  try {
    // Two different forwarded clients behind one socket now get their own
    // budgets, which is the entire reason the opt-in exists.
    assert.equal(allowRequest(req, makeRes(), { max: 1 }), true);
    assert.equal(allowRequest(req, makeRes(), { max: 1 }), false, "same forwarded client");
    const other = makeReq({ "x-forwarded-for": uniqueIp() }, socketIp);
    assert.equal(allowRequest(other, makeRes(), { max: 1 }), true, "different forwarded client");
  } finally {
    delete process.env.TRUST_PROXY_HEADERS;
  }
});

test("different limits do not share a budget", () => {
  // /api/audio runs at 300/min and /api/feed at 60; without per-limit keys a
  // listening session would spend the strict routes' allowance.
  const ip = uniqueIp();
  const req = makeReq({ "x-vercel-forwarded-for": ip });

  assert.equal(allowRequest(req, makeRes(), { max: 1 }), true);
  assert.equal(allowRequest(req, makeRes(), { max: 1 }), false, "strict bucket is spent");
  assert.equal(allowRequest(req, makeRes(), { max: 50 }), true, "generous bucket is untouched");
});

test("the window resets", () => {
  const ip = uniqueIp();
  const req = makeReq({ "x-vercel-forwarded-for": ip });

  assert.equal(allowRequest(req, makeRes(), { max: 1, windowMs: 1 }), true);
  const blocked = allowRequest(req, makeRes(), { max: 1, windowMs: 1 });
  assert.equal(blocked, false);

  // Busy-wait rather than sleep: the window is 1ms and this keeps the test
  // synchronous with the limiter's Date.now() clock.
  const until = Date.now() + 5;
  while (Date.now() < until) {
    /* spin */
  }
  assert.equal(allowRequest(req, makeRes(), { max: 1, windowMs: 1 }), true, "budget returns");
});
