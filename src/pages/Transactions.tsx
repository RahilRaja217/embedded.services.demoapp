import { useState, useRef, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/contexts/AppContext';
import { useDeveloperMode } from '@/contexts/DeveloperModeContext';
import { Button } from '@/components/ui/button';
import { 
  Upload, 
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Send
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { BankTransaction, CsvUploadResult, ParsedCsvTransaction, SageDimensionTag } from '@/types/sage';
import { ApiIntegrationPanel } from '@/components/developer/ApiIntegrationPanel';
import { transactionService } from '@/services/transactionService';
import { dimensionService } from '@/services/dimensionService';

const SAMPLE_CSV = `date,type,description,reference,amount,category
2024-01-15,receipt,Client Payment - ABC Corp,INV-001,5000.00,Sales
2024-01-18,payment,Office Supplies,PO-123,150.00,Office Expenses
2024-01-20,receipt,Consulting Fee,INV-002,2500.00,Sales
2024-01-22,payment,Software Subscription,SUB-001,99.00,Software
2024-01-25,payment,Travel Expenses,EXP-001,350.00,Travel
2024-01-28,receipt,Product Sale,INV-003,1200.00,Sales`;

export default function Transactions() {
  const { 
    bankAccounts, 
    transactions, 
    activeTenantId, 
    addTransactions, 
    getActiveTenant,
    credentials,
    requiredDimensions,
  } = useApp();
  const { isDeveloperMode } = useDeveloperMode();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [uploadResults, setUploadResults] = useState<CsvUploadResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // New multi-step state
  const [parsedTransactions, setParsedTransactions] = useState<ParsedCsvTransaction[]>([]);
  const [dimensionTags, setDimensionTags] = useState<Record<string, SageDimensionTag[]>>({}); // dimensionId -> tags
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  const activeTenant = getActiveTenant();
  const tenantAccounts = bankAccounts.filter(a => a.tenantId === activeTenantId);
  const tenantTransactions = transactions.filter(t => t.tenantId === activeTenantId);

  // Load dimension tags when required dimensions change or tenant changes
  useEffect(() => {
    if (requiredDimensions.length > 0 && activeTenantId && credentials) {
      loadDimensionTags();
    }
  }, [requiredDimensions, activeTenantId]);

  const loadDimensionTags = async () => {
    if (!activeTenantId || !credentials) return;
    setIsLoadingTags(true);
    try {
      const tagMap: Record<string, SageDimensionTag[]> = {};
      await Promise.all(
        requiredDimensions.map(async (dim) => {
          const tags = await dimensionService.getDimensionTags(activeTenantId, dim.id, credentials);
          tagMap[dim.code] = (Array.isArray(tags) ? tags : []).filter(t => t.IsActive);
        })
      );
      setDimensionTags(tagMap);
    } catch (error: any) {
      toast({
        title: "Failed to load dimension tags",
        description: error.message || "Could not fetch dimension tags.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTags(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedAccountId || !activeTenantId) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const parsed: ParsedCsvTransaction[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        if (row.date && row.type && row.amount) {
          parsed.push({
            rowIndex: i,
            type: row.type.toLowerCase() as 'payment' | 'receipt',
            date: row.date,
            description: row.description || '',
            reference: row.reference || '',
            amount: parseFloat(row.amount) || 0,
            category: row.category || 'Uncategorized',
            dimensionSelections: {},
          });
        }
      }

      if (parsed.length === 0) {
        toast({
          title: "No valid transactions",
          description: "The CSV file doesn't contain any valid transaction rows.",
          variant: "destructive",
        });
        return;
      }

      setParsedTransactions(parsed);
      setUploadResults([]);
      toast({
        title: "CSV parsed",
        description: `${parsed.length} transaction(s) ready. Please select dimension tags before submitting.`,
      });
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDimensionChange = (rowIndex: number, dimensionCode: string, tagCode: string) => {
    setParsedTransactions(prev =>
      prev.map(tx =>
        tx.rowIndex === rowIndex
          ? { ...tx, dimensionSelections: { ...tx.dimensionSelections, [dimensionCode]: tagCode } }
          : tx
      )
    );
  };

  const allDimensionsSelected = () => {
    if (requiredDimensions.length === 0) return true;
    return parsedTransactions.every(tx =>
      requiredDimensions.every(dim => tx.dimensionSelections[dim.code])
    );
  };

  const handleSubmitTransactions = async () => {
    if (!activeTenantId || !credentials || !selectedAccountId) return;

    if (!credentials.clientId || !credentials.clientSecret) {
      toast({
        title: "Configuration required",
        description: "Please configure your API credentials in Admin Settings first.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadResults([]);

    try {
      const results = await transactionService.uploadTransactions(
        activeTenantId,
        selectedAccountId,
        parsedTransactions,
        requiredDimensions,
        credentials
      );

      setUploadResults(results);

      const successfulTransactions = results
        .filter(r => r.success && r.data)
        .map(r => r.data as BankTransaction);
      
      if (successfulTransactions.length > 0) {
        addTransactions(successfulTransactions.map(t => ({
          tenantId: t.tenantId,
          bankAccountId: t.bankAccountId,
          type: t.type,
          date: t.date,
          description: t.description,
          reference: t.reference,
          amount: t.amount,
          category: t.category,
        })));
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      toast({
        title: "Upload complete",
        description: `${successCount} transactions uploaded${failCount > 0 ? `, ${failCount} failed` : ''}.`,
        variant: failCount > 0 ? "destructive" : "default",
      });

      // Clear parsed transactions on full success
      if (failCount === 0) {
        setParsedTransactions([]);
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred while uploading transactions.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!activeTenantId) {
    return (
      <MainLayout>
        <div className="animate-fade-in">
          <div className="page-header">
            <h1 className="page-title">Transactions</h1>
          </div>
          
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-warning flex-shrink-0" />
            <div>
              <h3 className="font-medium text-foreground">No tenant selected</h3>
              <p className="text-muted-foreground mt-1">
                Please select or create a tenant first to manage transactions.
              </p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Transactions</h1>
          <p className="page-description">
            Upload and manage bank transactions for {activeTenant?.businessName}
          </p>
        </div>

        {/* Step 1: Select Bank Account & Upload CSV */}
        <div className="bg-card rounded-xl border border-border p-6 mb-8">
          <h2 className="section-title mb-4">Step 1: Upload CSV</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select Bank Account
                </label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={isUploading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                  disabled={isUploading}
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedAccountId || tenantAccounts.length === 0 || isUploading}
                  className="w-full"
                  variant="outline"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Select CSV File
                </Button>
              </div>

              {isLoadingTags && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading dimension tags...
                </div>
              )}
            </div>

            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">CSV Format</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Your CSV should include these columns:
              </p>
              <code className="text-xs bg-background p-2 rounded block overflow-x-auto">
                date, type, description, reference, amount, category
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>type</strong>: "payment" or "receipt"
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={downloadSampleCSV}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Sample CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Step 2: Review & Set Dimensions */}
        {parsedTransactions.length > 0 && (
          <div className="bg-card rounded-xl border border-border overflow-hidden mb-8">
            <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
              <h2 className="section-title">Step 2: Review & Set Dimensions ({parsedTransactions.length} transactions)</h2>
              <Button
                onClick={handleSubmitTransactions}
                disabled={isUploading || !allDimensionsSelected()}
                size="sm"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {isUploading ? 'Submitting...' : 'Submit All'}
              </Button>
            </div>

            {!allDimensionsSelected() && requiredDimensions.length > 0 && (
              <div className="p-3 bg-warning/10 border-b border-warning/30 flex items-center gap-2 text-sm text-warning">
                <AlertCircle className="w-4 h-4" />
                Please select all required dimension tags for each transaction before submitting.
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="bg-muted/30">
                    <th>Row</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Description</th>
                    <th className="text-right">Amount</th>
                    {requiredDimensions.map(dim => (
                      <th key={dim.id}>{dim.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedTransactions.map((tx) => (
                    <tr key={tx.rowIndex}>
                      <td className="text-muted-foreground">{tx.rowIndex}</td>
                      <td>{tx.date}</td>
                      <td>
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          tx.type === 'receipt' 
                            ? "bg-success/10 text-success" 
                            : "bg-destructive/10 text-destructive"
                        )}>
                          {tx.type === 'receipt' ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          {tx.type === 'receipt' ? 'Receipt' : 'Payment'}
                        </span>
                      </td>
                      <td className="font-mono text-sm">{tx.reference}</td>
                      <td>{tx.description}</td>
                      <td className={cn(
                        "text-right font-semibold",
                        tx.type === 'receipt' ? "text-success" : "text-destructive"
                      )}>
                        {tx.type === 'receipt' ? '+' : '-'}£{tx.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </td>
                      {requiredDimensions.map(dim => (
                        <td key={dim.id}>
                          <Select
                            value={tx.dimensionSelections[dim.code] || ''}
                            onValueChange={(value) => handleDimensionChange(tx.rowIndex, dim.code, value)}
                          >
                            <SelectTrigger className="min-w-[160px]">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(dimensionTags[dim.code] || []).map(tag => (
                                <SelectItem key={tag.Id} value={tag.Code}>
                                  {tag.Name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Upload Results */}
        {uploadResults.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-6 mb-8">
            <h2 className="section-title mb-4">Upload Results</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {uploadResults.map((result) => (
                <div
                  key={result.row}
                  className={cn(
                    "flex items-center gap-2 text-sm p-2 rounded",
                    result.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  )}
                >
                  {result.success ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Row {result.row}: {result.success ? 'Success' : `Failed - ${result.message}`}
                  {result.status && ` (${result.status})`}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Transactions List */}
        {tenantTransactions.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No transactions</h3>
            <p className="text-muted-foreground">
              Upload a CSV file to import bank payments and receipts.
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/50">
              <h2 className="section-title">Recent Transactions</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr className="bg-muted/30">
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Category</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {tenantTransactions.slice().reverse().map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{new Date(transaction.date).toLocaleDateString('en-GB')}</td>
                    <td>
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        transaction.type === 'receipt' 
                          ? "bg-success/10 text-success" 
                          : "bg-destructive/10 text-destructive"
                      )}>
                        {transaction.type === 'receipt' ? (
                          <ArrowDownLeft className="w-3 h-3" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3" />
                        )}
                        {transaction.type === 'receipt' ? 'Receipt' : 'Payment'}
                      </span>
                    </td>
                    <td>{transaction.description}</td>
                    <td className="font-mono text-sm">{transaction.reference}</td>
                    <td>{transaction.category}</td>
                    <td className={cn(
                      "text-right font-semibold",
                      transaction.type === 'receipt' ? "text-success" : "text-destructive"
                    )}>
                      {transaction.type === 'receipt' ? '+' : '-'}£{transaction.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* API Integration Panel - Only visible in Developer Mode */}
        {isDeveloperMode && (
          <div className="mt-8">
            <ApiIntegrationPanel featureArea="transactions" />
          </div>
        )}

        {/* API Info - Always visible when not in dev mode */}
        {!isDeveloperMode && (
          <div className="mt-8 p-4 bg-muted rounded-lg">
            <h3 className="font-medium text-foreground mb-2">API Integration</h3>
            <p className="text-sm text-muted-foreground">
              Bank payments are created via <code className="bg-background px-1 rounded">POST /transaction/v2/tenant/&#123;id&#125;/journals/&#123;journalId&#125;</code> with 
              dimension tags attached to each transaction item.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
