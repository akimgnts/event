import { timingSafeEqual } from 'node:crypto';
export function validKey(value: string | null) {
  const key = process.env.EVENT_SIGNAL_INTERNAL_API_KEY;
  return Boolean(key && value && Buffer.byteLength(key) === Buffer.byteLength(value) && timingSafeEqual(Buffer.from(key), Buffer.from(value)));
}
