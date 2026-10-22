/**
 * Normalizes Serbian and Bosnian phone numbers to country-code form without +.
 * Bosnian numbers require 387, +387 or 00387; numbers without a country code
 * retain the Serbian default because the two countries' local formats overlap.
 * Returns null if the input doesn't have a supported phone-number length.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;

  const digitsOnly = raw.replace(/[^\d+]/g, "");
  let digits = digitsOnly.replace(/\+/g, "");

  if (digits.startsWith("00381") || digits.startsWith("00387")) {
    digits = digits.slice(2);
  }

  // Bosnian mobile and landline numbers have 8 or 9 national digits, without a trunk 0.
  if (digits.startsWith("387")) {
    return /^387[1-9]\d{7,8}$/.test(digits) ? digits : null;
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
