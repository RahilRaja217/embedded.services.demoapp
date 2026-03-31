import { useState, useRef } from 'react';
import { useDocIntelligence } from '@/contexts/DocIntelligenceContext';
import { docUploadDocument } from '@/services/docIntelligenceService';

const SAMPLE_DOCS = [
  {
    id: 'invoice',
    name: 'Sample Invoice — Acme Office Supplies',
    type: 'invoice',
    ext: 'pdf',
    icon: '📄',
    desc: 'Multi-line office equipment invoice (GBP)',
  },
  {
    id: 'receipt',
    name: 'Sample Receipt — Restaurant',
    type: 'receipt',
    ext: 'jpg',
    icon: '🧾',
    desc: 'Business lunch receipt with service charge',
  },
];

const SAMPLE_BASE64 = 'JVBERi0xLjcKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2Jq...';

export default function Step4Upload() {
  const { state, dispatch, completeAndAdvance } = useDocIntelligence();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleFileChange = (file: File) => {
    setUploadedFile(file);
    setSelectedSample(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleUpload = async () => {
    setLoading(true);
    setError(null);

    try {
      let inputData = SAMPLE_BASE64;
      let ext = 'pdf';
      let fileName = 'sample_document.pdf';

      if (uploadedFile) {
        const buffer = await uploadedFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
        }
        inputData = btoa(binary);
        ext = uploadedFile.name.split('.').pop()?.toLowerCase() || 'pdf';
        fileName = uploadedFile.name;
      } else if (selectedSample) {
        const sample = SAMPLE_DOCS.find((s) => s.id === selectedSample);
        if (sample) {
          ext = sample.ext;
          fileName = `${sample.name}.${sample.ext}`;
        }
      }

      const res = await docUploadDocument(
        state.workflow,
        {
          input_data: inputData,
          customer_unique_id: state.customerUniqueId!,
          metadata: { file_extension: ext, file_name: fileName },
        },
        state.accessToken!,
        state.mode
      );

      if (uploadedFile) {
        const blobUrl = URL.createObjectURL(uploadedFile);
        dispatch({ type: 'SET_DOCUMENT_PREVIEW', payload: { url: blobUrl, fileType: ext } });
      } else {
        dispatch({ type: 'SET_DOCUMENT_PREVIEW', payload: { url: '', fileType: ext } });
      }

      dispatch({ type: 'SET_ORCHESTRATION_ID', payload: res.orchestration_id });
      completeAndAdvance(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const hasSelection = selectedSample || uploadedFile;

  return (
    <div>
      <div className="di-step-header">
        <div className="di-step-badge">Step 1 of 3</div>
        <h2 className="di-step-title">Upload Document</h2>
        <p className="di-step-desc">
          Upload an invoice or financial document for AI-powered extraction.
          The file is sent as a base64-encoded string.
        </p>
      </div>

      <div className="card di-mb-lg">
        <div className="card__header">
          <h3 className="card__title">📤 Upload a File</h3>
        </div>

        <div
          className={`upload-zone${dragOver ? ' drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-zone__icon">📎</div>
          <div className="upload-zone__text">Drop a file here, or click to browse</div>
          <div className="upload-zone__hint">Supported: PDF, PNG, JPG, TIFF, HEIC/HEIF, XML (e-Invoice)</div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.heic,.heif,.xml"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileChange(file);
          }}
        />

        {uploadedFile && (
          <div className="file-preview di-mt-md">
            <span className="file-preview__icon">📄</span>
            <div className="file-preview__info">
              <div className="file-preview__name">{uploadedFile.name}</div>
              <div className="file-preview__size">{(uploadedFile.size / 1024).toFixed(1)} KB</div>
            </div>
            <button className="btn btn--ghost" onClick={() => setUploadedFile(null)}>✕</button>
          </div>
        )}
      </div>

      <div className="card di-mb-lg">
        <div className="card__header">
          <h3 className="card__title">📁 Or Use a Sample Document</h3>
        </div>

        <div className="sample-docs">
          {SAMPLE_DOCS.map((doc) => (
            <div
              key={doc.id}
              className={`sample-doc${selectedSample === doc.id ? ' selected' : ''}`}
              onClick={() => { setSelectedSample(doc.id); setUploadedFile(null); }}
            >
              <span style={{ fontSize: '1.4rem' }}>{doc.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{doc.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--di-text-secondary)' }}>{doc.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="callout callout--warning">
          <span className="callout__icon">⚠️</span>
          <div>{error}</div>
        </div>
      )}

      <button
        className="btn btn--primary btn--lg btn--full"
        onClick={handleUpload}
        disabled={loading || !hasSelection}
      >
        {loading ? '⏳ Uploading & Starting Extraction...' : '🚀 Upload & Process'}
      </button>

      {state.orchestrationId && (
        <div className="callout callout--success di-mt-md">
          <span className="callout__icon">✅</span>
          <div>
            <strong>Document submitted</strong><br />
            <code>orchestration_id: {state.orchestrationId}</code>
          </div>
        </div>
      )}
    </div>
  );
}
