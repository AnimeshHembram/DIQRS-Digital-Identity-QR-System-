// Run with: npm test   (uses Node's built-in test runner, no extra dependencies)
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateIdentityPayload, validateIdentityObject } = require("./validateIdentity");

const NOW = Date.parse("2026-10-22T10:00:00.000Z");

const validIdentity = () => ({
  id: "DID-MH3K9Z2A-4821",
  name: "Asha Verma",
  regNo: "21BCS1234",
  course: "B.Tech CSE",
  issuedAt: "2026-10-22T09:30:00.000Z",
});
const check = (obj) => validateIdentityPayload(JSON.stringify(obj), NOW);
const without = (field) => {
  const o = validIdentity();
  delete o[field];
  return o;
};

// Mirrors generateUniqueId() in App.js so a format change there fails here.
function generateUniqueId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `DID-${timestamp}-${random}`;
}

test("accepts a well-formed payload and returns a clean copy", () => {
  const r = check(validIdentity());
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.identity, validIdentity());
});

test("accepts IDs produced by the app's generator", () => {
  for (let i = 0; i < 200; i++) {
    const r = check({ ...validIdentity(), id: generateUniqueId() });
    assert.equal(r.valid, true, r.errors.join("; "));
  }
});

test("accepts payloads from toISOString() timestamps", () => {
  const r = check({ ...validIdentity(), issuedAt: new Date(NOW).toISOString() });
  assert.equal(r.valid, true);
});

test("trims surrounding whitespace in text fields", () => {
  const r = check({ ...validIdentity(), name: "  Asha Verma  " });
  assert.equal(r.valid, true);
  assert.equal(r.identity.name, "Asha Verma");
});

test("rejects malformed JSON", () => {
  for (const raw of ["{not json", "", "{", "undefined", '{"id":']) {
    assert.equal(validateIdentityPayload(raw, NOW).valid, false, raw);
  }
});

test("rejects non-string input without throwing", () => {
  for (const raw of [null, undefined, 42, {}, []]) {
    assert.equal(validateIdentityPayload(raw, NOW).valid, false);
  }
});

test("rejects JSON that is not an object", () => {
  for (const raw of ["null", "42", '"text"', "true", "[]", "[1,2]"]) {
    assert.equal(validateIdentityPayload(raw, NOW).valid, false, raw);
  }
});

test("rejects oversized payloads", () => {
  const big = JSON.stringify({ ...validIdentity(), name: "A".repeat(5000) });
  const r = validateIdentityPayload(big, NOW);
  assert.equal(r.valid, false);
  assert.match(r.errors[0], /too large/);
});

test("rejects each missing required field", () => {
  for (const f of ["id", "name", "regNo", "course", "issuedAt"]) {
    const r = check(without(f));
    assert.equal(r.valid, false, f);
    assert.ok(r.errors.some((e) => e.includes(f)), f);
  }
});

test("rejects non-string field values", () => {
  for (const f of ["id", "name", "regNo", "course", "issuedAt"]) {
    for (const bad of [123, null, true, [], {}]) {
      assert.equal(check({ ...validIdentity(), [f]: bad }).valid, false, `${f}=${JSON.stringify(bad)}`);
    }
  }
});

test("rejects empty or whitespace-only text fields", () => {
  for (const f of ["name", "regNo", "course"]) {
    assert.equal(check({ ...validIdentity(), [f]: "" }).valid, false, f);
    assert.equal(check({ ...validIdentity(), [f]: "   " }).valid, false, f);
  }
});

test("rejects over-long text fields and control characters", () => {
  assert.equal(check({ ...validIdentity(), name: "A".repeat(101) }).valid, false);
  assert.equal(check({ ...validIdentity(), regNo: "1".repeat(51) }).valid, false);
  assert.equal(check({ ...validIdentity(), name: "Asha\nVerma" }).valid, false);
  assert.equal(check({ ...validIdentity(), course: "CSE\u0000" }).valid, false);
});

test("rejects malformed identity IDs", () => {
  const badIds = [
    "",
    "did-MH3K9Z2A-4821", // lowercase prefix
    "DID-MH3K9Z2A-482", // 3-digit suffix
    "DID-MH3K9Z2A-48211", // 5-digit suffix
    "DID-mh3k9z2a-4821", // lowercase body
    "DID-MH3K-4821", // body too short
    "DID-MH3K9Z2AAAAAAA-4821", // body too long
    "XYZ-MH3K9Z2A-4821",
    " DID-MH3K9Z2A-4821",
    "DID-MH3K9Z2A-4821\n",
    "DID-MH3K9Z2A-4821<script>",
    "1' OR '1'='1",
  ];
  for (const id of badIds) {
    assert.equal(check({ ...validIdentity(), id }).valid, false, JSON.stringify(id));
  }
});

test("rejects invalid dates", () => {
  const badDates = [
    "not a date",
    "",
    "2026-13-01T00:00:00.000Z", // month 13
    "2026-02-30T00:00:00.000Z", // Feb 30
    "2026-10-22T25:00:00.000Z", // hour 25
    "2026-10-22", // date only
    "2026-10-22T09:30:00+05:30", // offset, not UTC
    "Thu Oct 22 2026",
    "1999-01-01T00:00:00.000Z", // implausibly old
    "2026-10-22T10:30:00.000Z", // future (> 5 min skew)
    "2099-01-01T00:00:00.000Z",
  ];
  for (const issuedAt of badDates) {
    assert.equal(check({ ...validIdentity(), issuedAt }).valid, false, issuedAt);
  }
});

test("tolerates small clock skew but not large", () => {
  assert.equal(check({ ...validIdentity(), issuedAt: "2026-10-22T10:03:00.000Z" }).valid, true);
  assert.equal(check({ ...validIdentity(), issuedAt: "2026-10-22T10:06:00.000Z" }).valid, false);
});

test("rejects unexpected extra fields", () => {
  const r = check({ ...validIdentity(), isAdmin: true });
  assert.equal(r.valid, false);
  assert.ok(r.errors[0].includes("isAdmin"));
});

test("rejects prototype-pollution style keys", () => {
  const raw = `{"__proto__":{"admin":true},"id":"DID-MH3K9Z2A-4821","name":"A","regNo":"1","course":"C","issuedAt":"2026-10-22T09:30:00.000Z"}`;
  assert.equal(validateIdentityPayload(raw, NOW).valid, false);
  assert.equal(({}).admin, undefined);
});

test("rejects other QR content (URLs, Wi-Fi, plain text)", () => {
  for (const raw of ["https://example.com", "WIFI:S:net;T:WPA;P:pw;;", "hello world", "upi://pay?pa=x@y"]) {
    assert.equal(validateIdentityPayload(raw, NOW).valid, false, raw);
  }
});

test("a forged but well-formed payload passes: format check is not authentication", () => {
  // Documents the known limitation: anyone can mint this.
  const forged = {
    id: "DID-AAAAAA-0000",
    name: "Not A Real Student",
    regNo: "000",
    course: "None",
    issuedAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(check(forged).valid, true);
});

test("validateIdentityObject rejects non-objects directly", () => {
  for (const v of [null, undefined, 5, "x", [], true]) {
    assert.equal(validateIdentityObject(v, NOW).valid, false);
  }
});

test("error messages do not echo scanned values back", () => {
  const r = check({ ...validIdentity(), id: "SECRET-VALUE-123" });
  assert.equal(r.valid, false);
  assert.ok(!r.errors.join(" ").includes("SECRET-VALUE-123"));
});
