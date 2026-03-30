import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { DocIntelligenceState, DocApiCall, WorkflowType, StatusType, ExtractionResult } from '@/types/docIntelligence';
import { setDocApiCallListener } from '@/services/docIntelligenceService';

const initialState: DocIntelligenceState = {
  mode: 'mock',
  workflow: 'accounts_payable',
  currentStep: 0,
  completedSteps: [],
  accessToken: null,
  customerUniqueId: null,
  orchestrationId: null,
  status: null,
  results: null,
  feedbackSent: false,
  documentPreviewUrl: null,
  documentFileType: null,
  downloadUrl: null,
  currentApiCall: null,
};

type Action =
  | { type: 'SET_MODE'; payload: 'mock' | 'live' }
  | { type: 'SET_WORKFLOW'; payload: WorkflowType }
  | { type: 'SET_STEP'; payload: number }
  | { type: 'COMPLETE_STEP'; payload: number }
  | { type: 'SET_TOKEN'; payload: string }
  | { type: 'SET_CUSTOMER_ID'; payload: string }
  | { type: 'SET_ORCHESTRATION_ID'; payload: string }
  | { type: 'SET_STATUS'; payload: StatusType }
  | { type: 'SET_RESULTS'; payload: ExtractionResult }
  | { type: 'SET_FEEDBACK_SENT'; payload: boolean }
  | { type: 'SET_DOCUMENT_PREVIEW'; payload: { url: string; fileType: string } }
  | { type: 'SET_DOWNLOAD_URL'; payload: string }
  | { type: 'SET_API_CALL'; payload: DocApiCall }
  | { type: 'RESET' };

function reducer(state: DocIntelligenceState, action: Action): DocIntelligenceState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_WORKFLOW':
      return { ...state, workflow: action.payload };
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'COMPLETE_STEP':
      return {
        ...state,
        completedSteps: state.completedSteps.includes(action.payload)
          ? state.completedSteps
          : [...state.completedSteps, action.payload],
      };
    case 'SET_TOKEN':
      return { ...state, accessToken: action.payload };
    case 'SET_CUSTOMER_ID':
      return { ...state, customerUniqueId: action.payload };
    case 'SET_ORCHESTRATION_ID':
      return { ...state, orchestrationId: action.payload };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_RESULTS':
      return { ...state, results: action.payload };
    case 'SET_FEEDBACK_SENT':
      return { ...state, feedbackSent: action.payload };
    case 'SET_DOCUMENT_PREVIEW':
      return { ...state, documentPreviewUrl: action.payload.url, documentFileType: action.payload.fileType };
    case 'SET_DOWNLOAD_URL':
      return { ...state, downloadUrl: action.payload };
    case 'SET_API_CALL':
      return { ...state, currentApiCall: action.payload };
    case 'RESET':
      return {
        ...initialState,
        // Preserve session-level data from Admin Settings — no need to re-auth
        accessToken: state.accessToken,
        customerUniqueId: state.customerUniqueId,
      };
    default:
      return state;
  }
}

interface DocIntelligenceContextType {
  state: DocIntelligenceState;
  dispatch: React.Dispatch<Action>;
  goToStep: (step: number) => void;
  completeAndAdvance: (currentStep: number) => void;
}

const DocIntelligenceContext = createContext<DocIntelligenceContextType | null>(null);

export function DocIntelligenceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  React.useEffect(() => {
    setDocApiCallListener((call) => {
      dispatch({ type: 'SET_API_CALL', payload: call });
    });
  }, []);

  const goToStep = useCallback((step: number) => {
    dispatch({ type: 'SET_STEP', payload: step });
  }, []);

  const completeAndAdvance = useCallback((currentStep: number) => {
    dispatch({ type: 'COMPLETE_STEP', payload: currentStep });
    dispatch({ type: 'SET_STEP', payload: currentStep + 1 });
  }, []);

  return (
    <DocIntelligenceContext.Provider value={{ state, dispatch, goToStep, completeAndAdvance }}>
      {children}
    </DocIntelligenceContext.Provider>
  );
}

export function useDocIntelligence() {
  const ctx = useContext(DocIntelligenceContext);
  if (!ctx) throw new Error('useDocIntelligence must be used within DocIntelligenceProvider');
  return ctx;
}
