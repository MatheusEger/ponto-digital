// lib/fingerprint.ts
'use client';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

let cached: string | null = null;
let inflight: Promise<string> | null = null;

export async function getDeviceHash(): Promise<string> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    const id = result.visitorId;
    cached = id;
    return id;
  })();
  return inflight;
}
