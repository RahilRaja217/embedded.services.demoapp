/**
 * Configuration Manager
 * 
 * Handles loading configuration from:
 * 1. Optional app-config.local.json file (for local development)
 * 2. localStorage (for runtime overrides via Admin Settings)
 * 
 * File config takes precedence unless explicitly overridden in Admin UI.
 */

import { Credentials } from '@/types/sage';

const CONFIG_STORAGE_KEY = 'sage-demo-config';
const CONFIG_FILE_PATH = '/app-config.local.json';

interface ConfigState {
  credentials: Credentials | null;
  configSource: 'file' | 'localStorage' | 'none';
  fileConfigLoaded: boolean;
}

let cachedConfig: ConfigState | null = null;

/**
 * Attempts to load configuration from the local JSON file
 */
async function loadFileConfig(): Promise<Credentials | null> {
  try {
    const response = await fetch(CONFIG_FILE_PATH);
    if (response.ok) {
      const config = await response.json();
      return {
        clientId: config.clientId || '',
        clientSecret: config.clientSecret || '',
        subscriptionClientId: config.subscriptionClientId || '',
        subscriptionClientSecret: config.subscriptionClientSecret || '',
        productCode: config.productCode || 'SAGE_ONE',
        platform: config.platform || 'UK',
        businessTypeCode: config.businessTypeCode || 'SOLE_TRADER',
        bankOpeningBalanceJournalCode: config.bankOpeningBalanceJournalCode || '',
        bankPaymentJournalCode: config.bankPaymentJournalCode || '',
        bankReceiptJournalCode: config.bankReceiptJournalCode || '',
      };
    }
  } catch {
    // File doesn't exist or couldn't be loaded, which is fine
  }
  return null;
}

/**
 * Loads configuration from localStorage
 */
function loadLocalStorageConfig(): Credentials | null {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Invalid JSON or no data
  }
  return null;
}

/**
 * Saves configuration to localStorage
 */
export function saveConfig(credentials: Credentials): void {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(credentials));
  // Update cache
  if (cachedConfig) {
    cachedConfig.credentials = credentials;
    cachedConfig.configSource = 'localStorage';
  }
}

/**
 * Clears configuration from localStorage
 */
export function clearConfig(): void {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
  cachedConfig = null;
}

/**
 * Gets the current configuration, loading from file or localStorage as needed
 */
export async function getConfig(): Promise<ConfigState> {
  // Try to load file config first
  const fileConfig = await loadFileConfig();
  const localConfig = loadLocalStorageConfig();
  
  if (fileConfig) {
    cachedConfig = {
      credentials: fileConfig,
      configSource: 'file',
      fileConfigLoaded: true,
    };
  } else if (localConfig) {
    cachedConfig = {
      credentials: localConfig,
      configSource: 'localStorage',
      fileConfigLoaded: false,
    };
  } else {
    cachedConfig = {
      credentials: null,
      configSource: 'none',
      fileConfigLoaded: false,
    };
  }
  
  return cachedConfig;
}

/**
 * Gets cached configuration synchronously (may be stale if not initialized)
 */
export function getCachedConfig(): ConfigState | null {
  return cachedConfig;
}

/**
 * Checks if credentials are configured and valid
 */
export function hasValidCredentials(creds: Credentials | null): boolean {
  if (!creds) return false;
  return !!(
    creds.clientId &&
    creds.clientSecret &&
    creds.subscriptionClientId &&
    creds.subscriptionClientSecret
  );
}

// Base URLs for Sage APIs (actual external endpoints)
const SAGE_API_BASE_URL = 'https://api.sandbox.sbc.sage.com';
const SAGE_SUBSCRIPTION_API_URL = 'https://api.sandbox.sbc.sage.com/slcsadapter/v2';
const SAGE_TOKEN_URL = 'https://id-shadow.sage.com/oauth/token';

// Proxy paths for local development (to avoid CORS)
const PROXY_API_BASE_URL = '/api/sage-core';
const PROXY_SUBSCRIPTION_API_URL = '/api/sage-subscriptions';
const PROXY_TOKEN_URL = '/api/oauth/token';

/**
 * Checks if we're running in development mode with proxy available
 */
function useProxy(): boolean {
  return import.meta.env.DEV;
}

/**
 * Gets the API base URL for Sage sandbox
 * Uses local proxy in development to avoid CORS
 */
export function getApiBaseUrl(): string {
  return useProxy() ? PROXY_API_BASE_URL : SAGE_API_BASE_URL;
}

/**
 * Gets the subscription API base URL
 * Uses local proxy in development to avoid CORS
 */
export function getSubscriptionApiUrl(): string {
  return useProxy() ? PROXY_SUBSCRIPTION_API_URL : SAGE_SUBSCRIPTION_API_URL;
}

/**
 * Gets the OAuth token URL
 * Uses local proxy in development to avoid CORS
 */
export function getTokenUrl(): string {
  return useProxy() ? PROXY_TOKEN_URL : SAGE_TOKEN_URL;
}

/**
 * Gets the original (non-proxied) API URLs for logging/display purposes
 */
export function getOriginalApiBaseUrl(): string {
  return SAGE_API_BASE_URL;
}

export function getOriginalSubscriptionApiUrl(): string {
  return SAGE_SUBSCRIPTION_API_URL;
}

export function getOriginalTokenUrl(): string {
  return SAGE_TOKEN_URL;
}

// Export as object for convenient imports
export const configManager = {
  getConfig,
  getCachedConfig,
  saveConfig,
  clearConfig,
  hasValidCredentials,
  getApiBaseUrl,
  getSubscriptionApiUrl,
  getTokenUrl,
  getOriginalApiBaseUrl,
  getOriginalSubscriptionApiUrl,
  getOriginalTokenUrl,
};
