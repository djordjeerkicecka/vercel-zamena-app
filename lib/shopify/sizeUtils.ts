export const SIZE_OPTION_PATTERN = /veli[cč]ina|size|broj/i;
export const COLOR_OPTION_PATTERN = /boja|color/i;

export function parseSizeValue(value: string): number | null {
  const match = value.match(/\d+([.,]\d+)?/);
  if (!match) return null;
  return parseFloat(match[0].replace(",", "."));
}
