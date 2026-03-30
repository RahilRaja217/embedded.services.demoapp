import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DocIntelligenceProvider, useDocIntelligence } from '@/contexts/DocIntelligenceContext';
import { useApp } from '@/contexts/AppContext';
import { docGetToken } from '@/services/docIntelligenceService';
import Step3Defaults from '@/components/docIntelligence/steps/Step3Defaults';
import Step4Upload from '@/components/docIntelligence/steps/Step4Upload';
import Step5Status from '@/components/docIntelligence/steps/Step5Status';
import Step6Results from '@/components/docIntelligence/steps/Step6Results';
import StepComplete from '@/components/docIntelligence/steps/StepComplete';
import '@/styles/doc-intelligence.css';
import { cn } from '@/lib/utils';

const STEPS = [
  { label: 'Configure Defaults', short: 'Defaults' },
  { label: 'Upload Document', short: 'Upload' },
  { label: 'Processing Status', short: 'Status' },
  { label: 'Review & Confirm', short: 'Results' },
];

function DocIntelligenceInner() {
  const { state, dispatch, goToStep } = useDocIntelligence();
  const { docCredentials } = useApp();
  const [tokenStatus, setTokenStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Populate customerUniqueId from Admin Settings
  useEffect(() => {
    if (docCredentials?.customerUniqueId) {
      dispatch({ type: 'SET_CUSTOMER_ID', payload: docCredentials.customerUniqueId });
    }
  }, [docCredentials?.customerUniqueId]);

  // Auto-fetch token when mode changes or credentials change
  useEffect(() => {
    if (state.mode === 'live' && (!docCredentials?.clientId || !docCredentials?.clientSecret)) {
      setTokenStatus('error');
      return;
    }

    setTokenStatus('loading');
    const clientId = state.mode === 'mock' ? '' : (docCredentials?.clientId || '');
    const clientSecret = state.mode === 'mock' ? '' : (docCredentials?.clientSecret || '');

    docGetToken(clientId, clientSecret, state.mode)
      .then((res) => {
        dispatch({ type: 'SET_TOKEN', payload: res.access_token });
        setTokenStatus('ready');
      })
      .catch(() => setTokenStatus('error'));
  }, [state.mode, docCredentials?.clientId, docCredentials?.clientSecret]);

  const renderStep = () => {
    switch (state.currentStep) {
      case 0: return <Step3Defaults />;
      case 1: return <Step4Upload />;
      case 2: return <Step5Status />;
      case 3: return <Step6Results />;
      case 4: return <StepComplete />;
      default: return <Step3Defaults />;
    }
  };

  const isComplete = state.currentStep >= 4;

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Page header */}
        <div className="page-header">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="page-title">Document Intelligence</h1>
              <p className="page-description">
                AI-powered extraction from invoices and receipts using the Sage Mercury Orchestration API.
                Walk through the full integration flow step by step.
              </p>
            </div>
            {/* Controls */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Workflow selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Workflow</label>
                <select
                  className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground"
                  value={state.workflow}
                  onChange={(e) => {
                    dispatch({ type: 'SET_WORKFLOW', payload: e.target.value as 'accounts_payable' | 'employee_expense' });
                    dispatch({ type: 'RESET' });
                  }}
                >
                  <option value="accounts_payable">Accounts Payable</option>
                  <option value="employee_expense">Employee Expense</option>
                </select>
              </div>
              {/* Mode toggle */}
              <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                <button
                  onClick={() => dispatch({ type: 'SET_MODE', payload: 'mock' })}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                    state.mode === 'mock'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  🧪 Mock
                </button>
                <button
                  onClick={() => dispatch({ type: 'SET_MODE', payload: 'live' })}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                    state.mode === 'live'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  🔴 Live
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live mode warning when credentials not configured */}
        {state.mode === 'live' && tokenStatus === 'error' && (
          <div className="mb-4 p-4 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-3 text-sm">
            <span className="text-warning font-bold flex-shrink-0 mt-0.5">⚠</span>
            <div>
              <strong className="text-foreground">Doc Intelligence credentials not configured.</strong>
              <span className="text-muted-foreground ml-1">
                Go to <strong>Admin Settings</strong> to enter your Client ID, Client Secret, and register your company.
              </span>
            </div>
          </div>
        )}

        {/* Token loading indicator */}
        {tokenStatus === 'loading' && (
          <div className="mb-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            Authenticating with Mercury API...
          </div>
        )}

        {/* Step progress indicator */}
        {!isComplete && (
          <div className="bg-card rounded-xl border border-border p-4 mb-6">
            <div className="flex items-center gap-1 overflow-x-auto">
              {STEPS.map((step, idx) => {
                const isActive = state.currentStep === idx;
                const isCompleted = state.completedSteps.includes(idx);
                const isAccessible = idx === 0 || state.completedSteps.includes(idx - 1) || isCompleted;

                return (
                  <div key={idx} className="flex items-center flex-shrink-0">
                    <button
                      onClick={() => isAccessible ? goToStep(idx) : undefined}
                      disabled={!isAccessible}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isCompleted
                          ? 'bg-success/10 text-success hover:bg-success/20 cursor-pointer'
                          : isAccessible
                          ? 'text-muted-foreground hover:bg-muted cursor-pointer'
                          : 'text-muted-foreground/40 cursor-not-allowed'
                      )}
                    >
                      <span className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                        isActive ? 'bg-primary-foreground text-primary' : isCompleted ? 'bg-success text-white' : 'bg-muted text-muted-foreground'
                      )}>
                        {isCompleted && !isActive ? '✓' : idx + 1}
                      </span>
                      <span className="hidden sm:inline">{step.label}</span>
                      <span className="sm:hidden">{step.short}</span>
                    </button>
                    {idx < STEPS.length - 1 && (
                      <div className={cn(
                        'w-4 h-px mx-1 flex-shrink-0',
                        isCompleted ? 'bg-success' : 'bg-border'
                      )} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step content */}
        <div className="doc-intelligence">
          {renderStep()}
        </div>

        {/* API info footer */}
        {!isComplete && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h3 className="font-medium text-foreground mb-1 text-sm">Mercury Orchestration API</h3>
            <p className="text-xs text-muted-foreground">
              Sandbox:{' '}
              <code className="bg-background px-1.5 py-0.5 rounded text-xs">
                models.mercury.pre-production.eu-west-1.sageai.sagecloudops.com/external
              </code>
              {state.mode === 'mock' && (
                <span className="ml-2 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Mock mode — no real API calls made
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default function DocIntelligence() {
  return (
    <DocIntelligenceProvider>
      <DocIntelligenceInner />
    </DocIntelligenceProvider>
  );
}
