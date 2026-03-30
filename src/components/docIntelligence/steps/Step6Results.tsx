import { useState, useMemo, useRef, useEffect } from 'react';
import { useDocIntelligence } from '@/contexts/DocIntelligenceContext';
import { docDownloadDocument, docSendFeedback } from '@/services/docIntelligenceService';
import type { BasePrediction } from '@/types/docIntelligence';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import React from 'react';

function PdfCanvas({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

        const pdf = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const containerWidth = canvas.parentElement?.clientWidth || 600;
        const baseViewport = page.getViewport({ scale: 1 });
        const dpr = window.devicePixelRatio || 1;
        const scale = (containerWidth / baseViewport.width) * dpr;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: canvas.getContext('2d')!,
          viewport,
          canvas,
        }).promise;
      } catch {
        if (!cancelled) setError(true);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [url]);

  if (error) {
    return (
      <div className="document-viewer__placeholder">
        <div className="document-viewer__placeholder-icon">📄</div>
        <p>Could not render PDF preview</p>
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />;
}

const FieldHoverContext = React.createContext<((coords: Record<string, number[]> | undefined, label: string) => void) | null>(null);

function normalizeCoords(coords: Record<string, number[]> | undefined): { x: number[]; y: number[] } | null {
  if (!coords || typeof coords !== 'object') return null;
  if (Array.isArray(coords.x) && coords.x.length > 0 && Array.isArray(coords.y) && coords.y.length > 0) {
    return { x: coords.x, y: coords.y };
  }
  const xVals: number[] = [];
  const yVals: number[] = [];
  for (const [key, val] of Object.entries(coords)) {
    const num = Array.isArray(val) ? val[0] : (typeof val === 'number' ? val : undefined);
    if (num === undefined || isNaN(num)) continue;
    if (key.startsWith('x')) xVals.push(num);
    else if (key.startsWith('y')) yVals.push(num);
  }
  if (xVals.length >= 2 && yVals.length >= 2) return { x: xVals, y: yVals };
  return null;
}

function hasValidCoords(prediction?: BasePrediction | null): boolean {
  return normalizeCoords(prediction?.coordinates) !== null;
}

function FieldValue({ prediction, label }: { prediction?: BasePrediction | null; label: string }) {
  const onHoverCoords = React.useContext(FieldHoverContext);
  if (!prediction) return null;
  if (!prediction.value && prediction.confidence === 0) return null;
  const hasCoordsData = hasValidCoords(prediction);
  return (
    <div
      className={`field-row${hasCoordsData ? ' field-row--has-coords' : ''}`}
      onMouseEnter={() => hasCoordsData && onHoverCoords?.(prediction.coordinates, label)}
      onMouseLeave={() => onHoverCoords?.(undefined, '')}
    >
      <span className="field-row__label">{label}</span>
      <span className="field-row__value">{prediction.value || '—'}</span>
      {hasCoordsData && <span className="field-row__loc-icon" title="Hover to locate in document">📍</span>}
    </div>
  );
}

interface EditableFieldProps {
  label: string;
  prediction?: BasePrediction | null;
  fieldKey: string;
  edits: Record<string, string>;
  onEdit: (key: string, value: string) => void;
}

function EditableField({ label, prediction, fieldKey, edits, onEdit }: EditableFieldProps) {
  const onHoverCoords = React.useContext(FieldHoverContext);
  if (!prediction) return null;
  if (!prediction.value && prediction.confidence === 0) return null;
  const isEdited = fieldKey in edits && edits[fieldKey] !== (prediction.value || '');
  const currentValue = fieldKey in edits ? edits[fieldKey] : (prediction.value || '');
  return (
    <div
      className={`field-row${isEdited ? ' field-row--changed' : ''}${prediction.coordinates ? ' field-row--has-coords' : ''}`}
      onMouseEnter={() => prediction.coordinates && onHoverCoords?.(prediction.coordinates, label)}
      onMouseLeave={() => onHoverCoords?.(undefined, '')}
    >
      <span className="field-row__label">{label}</span>
      <input
        className="field-row__input"
        value={currentValue}
        onChange={(e) => onEdit(fieldKey, e.target.value)}
      />
      {isEdited && <span style={{ fontSize: '11px', color: 'var(--di-carrot-orange)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>edited</span>}
      {prediction.coordinates && <span className="field-row__loc-icon" title="Hover to locate in document">📍</span>}
    </div>
  );
}

function getPredictionValue(prediction?: BasePrediction | null, suffix = '') {
  if (!prediction?.value) return '—';
  return `${prediction.value}${suffix}`;
}


export default function Step6Results() {
  const { state, dispatch, completeAndAdvance } = useDocIntelligence();
  const [downloading, setDownloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [headerEdits, setHeaderEdits] = useState<Record<string, string>>({});
  const [vendorEdits, setVendorEdits] = useState<Record<string, string>>({});
  const [highlightCoords, setHighlightCoords] = useState<{ coords: Record<string, number[]>; label: string } | null>(null);
  const result = state.results;

  const handleFieldHover = (coords: Record<string, number[]> | undefined, label: string) => {
    const normalized = normalizeCoords(coords);
    if (normalized) {
      setHighlightCoords({ coords: normalized, label });
    } else {
      setHighlightCoords(null);
    }
  };

  const editCount = useMemo(() => {
    if (!result) return 0;
    let count = 0;
    for (const [key, val] of Object.entries(headerEdits)) {
      if (val !== (result.extraction.header[key]?.value || '')) count++;
    }
    for (const [key, val] of Object.entries(vendorEdits)) {
      if (val !== (result.extraction.vendor[key]?.value || '')) count++;
    }
    return count;
  }, [headerEdits, vendorEdits, result]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await docDownloadDocument(
        state.workflow,
        { customer_unique_id: state.customerUniqueId!, orchestration_id: state.orchestrationId! },
        state.accessToken!,
        state.mode
      );
      dispatch({ type: 'SET_DOWNLOAD_URL', payload: res.download_url });
      if (state.mode === 'live' && res.download_url) {
        window.open(res.download_url, '_blank');
      }
    } catch {
      // non-critical
    } finally {
      setDownloading(false);
    }
  };

  const buildFeedbackValues = () => {
    if (!result) return { header: {}, vendor: {}, recipient: {}, line_items: [], payment: {}, tax_table: [] };
    const { extraction: ext } = result;

    const headerFeedback: Record<string, string | null> = {};
    for (const [key, pred] of Object.entries(ext.header)) {
      headerFeedback[key] = key in headerEdits ? headerEdits[key] : (pred as BasePrediction).value;
    }
    const vendorFeedback: Record<string, string | null> = {};
    for (const [key, pred] of Object.entries(ext.vendor)) {
      vendorFeedback[key] = key in vendorEdits ? vendorEdits[key] : (pred as BasePrediction).value;
    }
    const recipientFeedback: Record<string, string | null> = {};
    for (const [key, pred] of Object.entries(ext.recipient)) {
      recipientFeedback[key] = (pred as BasePrediction).value;
    }
    const lineItemsFeedback = ext.line_items.map((item) => {
      const li: Record<string, string | null> = {};
      for (const [key, pred] of Object.entries(item)) li[key] = (pred as BasePrediction).value;
      return li;
    });
    const paymentFeedback: Record<string, string | null> = {};
    for (const [key, pred] of Object.entries(ext.payment)) {
      paymentFeedback[key] = (pred as BasePrediction).value;
    }
    const taxTableFeedback = ext.tax_table.map((row) => {
      const tr: Record<string, string | null> = {};
      for (const [key, pred] of Object.entries(row)) tr[key] = (pred as BasePrediction).value;
      return tr;
    });
    const expenseCategoryFeedback = result.expense_category?.map((cat) => ({
      category_id: cat.category_id.value,
      description: cat.description.value,
    }));

    return {
      header: headerFeedback, vendor: vendorFeedback, recipient: recipientFeedback,
      line_items: lineItemsFeedback, payment: paymentFeedback, tax_table: taxTableFeedback,
      ...(expenseCategoryFeedback ? { expense_category: expenseCategoryFeedback } : {}),
    };
  };

  const handleSubmitFeedback = async () => {
    if (!result) return;
    setSubmitting(true);
    try {
      await docSendFeedback(
        state.workflow,
        {
          customer_unique_id: state.customerUniqueId!,
          feedback: [{ orchestration_id: result.metadata.orchestration_id, extraction: buildFeedbackValues() }],
        },
        state.accessToken!,
        state.mode
      );
      dispatch({ type: 'SET_FEEDBACK_SENT', payload: true });
      completeAndAdvance(3);
    } catch {
      dispatch({ type: 'SET_FEEDBACK_SENT', payload: true });
      completeAndAdvance(3);
    } finally {
      setSubmitting(false);
    }
  };

  const renderDocumentPreview = () => {
    const previewUrl = state.documentPreviewUrl;
    const fileType = state.documentFileType;

    if (previewUrl && previewUrl.length > 0) {
      const isImage = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'tiff', 'tif'].includes(fileType || '');
      const isPdf = fileType === 'pdf';

      if (isImage) return <img src={previewUrl} alt="Uploaded document" style={{ width: '100%', display: 'block' }} />;
      if (isPdf) return <PdfCanvas url={previewUrl} />;
      return (
        <div className="document-viewer__placeholder">
          <div className="document-viewer__placeholder-icon">📄</div>
          <p>Preview not available for .{fileType} files</p>
        </div>
      );
    }

    return (
      <div className="document-viewer__placeholder">
        <div className="document-viewer__placeholder-icon">
          {state.workflow === 'employee_expense' ? '🧾' : '📄'}
        </div>
        <p><strong>Sample {state.workflow === 'employee_expense' ? 'Receipt' : 'Invoice'}</strong></p>
        <p style={{ fontSize: '12px', marginTop: '8px' }}>
          {state.workflow === 'employee_expense'
            ? 'The Sage Garden Restaurant — Business lunch receipt'
            : 'Acme Office Supplies — Multi-line equipment invoice'}
        </p>
        <p style={{ fontSize: '11px', color: 'var(--di-text-secondary)', marginTop: '16px' }}>
          Upload your own document in Step 4 to see it previewed here
        </p>
      </div>
    );
  };

  if (!result) {
    return (
      <div>
        <div className="di-step-header">
          <div className="di-step-badge">Step 4 of 4</div>
          <h2 className="di-step-title">Review & Confirm</h2>
        </div>
        <div className="card">
          <p className="di-text-muted">No results available. Please complete the previous steps first.</p>
        </div>
      </div>
    );
  }

  const { extraction, metadata, expense_category } = result;
  const { header, vendor, recipient, line_items, payment, tax_table } = extraction;
  const isExpense = state.workflow === 'employee_expense';
  const lineItems = Array.isArray(line_items) ? line_items : [];
  const taxTable = Array.isArray(tax_table) ? tax_table : [];
  const expenseCategories = Array.isArray(expense_category) ? expense_category : [];

  return (
    <div>
      <div className="di-step-header">
        <div className="di-step-badge">Step 4 of 4</div>
        <h2 className="di-step-title">Review & Confirm</h2>
        <p className="di-step-desc">
          The AI model has extracted and structured the following data from your {isExpense ? 'receipt' : 'invoice'}.
          Review each field and <strong>edit any incorrect values</strong> directly.
          When done, submit to send feedback and improve the model.
        </p>
      </div>

      <div className="callout callout--info di-mb-lg">
        <span className="callout__icon">🔄</span>
        <div>
          <strong>Inline editing:</strong> Click any header or vendor field to correct it.
          All values — including unchanged ones — are sent as feedback to improve accuracy.
          {editCount > 0 && (
            <span style={{ marginLeft: '8px' }} className="confidence-badge confidence-badge--medium">
              {editCount} field{editCount !== 1 ? 's' : ''} edited
            </span>
          )}
        </div>
      </div>

      <FieldHoverContext.Provider value={handleFieldHover}>
        <div className="results-layout">
          {/* Left: Extraction Results */}
          <div className="results-layout__results">

            <div className="card di-mb-lg">
              <div className="card__header">
                <h3 className="card__title">📋 Document Metadata</h3>
                <span className="card__icon card__icon--green">
                  {metadata.is_einvoice ? '📧' : metadata.is_receipt ? '🧾' : '📄'}
                </span>
              </div>
              <div className="form-row">
                <div>
                  <div className="field-row">
                    <span className="field-row__label">Orchestration ID</span>
                    <span className="field-row__value di-font-mono di-text-sm">{metadata.orchestration_id}</span>
                  </div>
                  <div className="field-row">
                    <span className="field-row__label">Origin</span>
                    <span className="field-row__value">{metadata.request_origin}</span>
                  </div>
                </div>
                <div>
                  <div className="field-row">
                    <span className="field-row__label">File Name</span>
                    <span className="field-row__value">{metadata.file_name || '—'}</span>
                  </div>
                  <div className="field-row">
                    <span className="field-row__label">Type</span>
                    <span className="field-row__value">
                      {metadata.is_einvoice ? 'e-Invoice' : metadata.is_receipt ? 'Receipt' : 'Document'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card di-mb-lg">
              <div className="card__header">
                <h3 className="card__title">📝 Invoice Header</h3>
                <span className="di-text-sm di-text-muted">Click to edit</span>
              </div>
              <EditableField label="Document ID" prediction={header.document_id} fieldKey="document_id" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
              <EditableField label="Type" prediction={header.document_type} fieldKey="document_type" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
              <EditableField label="Invoice Type" prediction={header.invoice_type} fieldKey="invoice_type" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
              <EditableField label="Issue Date" prediction={header.issue_date} fieldKey="issue_date" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
              <EditableField label="Due Date" prediction={header.due_date} fieldKey="due_date" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
              <EditableField label="Currency" prediction={header.currency} fieldKey="currency" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
              <EditableField label="PO Number" prediction={header.po_number} fieldKey="po_number" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
              <EditableField label="Reference" prediction={header.reference_number} fieldKey="reference_number" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
              <FieldValue prediction={header.document_language} label="Language" />

              <div style={{ borderTop: '1px solid var(--di-gray-200)', marginTop: '16px', paddingTop: '16px' }}>
                <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>💰 Amounts</h4>
                <EditableField label="Total Amount" prediction={header.total_amount} fieldKey="total_amount" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
                <EditableField label="Subtotal (ex. tax)" prediction={header.total_without_tax} fieldKey="total_without_tax" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
                <EditableField label="Tax Amount" prediction={header.tax_amount} fieldKey="tax_amount" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
                <EditableField label="Discount" prediction={header.discount_amount} fieldKey="discount_amount" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
                <EditableField label="Shipping" prediction={header.shipping_amount} fieldKey="shipping_amount" edits={headerEdits} onEdit={(k, v) => setHeaderEdits({ ...headerEdits, [k]: v })} />
              </div>

              <div style={{ borderTop: '1px solid var(--di-gray-200)', marginTop: '16px', paddingTop: '16px' }}>
                <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>💳 Payment</h4>
                <FieldValue prediction={payment.payable_amount} label="Payable Amount" />
                <FieldValue prediction={payment.payment_method} label="Method" />
                <FieldValue prediction={payment.payment_term} label="Term" />
                <FieldValue prediction={payment.payment_term_string} label="Term Details" />
              </div>
            </div>

            <div className="card di-mb-lg">
              <div className="card__header">
                <h3 className="card__title">🏢 Vendor</h3>
                <span className="di-text-sm di-text-muted">Click to edit</span>
              </div>
              <EditableField label="Name" prediction={vendor.name} fieldKey="name" edits={vendorEdits} onEdit={(k, v) => setVendorEdits({ ...vendorEdits, [k]: v })} />
              <EditableField label="Address" prediction={vendor.address} fieldKey="address" edits={vendorEdits} onEdit={(k, v) => setVendorEdits({ ...vendorEdits, [k]: v })} />
              <EditableField label="Country" prediction={vendor.country} fieldKey="country" edits={vendorEdits} onEdit={(k, v) => setVendorEdits({ ...vendorEdits, [k]: v })} />
              <EditableField label="Email" prediction={vendor.email} fieldKey="email" edits={vendorEdits} onEdit={(k, v) => setVendorEdits({ ...vendorEdits, [k]: v })} />
              <EditableField label="Tax ID" prediction={vendor.tax_id} fieldKey="tax_id" edits={vendorEdits} onEdit={(k, v) => setVendorEdits({ ...vendorEdits, [k]: v })} />
              <EditableField label="IBAN" prediction={vendor.iban} fieldKey="iban" edits={vendorEdits} onEdit={(k, v) => setVendorEdits({ ...vendorEdits, [k]: v })} />
              <EditableField label="BIC" prediction={vendor.bic} fieldKey="bic" edits={vendorEdits} onEdit={(k, v) => setVendorEdits({ ...vendorEdits, [k]: v })} />
              <EditableField label="Website" prediction={vendor.website} fieldKey="website" edits={vendorEdits} onEdit={(k, v) => setVendorEdits({ ...vendorEdits, [k]: v })} />
              <EditableField label="Phone" prediction={vendor.vendor_phone_number} fieldKey="vendor_phone_number" edits={vendorEdits} onEdit={(k, v) => setVendorEdits({ ...vendorEdits, [k]: v })} />
              <EditableField label="Company Reg." prediction={vendor.company_id} fieldKey="company_id" edits={vendorEdits} onEdit={(k, v) => setVendorEdits({ ...vendorEdits, [k]: v })} />
            </div>

            <div className="card di-mb-lg">
              <div className="card__header">
                <h3 className="card__title">🏠 Recipient</h3>
              </div>
              <FieldValue prediction={recipient.name} label="Name" />
              <FieldValue prediction={recipient.address} label="Address" />
              <FieldValue prediction={recipient.country} label="Country" />

              {isExpense && expenseCategories.length > 0 && (
                <div style={{ borderTop: '1px solid var(--di-gray-200)', marginTop: '16px', paddingTop: '16px' }}>
                  <h4 style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>🏷️ Expense Category</h4>
                  {expenseCategories.map((cat, i) => (
                    <div key={i}>
                      <FieldValue prediction={cat.category_id} label="Category" />
                      <FieldValue prediction={cat.description} label="Description" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card di-mb-lg">
              <div className="card__header">
                <h3 className="card__title">📦 Line Items ({lineItems.length})</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Description</th><th>Qty</th><th>Unit Price</th>
                      <th>Tax %</th><th>Tax</th><th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td>{getPredictionValue(item.line_id)}</td>
                        <td>{getPredictionValue(item.description)}</td>
                        <td>{getPredictionValue(item.quantity)}</td>
                        <td>{getPredictionValue(item.unit_price)}</td>
                        <td>{getPredictionValue(item.tax_percentage, item.tax_percentage?.value ? '%' : '')}</td>
                        <td>{getPredictionValue(item.tax_amount)}</td>
                        <td><strong>{getPredictionValue(item.total_amount)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {taxTable.length > 0 && (
              <div className="card di-mb-lg">
                <div className="card__header">
                  <h3 className="card__title">🧮 Tax Summary</h3>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Description</th><th>Rate</th><th>Taxable Amount</th><th>Tax</th><th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxTable.map((row, idx) => (
                      <tr key={idx}>
                        <td>{getPredictionValue(row.description)}</td>
                        <td>{getPredictionValue(row.tax_percentage, row.tax_percentage?.value ? '%' : '')}</td>
                        <td>{getPredictionValue(row.taxable_amount)}</td>
                        <td>{getPredictionValue(row.tax)}</td>
                        <td><strong>{getPredictionValue(row.total_amount)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

          {/* Right: Document Viewer */}
          <div className="results-layout__document">
            <div className="document-viewer">
              <div className="document-viewer__header">
                <div className="document-viewer__title">
                  <span>{isExpense ? '🧾' : '📄'}</span>
                  Original Document
                </div>
                <div className="document-viewer__actions">
                  <button className="btn btn--secondary btn--sm" onClick={handleDownload} disabled={downloading}>
                    {downloading ? '⏳' : '⬇️'} {downloading ? 'Requesting...' : 'Download'}
                  </button>
                </div>
              </div>

              <div className="document-viewer__preview">
                <div className="document-viewer__page">
                  {renderDocumentPreview()}
                  {highlightCoords && (
                    <div
                      className="document-highlight"
                      style={{
                        left: `${Math.min(...highlightCoords.coords.x) * 100}%`,
                        top: `${Math.min(...highlightCoords.coords.y) * 100}%`,
                        width: `${(Math.max(...highlightCoords.coords.x) - Math.min(...highlightCoords.coords.x)) * 100}%`,
                        height: `${(Math.max(...highlightCoords.coords.y) - Math.min(...highlightCoords.coords.y)) * 100}%`,
                      }}
                    >
                      <span className="document-highlight__label">{highlightCoords.label}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="document-viewer__info">
                <span>{metadata.file_name || 'Document'}</span>
                <span className="document-viewer__endpoint">POST /v2/workflow/.../download</span>
              </div>

              {state.downloadUrl && (
                <div style={{ padding: '8px 16px', background: 'var(--di-green-50)', borderTop: '1px solid var(--di-gray-200)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--di-text-secondary)', marginBottom: '4px' }}>
                    Presigned URL (valid 1 hour):
                  </div>
                  <code style={{ fontSize: '11px', wordBreak: 'break-all', color: 'var(--di-green-dark)' }}>
                    {state.downloadUrl.substring(0, 80)}...
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>
      </FieldHoverContext.Provider>

      <button
        className="btn btn--primary btn--lg btn--full"
        onClick={handleSubmitFeedback}
        disabled={submitting}
        style={{ marginTop: '24px' }}
      >
        {submitting ? '⏳ Submitting Feedback...' : `📤 Submit Feedback & Complete${editCount > 0 ? ` (${editCount} corrections)` : ''}`}
      </button>
    </div>
  );
}
