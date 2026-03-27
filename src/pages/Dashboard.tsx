import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/contexts/AppContext';
import { 
  Building2, 
  Landmark, 
  Calendar, 
  Upload, 
  FileText, 
  Settings,
  ArrowRight,
  CheckCircle2,
  Circle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const quickActions = [
  { 
    path: '/tenants', 
    label: 'Create Tenant', 
    description: 'Set up a new business tenant',
    icon: Building2 
  },
  { 
    path: '/bank-accounts', 
    label: 'Add Bank Account', 
    description: 'Link a business bank account',
    icon: Landmark 
  },
  { 
    path: '/transactions', 
    label: 'Upload Transactions', 
    description: 'Import CSV transactions',
    icon: Upload 
  },
  { 
    path: '/reports', 
    label: 'View P&L Report', 
    description: 'Generate profit & loss report',
    icon: FileText 
  },
];

export default function Dashboard() {
  const { 
    credentials, 
    tenants, 
    activeTenantId, 
    bankAccounts, 
    financialYears,
    transactions,
    getActiveTenant 
  } = useApp();

  const activeTenant = getActiveTenant();
  const tenantBankAccounts = bankAccounts.filter(a => a.tenantId === activeTenantId);
  const tenantFinancialYears = financialYears.filter(y => y.tenantId === activeTenantId);
  const tenantTransactions = transactions.filter(t => t.tenantId === activeTenantId);

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

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">
            Welcome to the Sage Embedded Services demo application
          </p>
        </div>

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

        {/* Quick Actions */}
        <div>
          <h2 className="section-title mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.path}
                  to={action.path}
                  className="group flex items-center justify-between p-5 bg-card rounded-xl border border-border hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{action.label}</h3>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              );
            })}
          </div>
        </div>

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
