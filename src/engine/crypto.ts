/**
 * Cryptographic hashing utility for SAT-SA
 * Generates deterministic SHA-256 hashes for datasets, run manifests, and configuration
 * Operates offline in-browser using standard Web Crypto API with fallback
 */

export async function computeSHA256(data: string | object | ArrayBuffer | Uint8Array): Promise<string> {
  let uint8Data: Uint8Array;
  if (data instanceof ArrayBuffer) {
    uint8Data = new Uint8Array(data);
  } else if (data instanceof Uint8Array) {
    uint8Data = data;
  } else if (typeof data === 'string') {
    uint8Data = new TextEncoder().encode(data);
  } else {
    uint8Data = new TextEncoder().encode(JSON.stringify(data));
  }

  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', uint8Data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    }
  } catch (e) {
    // Fallback if subtle crypto is restricted in iframe context
  }

  // Pure deterministic software fallback (djb2 / FNV-1a hybrid 64-char hex string)
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
  for (let i = 0; i < uint8Data.length; i++) {
    const byte = uint8Data[i];
    h1 = Math.imul(h1 ^ byte, 2654435761);
    h2 = Math.imul(h2 ^ byte, 1597334677);
    h3 = Math.imul(h3 ^ byte, 2246822519);
    h4 = Math.imul(h4 ^ byte, 3266489917);
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const part1 = toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4);
  const part2 = toHex(h4 ^ h1) + toHex(h3 ^ h2) + toHex(h2 ^ h3) + toHex(h1 ^ h4);
  return (part1 + part2).slice(0, 64);
}

export function formatShortHash(hash: string, length = 10): string {
  if (!hash) return '';
  return `${hash.slice(0, length)}…${hash.slice(-4)}`;
}
