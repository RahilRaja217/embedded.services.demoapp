import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/contexts/AppContext';
import { useDeveloperMode } from '@/contexts/DeveloperModeContext';
import { Button } from '@/components/ui/button';
import { 
  FileText,
  AlertCircle,
  RefreshCw,
  Download,
  Loader2,
  Code
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ApiIntegrationPanel } from '@/components/developer/ApiIntegrationPanel';
import { reportingService } from '@/services/reportingService';
import { useToast } from '@/hooks/use-toast';

// ── Sage Report types ──────────────────────────────────────────
interface CellFormatting {
  Variant?: 'Strong' | 'Default';
  Color?: string;
  Type?: 'String' | 'Currency' | 'Percentage' | 'Spacer' | 'MultilineString';
  Alignment?: 'Left' | 'Right' | 'Center';
}

interface ReportCell {
  Value: string;
  Formatting: CellFormatting;
  MultilineValue?: string[];
  ColumnId?: number;
  RowId?: number;
}

interface ReportRow {
  Columns: ReportCell[];
  Children?: ReportRow[];
  Formatting?: CellFormatting;
}

interface SageReport {
  Id: string;
  Title: string;
  Subtitle: string;
  LastRunDate: string;
  Header: { Columns: ReportCell[] };
  Rows: ReportRow[];
  Metadata?: any;
}

// ── Helpers ────────────────────────────────────────────────────

function formatCellValue(cell: ReportCell): string {
  if (!cell.Value && cell.Formatting?.Type === 'Spacer') return '';
  const val = cell.Value;
  if (cell.Formatting?.Type === 'Currency') {
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (cell.Formatting.Color === 'EnclosedError') {
      return `(£${Math.abs(num).toLocaleString('en-GB', { minimumFractionDigits: 2 })})`;
    }
    return `£${num.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  }
  if (cell.Formatting?.Type === 'Percentage') {
    return `${val}%`;
  }
  return val;
}

function cellClasses(cell: ReportCell): string {
  const parts: string[] = [];
  if (cell.Formatting?.Variant === 'Strong') parts.push('font-semibold');
  if (cell.Formatting?.Color === 'EnclosedError') parts.push('text-destructive');
  if (cell.Formatting?.Alignment === 'Right') parts.push('text-right');
  else if (cell.Formatting?.Alignment === 'Center') parts.push('text-center');
  else parts.push('text-left');
  return parts.join(' ');
}

function isSpacerRow(row: ReportRow): boolean {
  return row.Formatting?.Type === 'Spacer' || 
    row.Columns.every(c => c.Formatting?.Type === 'Spacer' || c.Value === '');
}

// ── Component ──────────────────────────────────────────────────

export default function Reports() {
  const { financialYears, activeTenantId, getActiveTenant, credentials } = useApp();
  const { isDeveloperMode } = useDeveloperMode();
  const { toast } = useToast();
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sageReport, setSageReport] = useState<SageReport | null>(null);
  const [rawJson, setRawJson] = useState<string>('');

  const activeTenant = getActiveTenant();
  const tenantYears = financialYears.filter(y => y.tenantId === activeTenantId);

  const selectedYear = tenantYears.find(y => y.id === selectedYearId);

  // ── Generate report ──────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedYearId || !activeTenantId || !selectedYear) return;

    if (!credentials?.clientId || !credentials?.clientSecret) {
      toast({
        title: 'Credentials required',
        description: 'Please configure API credentials in Admin Settings first.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const data = await reportingService.getProfitAndLoss(
        activeTenantId,
        { startDate: selectedYear.startDate, endDate: selectedYear.endDate },
        credentials
      );
      setSageReport(data as SageReport);
      setRawJson(JSON.stringify(data, null, 2));
      toast({ title: 'Report generated', description: 'P&L report fetched from the API.' });
    } catch (error: any) {
      toast({
        title: 'Report failed',
        description: error.message || 'Failed to generate P&L report.',
        variant: 'destructive',
      });
      setSageReport(null);
      setRawJson('');
    }
    setIsGenerating(false);
  };

  // ── Export PDF ───────────────────────────────────────────────
  const handleExportPdf = async () => {
    if (!selectedYearId || !activeTenantId || !selectedYear) return;

    if (!credentials?.clientId || !credentials?.clientSecret) {
      toast({
        title: 'Credentials required',
        description: 'Please configure API credentials in Admin Settings first.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    try {
      const pdfUrl = await reportingService.exportProfitAndLossPdf(
        activeTenantId,
        { startDate: selectedYear.startDate, endDate: selectedYear.endDate },
        credentials
      );
      // Auto-download the PDF
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.target = '_blank';
      link.download = `PnL_${selectedYear.startDate}_${selectedYear.endDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: 'PDF exported', description: 'The PDF report is downloading.' });
    } catch (error: any) {
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export PDF.',
        variant: 'destructive',
      });
    }
    setIsExporting(false);
  };

  // ── No tenant guard ──────────────────────────────────────────
  if (!activeTenantId) {
    return (
      <MainLayout>
        <div className="animate-fade-in">
          <div className="page-header">
            <h1 className="page-title">P&L Report</h1>
          </div>
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-warning flex-shrink-0" />
            <div>
              <h3 className="font-medium text-foreground">No tenant selected</h3>
              <p className="text-muted-foreground mt-1">
                Please select or create a tenant first to view reports.
              </p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Profit & Loss Report</h1>
          <p className="page-description">
            View financial performance for {activeTenant?.businessName}
          </p>
        </div>

        {/* Controls */}
        <div className="bg-card rounded-xl border border-border p-6 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Select Financial Year
              </label>
              <Select value={selectedYearId} onValueChange={setSelectedYearId} disabled={isGenerating}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Choose a year" />
                </SelectTrigger>
                <SelectContent>
                  {tenantYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      FY {new Date(year.startDate).getFullYear()}/{new Date(year.endDate).getFullYear()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleGenerate} disabled={!selectedYearId || isGenerating}>
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Generate Report
            </Button>
          </div>
        </div>

        {/* Report content */}
        {!sageReport ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No report generated</h3>
            <p className="text-muted-foreground">
              {tenantYears.length === 0
                ? 'Create a financial year first to generate reports.'
                : 'Select a financial year and click Generate Report.'}
            </p>
          </div>
        ) : (
          <Tabs defaultValue="summary" className="space-y-6">
            {isDeveloperMode && rawJson && (
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="raw">
                  <Code className="w-4 h-4 mr-2" />
                  Raw JSON
                </TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="summary" className="space-y-6">
              {/* Report table */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
                  <div>
                    <h2 className="section-title">{sageReport.Title || 'Profit & Loss Statement'}</h2>
                    <p className="section-description">
                      {sageReport.Subtitle}
                      {sageReport.LastRunDate && (
                        <> · Generated {new Date(sageReport.LastRunDate).toLocaleString('en-GB')}</>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportPdf}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Export PDF
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    {/* Header row */}
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        {sageReport.Header.Columns.map((col, i) => (
                          <th
                            key={i}
                            className={cn(
                              'px-3 py-2 whitespace-nowrap',
                              i === 0 ? 'sticky left-0 bg-muted/30 z-10 min-w-[200px]' : 'min-w-[100px]',
                              col.Formatting?.Type === 'Spacer' ? 'w-4 min-w-[16px]' : '',
                              cellClasses(col)
                            )}
                          >
                            {col.MultilineValue
                              ? col.MultilineValue.map((line, li) => (
                                  <div key={li}>{line}</div>
                                ))
                              : col.Value}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sageReport.Rows.map((row, ri) => (
                        <ReportRowGroup key={ri} row={row} depth={0} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {isDeveloperMode && rawJson && (
              <TabsContent value="raw">
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted/50">
                    <h2 className="section-title">Raw API Response</h2>
                    <p className="section-description">
                      Complete JSON response from the P&L endpoint
                    </p>
                  </div>
                  <pre className="p-4 overflow-x-auto text-sm font-mono bg-muted/30 max-h-96">
                    {rawJson}
                  </pre>
                </div>
              </TabsContent>
            )}
          </Tabs>
        )}

        {/* API Integration Panel */}
        {isDeveloperMode && (
          <div className="mt-8">
            <ApiIntegrationPanel featureArea="reports" />
          </div>
        )}

        {!isDeveloperMode && (
          <div className="mt-8 p-4 bg-muted rounded-lg">
            <h3 className="font-medium text-foreground mb-2">API Integration</h3>
            <p className="text-sm text-muted-foreground">
              The P&L report is generated via{' '}
              <code className="bg-background px-1 rounded">POST /reports/ProfitAndLoss/run</code>{' '}
              with date range parameters matching the selected financial year.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

// ── Row rendering component ─────────────────────────────────────
function ReportRowGroup({ row, depth }: { row: ReportRow; depth: number }) {
  if (isSpacerRow(row)) {
    return (
      <tr className="h-3">
        <td colSpan={row.Columns.length} />
      </tr>
    );
  }

  const firstCell = row.Columns[0];
  const isSection = firstCell?.Formatting?.Variant === 'Strong';

  return (
    <>
      <tr
        className={cn(
          'border-b border-border/40 hover:bg-muted/20 transition-colors',
          isSection && depth === 0 && 'bg-muted/10',
          isSection && 'border-b-border'
        )}
      >
        {row.Columns.map((cell, ci) => (
          <td
            key={ci}
            className={cn(
              'px-3 py-1.5 whitespace-nowrap',
              ci === 0 && 'sticky left-0 bg-card z-10',
              ci === 0 && isSection && depth === 0 && 'bg-muted/10',
              cell.Formatting?.Type === 'Spacer' ? 'w-4' : '',
              cellClasses(cell)
            )}
            style={ci === 0 && depth > 0 ? { paddingLeft: `${12 + depth * 16}px` } : undefined}
          >
            {formatCellValue(cell)}
          </td>
        ))}
      </tr>
      {row.Children?.map((child, ci) => (
        <ReportRowGroup key={ci} row={child} depth={depth + 1} />
      ))}
    </>
  );
}
