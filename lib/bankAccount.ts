// Serbian dinar current account (tekući račun): 18 digits, displayed as XXX-XXXXXXXXXXXXX-XX
// (3 bank + 13 account + 2 control). The customer must enter all 18 digits (including any leading
// zeros in the middle group) — we don't pad or guess. Dashes are added automatically as they type.

export const BANK_ACCOUNT_DIGITS = 18;

/** Progressive formatter for the input field: inserts dashes as the customer types digits. */
export function formatSerbianBankAccountAsTyped(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, BANK_ACCOUNT_DIGITS);
  let out = d.slice(0, 3);
  if (d.length > 3) out += "-" + d.slice(3, 16);
  if (d.length > 16) out += "-" + d.slice(16, 18);
  return out;
}

/** Valid only when exactly 18 digits have been entered. */
export function isValidSerbianBankAccount(raw: string): boolean {
  return raw.replace(/\D/g, "").length === BANK_ACCOUNT_DIGITS;
}

/** Count of digits entered so far (for the live "X/18" hint). */
export function bankAccountDigitCount(raw: string): number {
  return raw.replace(/\D/g, "").length;
}

/** Canonical dashed form XXX-XXXXXXXXXXXXX-XX — used for storage and the Sheets export. */
export function formatSerbianBankAccount(raw: string): string {
  return formatSerbianBankAccountAsTyped(raw);
}
