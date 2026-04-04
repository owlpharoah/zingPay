/**
 * Hash a phone number (E.164 format) using SHA-256.
 * Returns Uint8Array (32 bytes).
 */
export async function hashPhone(phoneE164: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(phoneE164);
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    encoded as unknown as BufferSource,
  );
  return new Uint8Array(hashBuffer);
}

/**
 * Convert Uint8Array to hex string.
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
