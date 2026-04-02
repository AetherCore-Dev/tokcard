/**
 * Validates that a URL uses a safe scheme (http or https).
 * Returns the URL string if valid, empty string otherwise.
 * Prevents javascript: and data: URI attacks in shared card payloads.
 */
export function validateUrl(value: string): string {
  if (!value.trim()) return '';

  try {
    const { protocol } = new URL(value);
    if (protocol === 'https:' || protocol === 'http:') return value;
  } catch {
    // invalid URL
  }

  return '';
}

/**
 * Validates a color string is a safe hex color value.
 * Prevents CSS injection via inline style attributes.
 */
export function validateHexColor(value: string, fallback = '#6b7280'): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}
