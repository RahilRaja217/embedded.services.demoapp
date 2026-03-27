/**
 * IndexedDB Logger Service
 * 
 * Logs all API calls to IndexedDB for debugging and export.
 * Features:
 * - Centralized redaction before storage
 * - Query and filter capabilities
 * - Export to JSON file
 * - Clear logs functionality
 */

import { maskHeaders, maskJsonString, truncateString } from './maskSecrets';

const DB_NAME = 'sage-demo-logs';
const STORE_NAME = 'api-calls';
const DB_VERSION = 1;
const MAX_BODY_SIZE = 200 * 1024; // 200KB max for response bodies

export interface ApiLogEntry {
  id?: number; // Auto-increment
  requestId: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  durationMs: number;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseHeaders: Record<string, string>;
  responseBody: string | null;
  tenantId: string | null;
  featureArea: string;
  error?: string;
}

export interface LogFilter {
  endpointSearch?: string;
  statusMin?: number;
  statusMax?: number;
  startTime?: Date;
  endTime?: Date;
  featureArea?: string;
  tenantId?: string;
}

let db: IDBDatabase | null = null;

/**
 * Opens the IndexedDB database
 */
async function openDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        
        // Create indexes for filtering
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('featureArea', 'featureArea', { unique: false });
        store.createIndex('tenantId', 'tenantId', { unique: false });
        store.createIndex('requestId', 'requestId', { unique: true });
      }
    };
  });
}

/**
 * Logs an API call entry (with automatic redaction)
 */
export async function logApiCall(entry: Omit<ApiLogEntry, 'id'>): Promise<void> {
  try {
    const database = await openDatabase();
    
    // Apply redaction to sensitive data
    const redactedEntry: Omit<ApiLogEntry, 'id'> = {
      ...entry,
      requestHeaders: maskHeaders(entry.requestHeaders),
      requestBody: entry.requestBody ? maskJsonString(entry.requestBody) : null,
      responseBody: entry.responseBody 
        ? truncateString(maskJsonString(entry.responseBody), MAX_BODY_SIZE)
        : null,
    };

    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    store.add(redactedEntry);
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to log API call:', error);
  }
}

/**
 * Gets all logs (latest first)
 */
export async function getAllLogs(): Promise<ApiLogEntry[]> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const logs = request.result as ApiLogEntry[];
        // Sort by timestamp descending (latest first)
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(logs);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get logs:', error);
    return [];
  }
}

/**
 * Gets filtered logs
 */
export async function getFilteredLogs(filter: LogFilter): Promise<ApiLogEntry[]> {
  const allLogs = await getAllLogs();
  
  return allLogs.filter(log => {
    // Endpoint search
    if (filter.endpointSearch && !log.url.toLowerCase().includes(filter.endpointSearch.toLowerCase())) {
      return false;
    }
    
    // Status range
    if (filter.statusMin && log.status < filter.statusMin) {
      return false;
    }
    if (filter.statusMax && log.status > filter.statusMax) {
      return false;
    }
    
    // Time range
    const logTime = new Date(log.timestamp).getTime();
    if (filter.startTime && logTime < filter.startTime.getTime()) {
      return false;
    }
    if (filter.endTime && logTime > filter.endTime.getTime()) {
      return false;
    }
    
    // Feature area
    if (filter.featureArea && log.featureArea !== filter.featureArea) {
      return false;
    }
    
    // Tenant ID
    if (filter.tenantId && log.tenantId !== filter.tenantId) {
      return false;
    }
    
    return true;
  });
}

/**
 * Gets a single log by request ID
 */
export async function getLogByRequestId(requestId: string): Promise<ApiLogEntry | null> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('requestId');
    
    return new Promise((resolve, reject) => {
      const request = index.get(requestId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get log:', error);
    return null;
  }
}

/**
 * Clears all logs from IndexedDB
 */
export async function clearAllLogs(): Promise<void> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    store.clear();
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Failed to clear logs:', error);
    throw error;
  }
}

/**
 * Exports logs to a downloadable JSON file
 */
export function exportLogsToFile(logs: ApiLogEntry[], filename?: string): void {
  const data = JSON.stringify(logs, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `sage-api-logs-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Gets log count
 */
export async function getLogCount(): Promise<number> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get log count:', error);
    return 0;
  }
}
