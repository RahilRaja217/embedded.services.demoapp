import { useEffect, useState, useRef } from 'react';
import { useDocIntelligence } from '@/contexts/DocIntelligenceContext';
import { docCheckStatus, resetDocStatusPoll, docGetResults } from '@/services/docIntelligenceService';

export default function Step5Status() {
  const { state, dispatch, completeAndAdvance } = useDocIntelligence();
  const [polling, setPolling] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const [pollError, setPollError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout>>();
  const hasStarted = useRef(false);
  const MAX_POLLS = 30;

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    resetDocStatusPoll();
    pollStatus();

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const pollStatus = async () => {
    try {
      setPollCount((c) => {
        if (c >= MAX_POLLS) {
          setPolling(false);
          setPollError('Maximum poll attempts reached. The document may still be processing.');
          return c;
        }
        return c + 1;
      });

      const results = await docCheckStatus(
        state.workflow,
        {
          customer_unique_id: state.customerUniqueId!,
          orchestration_ids: [state.orchestrationId!],
        },
        state.accessToken!,
        state.mode
      );

      const docStatus = results[0];
      dispatch({ type: 'SET_STATUS', payload: docStatus.status });

      if (docStatus.status === 'completed') {
        setPolling(false);
        const extractionResults = await docGetResults(
          state.workflow,
          {
            customer_unique_id: state.customerUniqueId!,
            orchestration_ids: [state.orchestrationId!],
          },
          state.accessToken!,
          state.mode
        );
        if (extractionResults.length > 0) {
          dispatch({ type: 'SET_RESULTS', payload: extractionResults[0] });
        }
        completeAndAdvance(1);
      } else if (docStatus.status === 'error') {
        setPolling(false);
      } else {
        pollRef.current = setTimeout(pollStatus, 2000);
      }
    } catch {
      setPolling(false);
    }
  };

  return (
    <div>
      <div className="di-step-header">
        <div className="di-step-badge">Step 2 of 3</div>
        <h2 className="di-step-title">Processing Status</h2>
        <p className="di-step-desc">
          Polling the <code>/status</code> endpoint to check if the document extraction is complete.
          Rate limit: 5 requests/sec per company.
        </p>
      </div>

      <div className="card">
        <div className="status-indicator">
          {polling ? (
            <>
              <div className="status-indicator__spinner" />
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Processing Document...</h3>
              <p className="di-text-muted di-mt-sm">
                Our AI models are extracting data from your document.<br />
                This typically takes a few seconds.
              </p>
              <div className="di-mt-md di-text-sm di-font-mono" style={{ color: 'var(--di-text-secondary)' }}>
                Poll #{pollCount} — Status: <strong>{state.status || 'polling...'}</strong>
              </div>
            </>
          ) : state.status === 'completed' ? (
            <>
              <div className="status-indicator__check">✓</div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Extraction Complete</h3>
              <p className="di-text-muted di-mt-sm">Document has been processed successfully. Results are ready.</p>
              <div className="di-mt-md di-text-sm di-font-mono" style={{ color: 'var(--di-text-secondary)' }}>
                Polled {pollCount} time{pollCount !== 1 ? 's' : ''}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❌</div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Processing Error</h3>
              <p className="di-text-muted di-mt-sm">
                {pollError || 'There was an error processing your document.'}
              </p>
            </>
          )}
        </div>

        <div className="callout callout--info di-mt-lg">
          <span className="callout__icon">💡</span>
          <div>
            <strong>Tip:</strong> Instead of polling, you can configure <strong>webhooks</strong> to
            receive a notification when processing completes. See the{' '}
            <code>/notifications</code> documentation.
          </div>
        </div>
      </div>
    </div>
  );
}
