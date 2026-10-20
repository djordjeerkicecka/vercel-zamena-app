/**
 * Normalizes Serbian phone numbers to a comparable canonical form: "381XXXXXXXXX" (no +, no leading 0).
 * Accepts formats like +381 64 123 4567, 0641234567, 064/123-4567, 06-4123-4567, etc.
 * Returns null if the input doesn't look like a valid Serbian mobile/landline number.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;

  const digitsOnly = raw.replace(/[^\d+]/g, "");
  let digits = digitsOnly.replace(/\+/g, "");

  if (digits.startsWith("00381")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("381")) {
    // already in country-code form
  } else if (digits.startsWith("0")) {
    digits = "381" + digits.slice(1);
  } else if (digits.length >= 8) {
    // assume local number missing leading 0 (rare but be lenient)
    digits = "381" + digits;
  } else {
    return null;
  }

  // Serbian numbers: 381 + 8-10 digits is the realistic range.
  if (digits.length < 11 || digits.length > 13) return null;

  return digits;
}

export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  return na === nb;
}
