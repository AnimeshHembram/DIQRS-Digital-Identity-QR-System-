// Identity QR payload validation.
//
// IMPORTANT: this checks that a scanned payload is *well-formed* and has the
// shape this app produces. It does NOT prove who issued it or that the data
// is true. Anyone can generate a QR that passes these checks. Real
// verification needs a trusted issuer (signed payloads or a backend lookup).
//
// Kept as plain CommonJS with no React/Expo imports so it can be unit-tested
// with Node alone (`npm test`) and still be imported from App.js.

const MAX_PAYLOAD_LENGTH = 2048;
const CLOCK_SKEW_MS = 5 * 60 * 1000; // tolerate 5 min of device clock drift
const MIN_ISSUED_YEAR = 2020;

// Matches generateUniqueId() in App.js: DID-<base36 timestamp>-<4 digits>
const ID_PATTERN = /^DID-[0-9A-Z]{6,12}-[0-9]{4}$/;
// Matches Date.prototype.toISOString() output (strict UTC form).
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

const REQUIRED_FIELDS = ["id", "name", "regNo", "course", "issuedAt"];
const TEXT_LIMITS = { name: 100, regNo: 50, course: 100 };

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkIssuedAt(value, now) {
  if (!ISO_PATTERN.test(value)) return "issuedAt must be an ISO 8601 UTC date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "issuedAt is not a valid date";
  // Round-trip catches impossible dates like 2026-02-30 that some engines roll over.
  if (date.toISOString().slice(0, 19) !== value.slice(0, 19)) {
    return "issuedAt is not a real calendar date";
  }
  if (date.getUTCFullYear() < MIN_ISSUED_YEAR) return "issuedAt is implausibly old";
  if (date.getTime() > now + CLOCK_SKEW_MS) return "issuedAt is in the future";
  return null;
}

/**
 * Validate an already-parsed payload object.
 * @returns {{valid: boolean, errors: string[], identity: object|null}}
 *   `identity` is a clean copy with only the expected, trimmed fields.
 */
function validateIdentityObject(payload, now = Date.now()) {
  const errors = [];

  if (!isPlainObject(payload)) {
    return { valid: false, errors: ["Payload is not an identity object"], identity: null };
  }

  const keys = Object.keys(payload);
  const unexpected = keys.filter((k) => !REQUIRED_FIELDS.includes(k));
  if (unexpected.length > 0) {
    errors.push(`Unexpected field(s): ${unexpected.slice(0, 5).join(", ")}`);
  }

  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      errors.push(`Missing field: ${field}`);
    } else if (typeof payload[field] !== "string") {
      errors.push(`Field ${field} must be text`);
    }
  }
  if (errors.length > 0) return { valid: false, errors, identity: null };

  const identity = {
    id: payload.id,
    name: payload.name.trim(),
    regNo: payload.regNo.trim(),
    course: payload.course.trim(),
    issuedAt: payload.issuedAt,
  };

  if (!ID_PATTERN.test(identity.id)) {
    errors.push("Identity ID has an invalid format");
  }

  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    const v = identity[field];
    if (v.length === 0) errors.push(`Field ${field} is empty`);
    else if (v.length > max) errors.push(`Field ${field} is too long`);
    else if (CONTROL_CHARS.test(v)) errors.push(`Field ${field} has invalid characters`);
  }

  const dateError = checkIssuedAt(identity.issuedAt, now);
  if (dateError) errors.push(dateError);

  if (errors.length > 0) return { valid: false, errors, identity: null };
  return { valid: true, errors: [], identity };
}

/**
 * Validate raw scanned QR text. Never throws.
 * @param {unknown} raw  The string from the barcode scanner.
 * @param {number} [now] Injectable clock for tests.
 */
function validateIdentityPayload(raw, now = Date.now()) {
  if (typeof raw !== "string" || raw.length === 0) {
    return { valid: false, errors: ["QR code is empty"], identity: null };
  }
  if (raw.length > MAX_PAYLOAD_LENGTH) {
    return { valid: false, errors: ["QR payload is too large"], identity: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { valid: false, errors: ["QR code is not valid JSON"], identity: null };
  }
  return validateIdentityObject(parsed, now);
}

module.exports = {
  validateIdentityPayload,
  validateIdentityObject,
  ID_PATTERN,
  MAX_PAYLOAD_LENGTH,
};
