import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/contexts/AppContext';
import { reportingService } from '@/services/reportingService';
import { 
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Activity,
  Wallet,
  Building2,
  PiggyBank
} from 'lucide-react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface CellFormatting {
  Variant?: 'Strong' | 'Default';
  Color?: string;
  Type?: 'String' | 'Currency' | 'Percentage' | 'Spacer' | 'MultilineString';
  Alignment?: 'Left' | 'Right' | 'Center';
}

interface ReportCell {
  Value: string | number;
  Formatting: CellFormatting;
  MultilineValue?: string[];
  ColumnId?: number;
}

interface ReportRow {
  Columns: ReportCell[];
  Children?: ReportRow[];
  Formatting?: CellFormatting;
}

interface SageReport {
  Header: { Columns: ReportCell[] };
  Rows: ReportRow[];
  Metadata?: {
    Columns?: Array<{
      Id: number;
      StartDate?: string;
      EndDate?: string;
    }>;
  };
}

interface KpiMetric {
  label: string;
  value: number | null;
  icon: typeof Activity;
  formatter?: (value: number) => string;
}

interface TrendPoint {
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
  startDate?: string;
  endDate?: string;
}

type RangePreset = 'full-fy' | 'last-quarter' | 'last-month';

function formatIsoDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateOnly(dateString: string): Date {
  const [year, month, day] = dateString.slice(0, 10).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function buildRangeFromPreset(
  year: { startDate: string; endDate: string },
  preset: RangePreset
): { startDate: string; endDate: string; label: string } {
  const fyStart = parseDateOnly(year.startDate);
  const fyEnd = parseDateOnly(year.endDate);

  if (preset === 'full-fy') {
    return { startDate: formatIsoDate(fyStart), endDate: formatIsoDate(fyEnd), label: 'Full Financial Year' };
  }

  const monthsBack = preset === 'last-quarter' ? 3 : 1;
  const rangeStart = new Date(fyEnd);
  rangeStart.setMonth(rangeStart.getMonth() - monthsBack + 1);
  rangeStart.setDate(1);

  const boundedStart = rangeStart < fyStart ? fyStart : rangeStart;

  return {
    startDate: formatIsoDate(boundedStart),
    endDate: formatIsoDate(fyEnd),
    label: preset === 'last-quarter' ? 'Last 3 Months of FY' : 'Last Month of FY',
  };
}

function formatCurrency(value: number | null): string {
  if (value === null) return '--';
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseCellNumber(cell?: ReportCell): number | null {
  if (!cell) return null;
  const raw = String(cell.Value ?? '').replace(/,/g, '').trim();
  if (!raw) return null;
  const parsed = parseFloat(raw);
  if (isNaN(parsed)) return null;
  return cell.Formatting?.Color === 'EnclosedError' ? -Math.abs(parsed) : parsed;
}

function flattenRows(rows: ReportRow[]): ReportRow[] {
  const output: ReportRow[] = [];
  const walk = (items: ReportRow[]) => {
    for (const row of items) {
      output.push(row);
      if (row.Children?.length) walk(row.Children);
    }
  };
  walk(rows);
  return output;
}

function findYtdIndex(report: SageReport | null): number {
  if (!report?.Header?.Columns?.length) return -1;
  return report.Header.Columns.findIndex((col) => {
    const value = String(col.Value ?? '').toLowerCase();
    const multiline = (col.MultilineValue ?? []).join(' ').toLowerCase();
    return value.includes('ytd') || multiline.includes('ytd');
  });
}

function pickValueColumnIndex(report: SageReport | null): number {
  if (!report) return -1;
  const ytdIndex = findYtdIndex(report);
  if (ytdIndex >= 0) return ytdIndex;
  const header = report.Header?.Columns ?? [];
  for (let i = header.length - 1; i >= 1; i--) {
    if (header[i]?.Formatting?.Type !== 'Spacer') return i;
  }
  return -1;
}

function rowHasCurrency(row: ReportRow): boolean {
  return row.Columns.slice(1).some((c) => c.Formatting?.Type === 'Currency');
}

function findLastRowByLabel(report: SageReport | null, patterns: RegExp[]): ReportRow | null {
  if (!report) return null;
  const rows = flattenRows(report.Rows);
  let match: ReportRow | null = null;
  for (const row of rows) {
    const label = String(row.Columns[0]?.Value ?? '').trim();
    if (!label || !rowHasCurrency(row)) continue;
    if (patterns.some((re) => re.test(label))) {
      match = row;
    }
  }
  return match;
}

function getRowValue(report: SageReport | null, row: ReportRow | null): number | null {
  if (!report || !row) return null;
  const preferredIndex = pickValueColumnIndex(report);
  if (preferredIndex >= 0) {
    const val = parseCellNumber(row.Columns[preferredIndex]);
    if (val !== null) return val;
  }
  for (let i = row.Columns.length - 1; i >= 1; i--) {
    const val = parseCellNumber(row.Columns[i]);
    if (val !== null) return val;
  }
  return null;
}

function buildTrendData(report: SageReport | null): TrendPoint[] {
  if (!report) return [];
  const revenueRow = findLastRowByLabel(report, [/^total income$/i, /^sales$/i, /income/i]);
  const expenseRow = findLastRowByLabel(report, [/^total overheads$/i, /^total expenses?$/i, /overheads/i, /expenses?/i]);
  const profitRow = findLastRowByLabel(report, [/^net profit/i, /profit\/?\(loss\)/i]);
  if (!revenueRow || !expenseRow || !profitRow) return [];

  const ytdIndex = findYtdIndex(report);
  const header = report.Header?.Columns ?? [];
  const metadataById = new Map(
    (report.Metadata?.Columns ?? []).map((col) => [col.Id, col])
  );
  const points: TrendPoint[] = [];

  for (let i = 1; i < header.length; i++) {
    if (i === ytdIndex) continue;
    if (header[i]?.Formatting?.Type === 'Spacer') continue;

    const label = String(header[i]?.Value || '').trim() || `P${i}`;
    const revenue = parseCellNumber(revenueRow.Columns[i]) ?? 0;
    const expenses = parseCellNumber(expenseRow.Columns[i]) ?? 0;
    const profit = parseCellNumber(profitRow.Columns[i]) ?? 0;
    const columnId = revenueRow.Columns[i]?.ColumnId || expenseRow.Columns[i]?.ColumnId || profitRow.Columns[i]?.ColumnId;
    const colMeta = columnId ? metadataById.get(columnId) : undefined;

    points.push({
      period: label,
      revenue,
      expenses,
      profit,
      startDate: colMeta?.StartDate?.slice(0, 10),
      endDate: colMeta?.EndDate?.slice(0, 10),
    });
  }

  return points;
}

function buildNominalExpenseBreakdown(report: SageReport | null): Array<{ label: string; value: number }> {
  if (!report) return [];
  const valueIndex = pickValueColumnIndex(report);
  if (valueIndex < 0) return [];

  const rows = flattenRows(report.Rows)
    .filter((row) => String(row.Columns[0]?.Value ?? '').trim())
    .filter((row) => row.Columns[0]?.Formatting?.Variant !== 'Strong')
    .map((row) => ({
      label: String(row.Columns[0]?.Value ?? '').trim(),
      value: Math.abs(parseCellNumber(row.Columns[valueIndex]) ?? 0),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return rows;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    credentials, 
    tenants, 
    activeTenantId, 
    bankAccounts, 
    financialYears,
    transactions,
    getActiveTenant 
  } = useApp();

  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<RangePreset>('full-fy');
  const [reportWarnings, setReportWarnings] = useState<string[]>([]);
  const [pnlReport, setPnlReport] = useState<SageReport | null>(null);
  const [balanceSheetReport, setBalanceSheetReport] = useState<SageReport | null>(null);
  const [nominalReport, setNominalReport] = useState<SageReport | null>(null);

  const activeTenant = getActiveTenant();
  const tenantBankAccounts = bankAccounts.filter(a => a.tenantId === activeTenantId);
  const tenantFinancialYears = financialYears.filter(y => y.tenantId === activeTenantId);
  const tenantTransactions = transactions.filter(t => t.tenantId === activeTenantId);

  const selectedFinancialYear = useMemo(() => {
    if (tenantFinancialYears.length === 0) return null;
    return [...tenantFinancialYears].sort(
      (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
    )[0];
  }, [tenantFinancialYears]);

  const activeRange = useMemo(() => {
    if (!selectedFinancialYear) return null;
    return buildRangeFromPreset(selectedFinancialYear, selectedPreset);
  }, [selectedFinancialYear, selectedPreset]);

  const setupSteps = [
    { label: 'Configure API Credentials', done: !!credentials, path: '/admin' },
    { label: 'Create a Tenant', done: tenants.length > 0, path: '/tenants' },
    { label: 'Select Active Tenant', done: !!activeTenantId, path: '/tenants' },
    { label: 'Add Bank Account', done: tenantBankAccounts.length > 0, path: '/bank-accounts' },
    { label: 'Create Financial Year', done: tenantFinancialYears.length > 0, path: '/financial-years' },
    { label: 'Set Opening Balance', done: tenantBankAccounts.some(a => a.balance > 0), path: '/bank-accounts' },
  ];

  const completedSteps = setupSteps.filter(s => s.done).length;
  const progress = (completedSteps / setupSteps.length) * 100;

  useEffect(() => {
    if (!activeTenantId || !activeRange || !credentials?.clientId || !credentials?.clientSecret) {
      setPnlReport(null);
      setBalanceSheetReport(null);
      setNominalReport(null);
      setReportWarnings([]);
      setIsLoadingReports(false);
      return;
    }

    let cancelled = false;
    const params = {
      startDate: activeRange.startDate,
      endDate: activeRange.endDate,
    };

    const loadReports = async () => {
      setIsLoadingReports(true);
      setReportWarnings([]);

      const [pnlResult, balanceResult, nominalResult] = await Promise.allSettled([
        reportingService.getProfitAndLoss(activeTenantId, params, credentials),
        reportingService.getBalanceSheet(activeTenantId, params, credentials),
        reportingService.getNominalActivity(activeTenantId, params, credentials),
      ]);

      if (cancelled) return;

      const warnings: string[] = [];

      if (pnlResult.status === 'fulfilled') setPnlReport(pnlResult.value as SageReport);
      else {
        setPnlReport(null);
        warnings.push('Profit & Loss report unavailable for the selected tenant/year.');
      }

      if (balanceResult.status === 'fulfilled') setBalanceSheetReport(balanceResult.value as SageReport);
      else {
        setBalanceSheetReport(null);
        warnings.push('Balance Sheet report unavailable for the selected tenant/year.');
      }

      if (nominalResult.status === 'fulfilled') setNominalReport(nominalResult.value as SageReport);
      else {
        setNominalReport(null);
        warnings.push('Nominal Activity report unavailable for the selected tenant/year.');
      }

      setReportWarnings(warnings);
      setIsLoadingReports(false);
    };

    loadReports().catch(() => {
      if (!cancelled) {
        setReportWarnings(['Failed to load financial insights.']);
        setIsLoadingReports(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeTenantId,
    activeRange,
    credentials?.clientId,
    credentials?.clientSecret,
    credentials,
  ]);

  const revenueValue = useMemo(() => {
    const row = findLastRowByLabel(pnlReport, [/^total income$/i, /^sales$/i, /income/i]);
    return getRowValue(pnlReport, row);
  }, [pnlReport]);

  const expenseValue = useMemo(() => {
    const row = findLastRowByLabel(pnlReport, [/^total overheads$/i, /^total expenses?$/i, /overheads/i, /expenses?/i]);
    return getRowValue(pnlReport, row);
  }, [pnlReport]);

  const netProfitValue = useMemo(() => {
    const row = findLastRowByLabel(pnlReport, [/^net profit/i, /profit\/?\(loss\)/i]);
    return getRowValue(pnlReport, row);
  }, [pnlReport]);

  const marginValue = useMemo(() => {
    if (revenueValue === null || revenueValue === 0 || netProfitValue === null) return null;
    return (netProfitValue / revenueValue) * 100;
  }, [revenueValue, netProfitValue]);

  const netAssetsValue = useMemo(() => {
    const row = findLastRowByLabel(balanceSheetReport, [/net assets/i, /equity/i, /capital and reserves/i]);
    return getRowValue(balanceSheetReport, row);
  }, [balanceSheetReport]);

  const kpis: KpiMetric[] = useMemo(() => [
    { label: 'Revenue (YTD)', value: revenueValue, icon: TrendingUp },
    { label: 'Expenses (YTD)', value: expenseValue, icon: TrendingDown },
    { label: 'Net Profit (YTD)', value: netProfitValue, icon: Activity },
    {
      label: 'Profit Margin',
      value: marginValue,
      icon: PiggyBank,
      formatter: (value) => `${value.toFixed(2)}%`,
    },
    { label: 'Net Assets', value: netAssetsValue, icon: Wallet },
  ], [revenueValue, expenseValue, netProfitValue, marginValue, netAssetsValue]);

  const trendData = useMemo(() => buildTrendData(pnlReport), [pnlReport]);
  const nominalBreakdown = useMemo(() => buildNominalExpenseBreakdown(nominalReport), [nominalReport]);

  const handleTrendClick = (point: TrendPoint | undefined) => {
    if (!point) return;
    if (point.startDate && point.endDate) {
      navigate(`/reports?startDate=${encodeURIComponent(point.startDate)}&endDate=${encodeURIComponent(point.endDate)}&source=dashboard`);
      return;
    }
    navigate('/reports');
  };

  const canLoadInsights = !!activeTenantId && !!selectedFinancialYear && !!credentials?.clientId && !!credentials?.clientSecret;

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {activeTenant && (
          <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="section-title">{activeTenant.businessName} Financial Snapshot</h2>
              <p className="text-sm text-muted-foreground">
                {selectedFinancialYear
                  ? `FY ${new Date(selectedFinancialYear.startDate).toLocaleDateString('en-GB')} - ${new Date(selectedFinancialYear.endDate).toLocaleDateString('en-GB')}`
                  : 'Create a financial year to enable financial insights'}
              </p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Select value={selectedPreset} onValueChange={(value) => setSelectedPreset(value as RangePreset)}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-fy">Full Financial Year</SelectItem>
                  <SelectItem value="last-quarter">Last 3 Months of FY</SelectItem>
                  <SelectItem value="last-month">Last Month of FY</SelectItem>
                </SelectContent>
              </Select>
              <Link to="/reports" className="text-sm text-primary hover:underline whitespace-nowrap">
                Open detailed reports
              </Link>
            </div>
          </div>
        )}

        {canLoadInsights && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {kpis.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <div key={kpi.label} className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-semibold tabular-nums text-foreground">
                      {kpi.value === null
                        ? '--'
                        : kpi.formatter
                          ? kpi.formatter(kpi.value)
                          : formatCurrency(kpi.value)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="bg-card rounded-xl border border-border p-4 mb-6 bg-gradient-to-b from-muted/30 to-card">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">Revenue vs Expenses Trend</h3>
                  {activeRange && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {activeRange.label}. Click a point to drill into detailed reports.
                    </p>
                  )}
                </div>
                {isLoadingReports && (
                  <span className="inline-flex items-center text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading reports...
                  </span>
                )}
              </div>

              {trendData.length > 0 ? (
                <ChartContainer
                  className="h-[260px] md:h-[340px] w-full"
                  config={{
                    revenue: { label: 'Revenue', color: '#0ea5e9' },
                    expenses: { label: 'Expenses', color: '#f97316' },
                    profit: { label: 'Net Profit', color: '#10b981' },
                  }}
                >
                  <LineChart
                    data={trendData}
                    margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                    onClick={(state: any) => handleTrendClick(state?.activePayload?.[0]?.payload as TrendPoint | undefined)}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="period" tickLine={false} axisLine={false} minTickGap={20} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `£${Number(value).toLocaleString('en-GB')}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="expenses" stroke="var(--color-expenses)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="profit" stroke="var(--color-profit)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="h-[220px] rounded-lg bg-muted/40 border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
                  No trend data available yet. Add transactions and regenerate your reports.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="font-semibold text-foreground mb-4">Top Nominal Expenses (YTD)</h3>
                {nominalBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {nominalBreakdown.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-foreground truncate">{item.label}</span>
                        <span className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No nominal expense data available for this period.</p>
                )}
              </div>

              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="font-semibold text-foreground mb-4">Balance Sheet Snapshot</h3>
                <div className="space-y-3">
                  <InsightRow
                    label="Total Assets"
                    value={getRowValue(balanceSheetReport, findLastRowByLabel(balanceSheetReport, [/total assets/i]))}
                  />
                  <InsightRow
                    label="Total Liabilities"
                    value={getRowValue(balanceSheetReport, findLastRowByLabel(balanceSheetReport, [/total liabilities/i]))}
                  />
                  <InsightRow label="Net Assets" value={netAssetsValue} emphasize />
                </div>
              </div>
            </div>
          </>
        )}

        {!canLoadInsights && (
          <div className="mb-8 p-4 bg-muted rounded-lg border border-border text-sm text-muted-foreground">
            {!activeTenantId && 'Select an active tenant to unlock dashboard insights.'}
            {activeTenantId && !selectedFinancialYear && 'Create a financial year to load reporting insights.'}
            {activeTenantId && selectedFinancialYear && !credentials?.clientId && 'Configure API credentials to load reporting insights.'}
          </div>
        )}

        {reportWarnings.length > 0 && (
          <div className="mb-8 p-4 bg-warning/10 border border-warning/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">Some insights could not be loaded</p>
                {reportWarnings.map((warning, i) => (
                  <p key={i} className="text-sm text-muted-foreground">{warning}</p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Setup Progress */}
        <div className="bg-card rounded-xl border border-border p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Setup Progress</h2>
            <span className="text-sm font-medium text-muted-foreground">
              {completedSteps} of {setupSteps.length} complete
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="h-2 bg-muted rounded-full mb-6 overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Steps */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {setupSteps.map((step, index) => (
              <Link
                key={index}
                to={step.path}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  step.done 
                    ? "bg-success/10 border-success/30 text-success" 
                    : "bg-muted/50 border-border hover:bg-muted"
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  step.done ? "text-success" : "text-foreground"
                )}>
                  {step.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Active Tenant Stats */}
        {activeTenant && (
          <div className="mb-8">
            <h2 className="section-title mb-4">
              {activeTenant.businessName} Overview
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card">
                <div className="stat-value">{tenantBankAccounts.length}</div>
                <div className="stat-label">Bank Accounts</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{tenantFinancialYears.length}</div>
                <div className="stat-label">Financial Years</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{tenantTransactions.length}</div>
                <div className="stat-label">Transactions</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  £{tenantBankAccounts.reduce((sum, a) => sum + a.balance, 0).toLocaleString()}
                </div>
                <div className="stat-label">Total Balance</div>
              </div>
            </div>
          </div>
        )}

        {/* API Status */}
        {!credentials && (
          <div className="mt-8 p-4 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">API credentials not configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                Please configure your Sage API credentials in the{' '}
                <Link to="/admin" className="text-primary hover:underline">Admin Settings</Link>
                {' '}to enable API functionality.
              </p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function InsightRow({ label, value, emphasize = false }: { label: string; value: number | null; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('tabular-nums text-sm', emphasize ? 'font-semibold text-foreground' : 'text-foreground')}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
