/**
 * Generates a UUID v4 for use as idempotency keys in API requests.
 * 
 * Usage:
 * - For subscription endpoints: Pass as `ReferenceId` in the request body
 * - For other endpoints: Pass as `X-Idempotency-Key` header
 */
export function generateIdempotencyKey(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
