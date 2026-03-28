/**
 * Developer Mode Context
 * 
 * Global state for Developer Mode toggle and API call tracking.
 * Features:
 * - Toggle Developer Mode on/off (persisted to localStorage)
 * - Track latest API call per feature area for panel display
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ApiLogEntry } from '@/lib/logger';
import { getLatestCall, FeatureArea } from '@/lib/apiClient';

interface DeveloperModeContextType {
  isDeveloperMode: boolean;
  toggleDeveloperMode: () => void;
  setDeveloperMode: (enabled: boolean) => void;
  getLatestApiCall: (featureArea: FeatureArea) => Omit<ApiLogEntry, 'id'> | null;
  refreshLatestCall: (featureArea: FeatureArea) => void;
  latestCallTimestamp: number; // Used to trigger re-renders
}

const DeveloperModeContext = createContext<DeveloperModeContextType | undefined>(undefined);

const STORAGE_KEY = 'sage-demo-developer-mode';

export function DeveloperModeProvider({ children }: { children: ReactNode }) {
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [latestCallTimestamp, setLatestCallTimestamp] = useState(0);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true') {
      setIsDeveloperMode(true);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, isDeveloperMode ? 'true' : 'false');
  }, [isDeveloperMode]);

  const toggleDeveloperMode = useCallback(() => {
    setIsDeveloperMode(prev => !prev);
  }, []);

  const setDeveloperMode = useCallback((enabled: boolean) => {
    setIsDeveloperMode(enabled);
  }, []);

  const getLatestApiCall = useCallback((featureArea: FeatureArea) => {
    return getLatestCall(featureArea);
  }, []);

  const refreshLatestCall = useCallback((featureArea: FeatureArea) => {
    // Trigger a re-render by updating timestamp
    setLatestCallTimestamp(Date.now());
  }, []);

  return (
    <DeveloperModeContext.Provider
      value={{
        isDeveloperMode,
        toggleDeveloperMode,
        setDeveloperMode,
        getLatestApiCall,
        refreshLatestCall,
        latestCallTimestamp,
      }}
    >
      {children}
    </DeveloperModeContext.Provider>
  );
}

export function useDeveloperMode() {
  const context = useContext(DeveloperModeContext);
  if (context === undefined) {
    throw new Error('useDeveloperMode must be used within a DeveloperModeProvider');
  }
  return context;
}
