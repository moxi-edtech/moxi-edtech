export function sanitizeEmail(input: string): string {
  // Normalize, remove zero-width and special space chars, then trim/lowercase
  return input
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '') // zero-width characters
    .replace(/\u00A0/g, ' ') // non-breaking space -> space
    .trim()
    .toLowerCase();
}

