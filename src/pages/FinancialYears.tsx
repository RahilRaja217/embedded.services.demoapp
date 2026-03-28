import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/contexts/AppContext';
import { useDeveloperMode } from '@/contexts/DeveloperModeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ApiIntegrationPanel } from '@/components/developer/ApiIntegrationPanel';
import { financialService } from '@/services/financialService';

export default function FinancialYears() {
  const { financialYears, activeTenantId, addFinancialYear, getActiveTenant, credentials } = useApp();
  const { isDeveloperMode } = useDeveloperMode();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    startDate: '',
    endDate: '',
  });

  const activeTenant = getActiveTenant();
  const tenantYears = financialYears.filter(y => y.tenantId === activeTenantId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenantId) return;
    
    if (!credentials?.clientId || !credentials?.clientSecret) {
      toast({
        title: "Configuration required",
        description: "Please configure your API credentials in Admin Settings first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Call real API
      await financialService.createFinancialYear(activeTenantId, {
        startDate: formData.startDate,
        endDate: formData.endDate,
        periodType: "Monthly",
      }, credentials);
      
      // Also add to local state for UI
      addFinancialYear({
        tenantId: activeTenantId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        periodType: "Monthly",
        status: 'open',
      });
      
      setFormData({ startDate: '', endDate: '' });
      setIsDialogOpen(false);
      toast({
        title: "Financial year created",
        description: "The financial year has been set up successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to create financial year",
        description: error.message || "An error occurred while creating the financial year.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-calculate end date (1 year from start)
  const handleStartDateChange = (date: string) => {
    setFormData(prev => {
      const start = new Date(date);
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
      return {
        startDate: date,
        endDate: end.toISOString().split('T')[0],
      };
    });
  };

  if (!activeTenantId) {
    return (
      <MainLayout>
        <div className="animate-fade-in">
          <div className="page-header">
            <h1 className="page-title">Financial Years</h1>
          </div>
          
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-warning flex-shrink-0" />
            <div>
              <h3 className="font-medium text-foreground">No tenant selected</h3>
              <p className="text-muted-foreground mt-1">
                Please select or create a tenant first to manage financial years.
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
        <div className="flex items-center justify-between mb-8">
          <div className="page-header mb-0">
            <h1 className="page-title">Financial Years</h1>
            <p className="page-description">
              Manage accounting periods for {activeTenant?.businessName}
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Financial Year
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Financial Year</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    required
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-calculated as 1 year from start date
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Year
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Years List */}
        {tenantYears.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No financial years</h3>
            <p className="text-muted-foreground mb-6">
              Create a financial year to start recording transactions.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Year
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenantYears.map((year) => (
              <div
                key={year.id}
                className="bg-card rounded-xl border border-border p-5"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-primary" />
                  </div>
                  <span className={cn(
                    "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                    year.status === 'open' 
                      ? "text-success bg-success/10" 
                      : "text-muted-foreground bg-muted"
                  )}>
                    {year.status === 'open' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {year.status === 'open' ? 'Open' : 'Closed'}
                  </span>
                </div>
                
                <h3 className="font-semibold text-foreground mb-3">
                  FY {new Date(year.startDate).getFullYear()}/{new Date(year.endDate).getFullYear()}
                </h3>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start Date:</span>
                    <span className="font-medium">{new Date(year.startDate).toLocaleDateString('en-GB')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">End Date:</span>
                    <span className="font-medium">{new Date(year.endDate).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* API Integration Panel - Only visible in Developer Mode */}
        {isDeveloperMode && (
          <div className="mt-8">
            <ApiIntegrationPanel featureArea="financial-years" />
          </div>
        )}

        {/* API Info - Always visible when not in dev mode */}
        {!isDeveloperMode && (
          <div className="mt-8 p-4 bg-muted rounded-lg">
            <h3 className="font-medium text-foreground mb-2">API Integration</h3>
            <p className="text-sm text-muted-foreground">
              Financial years are created via <code className="bg-background px-1 rounded">POST /financial_settings</code>.
              The year defines the accounting period for reporting.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
