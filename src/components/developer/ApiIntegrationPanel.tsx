/**
 * API Integration Panel Component
 * 
 * Collapsible panel showing the most recent API call details.
 * Only visible when Developer Mode is ON.
 * 
 * Features:
 * - Request method, URL, headers, body
 * - Response status, headers, body
 * - Copy as cURL button
 * - All secrets redacted
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeveloperMode } from '@/contexts/DeveloperModeContext';
import { FeatureArea } from '@/lib/apiClient';
import { generateCurl } from '@/lib/maskSecrets';
import { cn } from '@/lib/utils';

interface ApiIntegrationPanelProps {
  featureArea: FeatureArea;
  className?: string;
}

export function ApiIntegrationPanel({ featureArea, className }: ApiIntegrationPanelProps) {
  const { isDeveloperMode, getLatestApiCall, latestCallTimestamp } = useDeveloperMode();
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Re-render when latestCallTimestamp changes
  const latestCall = getLatestApiCall(featureArea);

  if (!isDeveloperMode) {
    return null;
  }

  const handleCopyCurl = () => {
    if (!latestCall) return;
    
    const curl = generateCurl(
      latestCall.method,
      latestCall.url,
      latestCall.requestHeaders,
      latestCall.requestBody
    );
    
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleCopyJson = () => {
    if (!latestCall) return;
    
    navigator.clipboard.writeText(JSON.stringify(latestCall, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const getStatusColor = (status: number) => {
    if (status === 0) return 'text-warning';
    if (status >= 200 && status < 300) return 'text-success';
    if (status >= 400) return 'text-destructive';
    return 'text-foreground';
  };

  return (
    <div className={cn("mt-6 border border-border rounded-lg bg-muted/30", className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-foreground">API Integration</span>
          {latestCall && (
            <span className={cn(
              "text-xs font-mono px-2 py-0.5 rounded",
              getStatusColor(latestCall.status),
              latestCall.status >= 200 && latestCall.status < 300 ? "bg-success/10" :
              latestCall.status >= 400 ? "bg-destructive/10" :
              latestCall.status === 0 ? "bg-warning/10" : "bg-muted"
            )}>
              {latestCall.status === 0 ? 'ERROR' : latestCall.status} {latestCall.statusText}
            </span>
          )}
        </div>
        {latestCall && (
          <span className="text-xs text-muted-foreground">
            {latestCall.durationMs}ms
          </span>
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4">
          {!latestCall ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No API calls recorded yet for this feature.
            </p>
          ) : (
            <>
              {/* Error Banner */}
              {latestCall.error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Error</p>
                    <p className="text-xs text-destructive/80 mt-1">{latestCall.error}</p>
                  </div>
                </div>
              )}

              {/* Request Info */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Request
                </h4>
                <div className="bg-background rounded border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded">
                      {latestCall.method}
                    </span>
                    <code className="text-xs text-foreground break-all">{latestCall.url}</code>
                  </div>
                  
                  {/* Request Headers */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Headers
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(latestCall.requestHeaders, null, 2)}
                    </pre>
                  </details>
                  
                  {/* Request Body */}
                  {latestCall.requestBody && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Body
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-48">
                        {latestCall.requestBody}
                      </pre>
                    </details>
                  )}
                </div>
              </div>

              {/* Response Info */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Response
                </h4>
                <div className="bg-background rounded border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded",
                      getStatusColor(latestCall.status),
                      latestCall.status >= 200 && latestCall.status < 300 ? "bg-success/10" :
                      latestCall.status >= 400 ? "bg-destructive/10" : "bg-warning/10"
                    )}>
                      {latestCall.status} {latestCall.statusText}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Request ID: {latestCall.requestId}
                    </span>
                  </div>
                  
                  {/* Response Headers */}
                  {Object.keys(latestCall.responseHeaders).length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Headers
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                        {JSON.stringify(latestCall.responseHeaders, null, 2)}
                      </pre>
                    </details>
                  )}
                  
                  {/* Response Body */}
                  {latestCall.responseBody && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Body
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-64">
                        {latestCall.responseBody}
                      </pre>
                    </details>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCurl}
                  className="text-xs"
                >
                  {copiedCurl ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy as cURL
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJson}
                  className="text-xs"
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy JSON
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
