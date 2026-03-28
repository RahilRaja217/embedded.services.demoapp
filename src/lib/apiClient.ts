/**
 * API Client Wrapper
 * 
 * Single HTTP client that:
 * - Automatically selects correct token (subscription vs tenant) based on endpoint
 * - Captures request/response metadata for logging
 * - Times each request (duration in ms)
 * - Generates unique requestId for each call
 * - Applies centralized redaction before logging
 * - Implements retry with exponential backoff for 429/5xx
 */

import { getToken, TokenType } from './tokenManager';
import { logApiCall, ApiLogEntry } from './logger';
import { getApiBaseUrl, getSubscriptionApiUrl, getOriginalApiBaseUrl, getOriginalSubscriptionApiUrl } from './configManager';
import { Credentials } from '@/types/sage';

export type FeatureArea = 'tenants' | 'bank-accounts' | 'financial-years' | 'transactions' | 'reports' | 'auth' | 'dimensions' | 'other';

export interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  body?: unknown;
  /** Pre-serialized JSON string – sent as-is, never touched by JSON.stringify */
  rawBody?: string;
  headers?: Record<string, string>;
  tokenType: TokenType;
  featureArea: FeatureArea;
  tenantId?: string | null;
  skipAuth?: boolean;
  retries?: number;
  /** Idempotency key for POST/PUT/PATCH requests (added as X-Idempotency-Key header) */
  idempotencyKey?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  error?: string;
  requestId: string;
  durationMs: number;
  logEntry: Omit<ApiLogEntry, 'id'>;
}

// Retry configuration
const DEFAULT_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

// Store for latest API call per feature (for Developer Mode panels)
const latestCalls: Record<FeatureArea, Omit<ApiLogEntry, 'id'> | null> = {
  tenants: null,
  'bank-accounts': null,
  'financial-years': null,
  transactions: null,
  reports: null,
  auth: null,
  dimensions: null,
  other: null,
};

/**
 * Generates a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extracts response headers as a simple object (subset of useful headers)
 */
function extractResponseHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  const interestingHeaders = [
    'content-type',
    'x-request-id',
    'x-correlation-id',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'retry-after',
    'date',
  ];
  
  headers.forEach((value, key) => {
    if (interestingHeaders.includes(key.toLowerCase())) {
      result[key] = value;
    }
  });
  
  return result;
}

/**
 * Gets the base URL for a token type (may be proxied in dev)
 */
function getBaseUrl(tokenType: TokenType): string {
  return tokenType === 'subscription' ? getSubscriptionApiUrl() : getApiBaseUrl();
}

/**
 * Gets the original (non-proxied) base URL for logging purposes
 */
function getOriginalBaseUrl(tokenType: TokenType): string {
  return tokenType === 'subscription' ? getOriginalSubscriptionApiUrl() : getOriginalApiBaseUrl();
}

/**
 * Sleeps for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Makes an API request with automatic token handling and logging
 */
export async function apiRequest<T = unknown>(
  options: ApiRequestOptions,
  credentials: Credentials
): Promise<ApiResponse<T>> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const maxRetries = options.retries ?? DEFAULT_MAX_RETRIES;
  
  // Build URL (may use proxy path in dev)
  const baseUrl = getBaseUrl(options.tokenType);
  const url = options.endpoint.startsWith('http') 
    ? options.endpoint 
    : `${baseUrl}${options.endpoint}`;
  
  // Build original URL for logging (always show actual Sage endpoint)
  const originalBaseUrl = getOriginalBaseUrl(options.tokenType);
  const logUrl = options.endpoint.startsWith('http') 
    ? options.endpoint 
    : `${originalBaseUrl}${options.endpoint}`;
  
  // Prepare request headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };
  
  // Add idempotency key header for mutating requests (non-subscription endpoints)
  if (options.idempotencyKey && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
    requestHeaders['X-Idempotency-Key'] = options.idempotencyKey;
  }
  
  // Get auth token if needed
  if (!options.skipAuth) {
    try {
      const clientId = options.tokenType === 'subscription' 
        ? credentials.subscriptionClientId 
        : credentials.clientId;
      const clientSecret = options.tokenType === 'subscription'
        ? credentials.subscriptionClientSecret
        : credentials.clientSecret;
      
      const token = await getToken(options.tokenType, clientId, clientSecret);
      
      if (!token) {
        const logEntry = createLogEntry({
          requestId,
          method: options.method,
          url: logUrl,
          requestHeaders,
          requestBody: options.rawBody || (options.body ? JSON.stringify(options.body, null, 2) : null),
          status: 0,
          statusText: 'Auth Failed',
          responseHeaders: {},
          responseBody: null,
          durationMs: Date.now() - startTime,
          tenantId: options.tenantId || null,
          featureArea: options.featureArea,
          error: 'Failed to obtain access token',
        });
        
        await logApiCall(logEntry);
        latestCalls[options.featureArea] = logEntry;
        
        return {
          success: false,
          data: null,
          status: 0,
          statusText: 'Auth Failed',
          headers: {},
          error: 'Failed to obtain access token',
          requestId,
          durationMs: Date.now() - startTime,
          logEntry,
        };
      }
      
      requestHeaders['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      const logEntry = createLogEntry({
        requestId,
        method: options.method,
        url: logUrl,
        requestHeaders,
        requestBody: options.rawBody || (options.body ? JSON.stringify(options.body) : null),
        status: 0,
        statusText: 'Auth Error',
        responseHeaders: {},
        responseBody: null,
        durationMs: Date.now() - startTime,
        tenantId: options.tenantId || null,
        featureArea: options.featureArea,
        error: error instanceof Error ? error.message : 'Authentication error',
      });
      
      await logApiCall(logEntry);
      latestCalls[options.featureArea] = logEntry;
      
      return {
        success: false,
        data: null,
        status: 0,
        statusText: 'Auth Error',
        headers: {},
        error: error instanceof Error ? error.message : 'Authentication error',
        requestId,
        durationMs: Date.now() - startTime,
        logEntry,
      };
    }
  }
  
  // Make request with retry logic
  let lastError: Error | null = null;
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      // Use rawBody verbatim if provided; otherwise JSON.stringify body
      const serializedBody = options.rawBody
        ? options.rawBody
        : (options.body ? JSON.stringify(options.body) : undefined);

      const response = await fetch(url, {
        method: options.method,
        headers: requestHeaders,
        body: serializedBody,
      });
      
      const durationMs = Date.now() - startTime;
      const responseHeaders = extractResponseHeaders(response.headers);
      
      let responseBody: string | null = null;
      let data: T | null = null;
      
      try {
        responseBody = await response.text();
        if (responseBody) {
          data = JSON.parse(responseBody) as T;
        }
      } catch {
        // Response might not be JSON
      }
      
      const logEntry = createLogEntry({
        requestId,
        method: options.method,
        url: logUrl,
        requestHeaders,
        requestBody: options.rawBody ? options.rawBody : (options.body ? JSON.stringify(options.body) : null),
        status: response.status,
        statusText: response.statusText,
        responseHeaders,
        responseBody,
        durationMs,
        tenantId: options.tenantId || null,
        featureArea: options.featureArea,
      });
      
      // Log the call
      await logApiCall(logEntry);
      latestCalls[options.featureArea] = logEntry;
      
      // Check if we should retry
      if (RETRYABLE_STATUS_CODES.includes(response.status) && attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        attempt++;
        continue;
      }
      
      return {
        success: response.ok,
        data: response.ok ? data : null,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        error: response.ok ? undefined : responseBody || response.statusText,
        requestId,
        durationMs,
        logEntry,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check for CORS or network errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        const logEntry = createLogEntry({
          requestId,
          method: options.method,
          url: logUrl,
          requestHeaders,
           requestBody: options.rawBody || (options.body ? JSON.stringify(options.body) : null),
          status: 0,
          statusText: 'CORS/Network Error',
          responseHeaders: {},
          responseBody: null,
          durationMs: Date.now() - startTime,
          tenantId: options.tenantId || null,
          featureArea: options.featureArea,
          error: 'CORS restriction or network error - sandbox endpoint may not support browser requests',
        });
        
        await logApiCall(logEntry);
        latestCalls[options.featureArea] = logEntry;
        
        return {
          success: false,
          data: null,
          status: 0,
          statusText: 'CORS/Network Error',
          headers: {},
          error: 'CORS restriction or network error - sandbox endpoint may not support browser requests',
          requestId,
          durationMs: Date.now() - startTime,
          logEntry,
        };
      }
      
      // Retry on network errors
      if (attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        attempt++;
        continue;
      }
    }
  }
  
  // All retries exhausted
  const logEntry = createLogEntry({
    requestId,
    method: options.method,
    url: logUrl,
    requestHeaders,
    requestBody: options.rawBody || (options.body ? JSON.stringify(options.body) : null),
    status: 0,
    statusText: 'Request Failed',
    responseHeaders: {},
    responseBody: null,
    durationMs: Date.now() - startTime,
    tenantId: options.tenantId || null,
    featureArea: options.featureArea,
    error: lastError?.message || 'Request failed after retries',
  });
  
  await logApiCall(logEntry);
  latestCalls[options.featureArea] = logEntry;
  
  return {
    success: false,
    data: null,
    status: 0,
    statusText: 'Request Failed',
    headers: {},
    error: lastError?.message || 'Request failed after retries',
    requestId,
    durationMs: Date.now() - startTime,
    logEntry,
  };
}

/**
 * Helper to create a log entry
 */
function createLogEntry(params: {
  requestId: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  status: number;
  statusText: string;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
  durationMs: number;
  tenantId: string | null;
  featureArea: string;
  error?: string;
}): Omit<ApiLogEntry, 'id'> {
  return {
    requestId: params.requestId,
    timestamp: new Date().toISOString(),
    method: params.method,
    url: params.url,
    status: params.status,
    statusText: params.statusText,
    durationMs: params.durationMs,
    requestHeaders: params.requestHeaders,
    requestBody: params.requestBody,
    responseHeaders: params.responseHeaders,
    responseBody: params.responseBody,
    tenantId: params.tenantId,
    featureArea: params.featureArea,
    error: params.error,
  };
}

/**
 * Gets the latest API call for a feature area
 */
export function getLatestCall(featureArea: FeatureArea): Omit<ApiLogEntry, 'id'> | null {
  return latestCalls[featureArea];
}

/**
 * Clears the latest call for a feature area
 */
export function clearLatestCall(featureArea: FeatureArea): void {
  latestCalls[featureArea] = null;
}

// Export as apiClient object for convenient imports
export const apiClient = {
  request: apiRequest,
  getLatestCall,
  clearLatestCall,
  
  // Convenience methods that throw on error
  async get<T>(url: string, options: Omit<ApiRequestOptions, 'method' | 'endpoint'> & { credentials: import('@/types/sage').Credentials }): Promise<T> {
    const { credentials, ...rest } = options;
    const response = await apiRequest<T>({ ...rest, method: 'GET', endpoint: url }, credentials);
    if (!response.success) throw new Error(response.error || `Request failed: ${response.status}`);
    return response.data!;
  },
  
  async post<T>(url: string, body: unknown, options: Omit<ApiRequestOptions, 'method' | 'endpoint' | 'body'> & { credentials: import('@/types/sage').Credentials }): Promise<T> {
    const { credentials, ...rest } = options;
    const response = await apiRequest<T>({ ...rest, method: 'POST', endpoint: url, body }, credentials);
    if (!response.success) throw new Error(response.error || `Request failed: ${response.status}`);
    return response.data!;
  },
  
  async put<T>(url: string, body: unknown, options: Omit<ApiRequestOptions, 'method' | 'endpoint' | 'body'> & { credentials: import('@/types/sage').Credentials }): Promise<T> {
    const { credentials, ...rest } = options;
    const response = await apiRequest<T>({ ...rest, method: 'PUT', endpoint: url, body }, credentials);
    if (!response.success) throw new Error(response.error || `Request failed: ${response.status}`);
    return response.data!;
  },
  
  async delete<T>(url: string, options: Omit<ApiRequestOptions, 'method' | 'endpoint'> & { credentials: import('@/types/sage').Credentials }): Promise<T> {
    const { credentials, ...rest } = options;
    const response = await apiRequest<T>({ ...rest, method: 'DELETE', endpoint: url }, credentials);
    if (!response.success) throw new Error(response.error || `Request failed: ${response.status}`);
    return response.data!;
  },
};
