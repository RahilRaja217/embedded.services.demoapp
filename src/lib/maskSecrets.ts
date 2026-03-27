/**
 * Centralized utility for redacting sensitive information from logs, displays, and exports.
 * Used throughout the application to ensure secrets are never exposed.
 */

const REDACTED = '***REDACTED***';

// Headers that should always be redacted
const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'api-key',
  'x-client-secret',
  'client-secret',
];

// Body fields that should be redacted
const SENSITIVE_FIELDS = [
  'client_secret',
  'clientSecret',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'password',
  'secret',
  'token',
  'api_key',
  'apiKey',
];

/**
 * Redacts sensitive values from an object (headers or body)
 */
export function maskObject(obj: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!obj) return {};
  
  const masked: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if this key should be redacted
    if (SENSITIVE_HEADERS.includes(lowerKey) || SENSITIVE_FIELDS.includes(key)) {
      masked[key] = REDACTED;
    } else if (Array.isArray(value)) {
      // Preserve arrays as arrays, recursively masking each element
      masked[key] = value.map(item =>
        item && typeof item === 'object'
          ? maskObject(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      // Recursively mask nested objects
      masked[key] = maskObject(value as Record<string, unknown>);
    } else if (typeof value === 'string' && looksLikeSecret(value)) {
      // Heuristic check for values that look like secrets
      masked[key] = REDACTED;
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}

/**
 * Masks headers for display/logging
 */
export function maskHeaders(headers: Headers | Record<string, string> | null | undefined): Record<string, string> {
  if (!headers) return {};
  
  const result: Record<string, string> = {};
  
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      result[key] = SENSITIVE_HEADERS.includes(lowerKey) ? REDACTED : value;
    });
  } else {
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      result[key] = SENSITIVE_HEADERS.includes(lowerKey) ? REDACTED : value;
    }
  }
  
  return result;
}

/**
 * Masks a JSON string by parsing, masking, and re-stringifying
 */
export function maskJsonString(jsonStr: string | null | undefined): string {
  if (!jsonStr) return '';
  
  try {
    const parsed = JSON.parse(jsonStr);
    const masked = maskObject(parsed);
    return JSON.stringify(masked, null, 2);
  } catch {
    // If not valid JSON, try to mask any obvious secrets in the string
    return maskStringSecrets(jsonStr);
  }
}

/**
 * Masks secrets that might appear in a plain string
 */
export function maskStringSecrets(str: string): string {
  if (!str) return '';
  
  let result = str;
  
  // Mask Bearer tokens
  result = result.replace(/Bearer\s+[A-Za-z0-9\-_\.]+/gi, 'Bearer ***REDACTED***');
  
  // Mask Basic auth
  result = result.replace(/Basic\s+[A-Za-z0-9\+\/=]+/gi, 'Basic ***REDACTED***');
  
  // Mask common secret patterns in URLs or strings
  result = result.replace(/client_secret=[^&\s]+/gi, 'client_secret=***REDACTED***');
  result = result.replace(/access_token=[^&\s]+/gi, 'access_token=***REDACTED***');
  result = result.replace(/api_key=[^&\s]+/gi, 'api_key=***REDACTED***');
  
  return result;
}

/**
 * Heuristic check to see if a value looks like it might be a secret
 */
function looksLikeSecret(value: string): boolean {
  // Check for common secret patterns
  // JWT tokens
  if (/^eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(value)) {
    return true;
  }
  
  // Very long alphanumeric strings that look like tokens
  if (value.length > 40 && /^[A-Za-z0-9\-_]+$/.test(value)) {
    return true;
  }
  
  return false;
}

/**
 * Generates a cURL command from request details with secrets redacted
 */
export function generateCurl(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string | null
): string {
  const maskedHeaders = maskHeaders(headers);
  
  let curl = `curl -X ${method} '${url}'`;
  
  for (const [key, value] of Object.entries(maskedHeaders)) {
    curl += ` \\\n  -H '${key}: ${value}'`;
  }
  
  if (body && method !== 'GET') {
    const maskedBody = maskJsonString(body);
    curl += ` \\\n  -d '${maskedBody.replace(/'/g, "\\'")}'`;
  }
  
  return curl;
}

/**
 * Truncates a string to a maximum length, adding ellipsis if truncated
 */
export function truncateString(str: string, maxLength: number = 200000): string {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '... [truncated]';
}
