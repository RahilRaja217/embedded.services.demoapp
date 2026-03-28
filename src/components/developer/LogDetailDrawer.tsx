/**
 * Log Detail Drawer Component
 * 
 * Displays full details of a single API log entry in a drawer/sheet.
 */

import { X, Copy, Check, Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiLogEntry } from '@/lib/logger';
import { generateCurl } from '@/lib/maskSecrets';
import { cn } from '@/lib/utils';

interface LogDetailDrawerProps {
  log: ApiLogEntry | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LogDetailDrawer({ log, isOpen, onClose }: LogDetailDrawerProps) {
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  if (!isOpen || !log) return null;

  const handleCopyCurl = () => {
    const curl = generateCurl(
      log.method,
      log.url,
      log.requestHeaders,
      log.requestBody
    );
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleExportSingle = () => {
    const data = JSON.stringify(log, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-log-${log.requestId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: number) => {
    if (status === 0) return 'text-warning';
    if (status >= 200 && status < 300) return 'text-success';
    if (status >= 400) return 'text-destructive';
    return 'text-foreground';
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-background border-l border-border overflow-y-auto animate-in slide-in-from-right">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">API Call Details</h2>
            <p className="text-xs text-muted-foreground font-mono">{log.requestId}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Timestamp</label>
              <p className="text-sm font-medium">
                {new Date(log.timestamp).toLocaleString()}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Duration</label>
              <p className="text-sm font-medium">{log.durationMs}ms</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <p className={cn("text-sm font-medium", getStatusColor(log.status))}>
                {log.status} {log.statusText}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Feature</label>
              <p className="text-sm font-medium capitalize">{log.featureArea}</p>
            </div>
            {log.tenantId && (
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Tenant ID</label>
                <p className="text-sm font-mono">{log.tenantId}</p>
              </div>
            )}
          </div>

          {/* Error */}
          {log.error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <label className="text-xs font-medium text-destructive">Error</label>
              <p className="text-sm text-destructive mt-1">{log.error}</p>
            </div>
          )}

          {/* Request */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Request</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                  {log.method}
                </span>
                <code className="text-xs text-foreground break-all flex-1">
                  {log.url}
                </code>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Headers</label>
                <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-48 font-mono">
                  {JSON.stringify(log.requestHeaders, null, 2)}
                </pre>
              </div>
              
              {log.requestBody && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Body</label>
                  <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-64 font-mono">
                    {log.requestBody}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Response */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Response</h3>
            <div className="space-y-3">
              {Object.keys(log.responseHeaders).length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Headers</label>
                  <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-32 font-mono">
                    {JSON.stringify(log.responseHeaders, null, 2)}
                  </pre>
                </div>
              )}
              
              {log.responseBody && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Body</label>
                  <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-96 font-mono">
                    {log.responseBody}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-4 border-t border-border">
            <Button variant="outline" size="sm" onClick={handleCopyCurl}>
              {copiedCurl ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy as cURL
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyJson}>
              {copiedJson ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy JSON
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportSingle}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
