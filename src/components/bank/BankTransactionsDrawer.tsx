import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { bankService, SageJournalEntry } from '@/services/bankService';
import { BankAccount } from '@/types/sage';
import { Loader2, AlertCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

interface BankTransactionsDrawerProps {
  account: BankAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BankTransactionsDrawer({ account, open, onOpenChange }: BankTransactionsDrawerProps) {
  const { activeTenantId, financialYears, credentials } = useApp();
  const [transactions, setTransactions] = useState<SageJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeFinancialYear = financialYears.find(fy => fy.tenantId === activeTenantId && fy.status === 'open');

  useEffect(() => {
    if (!open || !account || !activeTenantId || !credentials || !activeFinancialYear) {
      return;
    }

    const fetchTransactions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await bankService.getAccountTransactions(
          activeTenantId,
          account.id,
          activeFinancialYear.startDate,
          activeFinancialYear.endDate,
          credentials
        );
        setTransactions(result);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch transactions');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [open, account?.id, activeTenantId]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatAmount = (entry: SageJournalEntry) => {
    const amount = entry.TotalAmount.Base;
    const isCredit = entry.TreatAs === 'Credit';
    const displayAmount = isCredit ? -amount : amount;
    const currency = entry.Currency?.Code === 'EUR' ? '€' : entry.Currency?.Code === 'USD' ? '$' : '£';
    return { displayAmount, formatted: `${currency}${Math.abs(displayAmount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, isCredit };
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Transactions — {account?.name}</SheetTitle>
        </SheetHeader>

        {!activeFinancialYear ? (
          <div className="mt-6 p-4 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-foreground">No active financial year</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Please create a financial year first to view transactions.
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Loading transactions…</p>
          </div>
        ) : error ? (
          <div className="mt-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-foreground">Error loading transactions</h4>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="mt-12 text-center text-muted-foreground">
            <p>No transactions found for this account.</p>
          </div>
        ) : (
          <div className="mt-4">
            <div className="text-sm text-muted-foreground mb-3">
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Reference</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const { displayAmount, formatted, isCredit } = formatAmount(tx);
                    return (
                      <tr key={tx.Id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2.5">{formatDate(tx.Date)}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs">{tx.JournalType.Code}</span>
                        </td>
                        <td className="px-3 py-2.5">{tx.Reference || '—'}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant={tx.Status === 'Draft' ? 'outline' : 'secondary'} className="text-xs">
                            {tx.Status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold">
                          <span className={`inline-flex items-center gap-1 ${isCredit ? 'text-destructive' : 'text-green-600'}`}>
                            {isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            {isCredit ? '-' : ''}{formatted}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}