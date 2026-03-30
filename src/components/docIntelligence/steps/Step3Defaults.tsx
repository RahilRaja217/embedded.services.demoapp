import { useState } from 'react';
import { useDocIntelligence } from '@/contexts/DocIntelligenceContext';
import { docSetDefaults } from '@/services/docIntelligenceService';

export default function Step3Defaults() {
  const { state, completeAndAdvance } = useDocIntelligence();
  const [loading, setLoading] = useState(false);
  const [checkDuplicates, setCheckDuplicates] = useState(true);
  const [vmsActive, setVmsActive] = useState(false);
  const [splitExtract, setSplitExtract] = useState(false);
  const [einvoiceOnly, setEinvoiceOnly] = useState(false);

  const isAP = state.workflow === 'accounts_payable';

  const handleSaveDefaults = async () => {
    setLoading(true);
    try {
      const defaults = isAP
        ? {
            check_duplicates: checkDuplicates,
            split_extract: splitExtract,
            vms: { active: vmsActive },
            extraction: { einvoice_only: einvoiceOnly },
          }
        : { check_duplicates: checkDuplicates };

      await docSetDefaults(
        state.workflow,
        { customer_unique_id: state.customerUniqueId!, new_defaults: defaults },
        state.accessToken!,
        state.mode
      );
      completeAndAdvance(0);
    } catch {
      completeAndAdvance(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="di-step-header">
        <div className="di-step-badge">Step 1 of 4 — Optional</div>
        <h2 className="di-step-title">Configure Defaults</h2>
        <p className="di-step-desc">
          Set default extraction settings for the{' '}
          <strong>{isAP ? 'Accounts Payable' : 'Employee Expense'}</strong> workflow.
          These apply to all document uploads for this company unless overridden per-request.
        </p>
      </div>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">⚙️ Workflow Defaults</h3>
        </div>

        <div className="toggle-group">
          <div className="toggle-group__text">
            <div className="toggle-group__label">Check Duplicates</div>
            <div className="toggle-group__desc">Prevent the same document from being uploaded twice (content hash-based)</div>
          </div>
          <button
            className={`toggle-switch${checkDuplicates ? ' active' : ''}`}
            onClick={() => setCheckDuplicates(!checkDuplicates)}
          />
        </div>

        {isAP && (
          <>
            <div className="toggle-group">
              <div className="toggle-group__text">
                <div className="toggle-group__label">Vendor Matching Service (VMS)</div>
                <div className="toggle-group__desc">Auto-match vendors from your synced vendor directory</div>
              </div>
              <button
                className={`toggle-switch${vmsActive ? ' active' : ''}`}
                onClick={() => setVmsActive(!vmsActive)}
              />
            </div>

            <div className="toggle-group">
              <div className="toggle-group__text">
                <div className="toggle-group__label">Split & Extract</div>
                <div className="toggle-group__desc">Automatically extract individual documents from multi-page uploads</div>
              </div>
              <button
                className={`toggle-switch${splitExtract ? ' active' : ''}`}
                onClick={() => setSplitExtract(!splitExtract)}
              />
            </div>

            <div className="toggle-group">
              <div className="toggle-group__text">
                <div className="toggle-group__label">e-Invoice Only Mode</div>
                <div className="toggle-group__desc">Only accept and map e-Invoices (XML/ZUGFeRD) — no OCR processing</div>
              </div>
              <button
                className={`toggle-switch${einvoiceOnly ? ' active' : ''}`}
                onClick={() => setEinvoiceOnly(!einvoiceOnly)}
              />
            </div>
          </>
        )}

        <div className="callout callout--info di-mt-lg">
          <span className="callout__icon">💡</span>
          <div>
            These defaults can be overridden per-upload via the <code>override_parameters</code> object in the <code>/run</code> request.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
          <button
            className="btn btn--primary btn--lg"
            onClick={handleSaveDefaults}
            disabled={loading}
            style={{ flex: 1 }}
          >
            {loading ? '⏳ Saving...' : '💾 Save Defaults'}
          </button>
          <button
            className="btn btn--secondary btn--lg"
            onClick={() => completeAndAdvance(0)}
            style={{ flex: 1 }}
          >
            Skip — Use Defaults →
          </button>
        </div>
      </div>
    </div>
  );
}
