import { useDocIntelligence } from '@/contexts/DocIntelligenceContext';

const JOURNEY_STEPS = [
  { icon: '🔐', title: 'Admin Setup', endpoint: 'POST /oauth/token · POST /v2/company/create · POST /v2/workflow/.../defaults', desc: 'Configured credentials, registered company, and set workflow defaults in Admin Settings' },
  { icon: '📤', title: '1. Upload Document', endpoint: 'POST /v2/workflow/.../run', desc: 'Submitted a document and received orchestration_id' },
  { icon: '⏳', title: '2. Check Status', endpoint: 'POST /v2/workflow/.../status', desc: 'Polled until extraction completed' },
  { icon: '📊', title: '3. Review & Confirm', endpoint: 'POST /v2/workflow/.../results + .../feedback', desc: 'Reviewed extraction data, edited corrections inline, and submitted feedback' },
  { icon: '⬇️', title: '3b. Download Original', endpoint: 'POST /v2/workflow/.../download', desc: 'Obtained presigned URL to download the original document' },
];

export default function StepComplete() {
  const { state, dispatch } = useDocIntelligence();

  return (
    <div>
      <div className="journey-complete">
        <div className="journey-complete__icon">🎉</div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Integration Journey Complete</h2>
        <p className="di-text-muted" style={{ maxWidth: '500px', margin: '8px auto 0' }}>
          You've completed the full {state.workflow === 'accounts_payable' ? 'Accounts Payable' : 'Employee Expense'} integration
          walkthrough with Sage AI Document Intelligence.
        </p>
      </div>

      <div className="card di-mb-lg">
        <div className="card__header">
          <h3 className="card__title">📋 Journey Summary</h3>
        </div>
        <div className="journey-complete__steps">
          {JOURNEY_STEPS.map((step, idx) => (
            <div key={idx} className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{step.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{step.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--di-text-secondary)', marginBottom: '8px' }}>{step.desc}</div>
              <code style={{ fontSize: '11px' }}>{step.endpoint}</code>
            </div>
          ))}
        </div>
      </div>

      <div className="card di-mb-lg">
        <div className="card__header">
          <h3 className="card__title">🔑 Session Data</h3>
        </div>
        <div className="field-row">
          <span className="field-row__label">Mode</span>
          <span className="field-row__value">{state.mode === 'mock' ? '🧪 Mock' : '🔴 Live Sandbox'}</span>
        </div>
        <div className="field-row">
          <span className="field-row__label">Workflow</span>
          <span className="field-row__value">{state.workflow === 'accounts_payable' ? 'Accounts Payable' : 'Employee Expense'}</span>
        </div>
        <div className="field-row">
          <span className="field-row__label">customer_unique_id</span>
          <span className="field-row__value di-font-mono di-text-sm">{state.customerUniqueId}</span>
        </div>
        <div className="field-row">
          <span className="field-row__label">orchestration_id</span>
          <span className="field-row__value di-font-mono di-text-sm">{state.orchestrationId}</span>
        </div>
        <div className="field-row">
          <span className="field-row__label">Feedback Sent</span>
          <span className="field-row__value">{state.feedbackSent ? '✅ Yes' : '❌ No'}</span>
        </div>
      </div>

      <div className="callout callout--success di-mb-lg">
        <span className="callout__icon">🚀</span>
        <div>
          <strong>Ready to integrate?</strong><br />
          Contact <a href="mailto:contactsageai@sage.com" style={{ color: 'var(--di-green-dark)' }}>contactsageai@sage.com</a> to
          get started with your product integration.
        </div>
      </div>

      <button className="btn btn--primary btn--lg btn--full" onClick={() => dispatch({ type: 'RESET' })}>
        🔁 Start Again
      </button>
    </div>
  );
}
