import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/contexts/AppContext';
import { useDeveloperMode } from '@/contexts/DeveloperModeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Save, 
  Key, 
  Server, 
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  FileJson,
  RefreshCw,
  Clock,
  Loader2,
  Layers
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getConfig, saveConfig } from '@/lib/configManager';
import { getTokenMetadata, getToken, clearToken } from '@/lib/tokenManager';
import { dimensionService } from '@/services/dimensionService';
import { SageDimension, RequiredDimension } from '@/types/sage';

export default function Admin() {
  const { credentials, setCredentials, activeTenantId, requiredDimensions, setRequiredDimensions } = useApp();
  const { isDeveloperMode } = useDeveloperMode();
  const { toast } = useToast();
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [isTesting, setIsTesting] = useState<'subscription' | 'tenant' | null>(null);
  const [tokenStatus, setTokenStatus] = useState<{
    subscription: { valid: boolean; expiresAt: number | null };
    tenant: { valid: boolean; expiresAt: number | null };
  }>({
    subscription: { valid: false, expiresAt: null },
    tenant: { valid: false, expiresAt: null },
  });
  
  // Dimension state
  const [dimensions, setDimensions] = useState<SageDimension[]>([]);
  const [isLoadingDimensions, setIsLoadingDimensions] = useState(false);
  const [selectedDimensionIds, setSelectedDimensionIds] = useState<Set<string>>(
    new Set(requiredDimensions.map(d => d.id))
  );

  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    subscriptionClientId: '',
    subscriptionClientSecret: '',
    productCode: '',
    platform: '',
    businessTypeCode: '',
    bankOpeningBalanceJournalCode: '',
    bankPaymentJournalCode: '',
    bankReceiptJournalCode: '',
  });

  useEffect(() => {
    const loadConfig = async () => {
      const config = await getConfig();
      setIsConfigLoaded(config.fileConfigLoaded);
      
      if (credentials) {
        setFormData(credentials);
      } else if (config.credentials) {
        setFormData({
          clientId: config.credentials.clientId || '',
          clientSecret: config.credentials.clientSecret || '',
          subscriptionClientId: config.credentials.subscriptionClientId || '',
          subscriptionClientSecret: config.credentials.subscriptionClientSecret || '',
          productCode: config.credentials.productCode || '',
          platform: config.credentials.platform || '',
          businessTypeCode: config.credentials.businessTypeCode || '',
          bankOpeningBalanceJournalCode: config.credentials.bankOpeningBalanceJournalCode || '',
          bankPaymentJournalCode: config.credentials.bankPaymentJournalCode || '',
          bankReceiptJournalCode: config.credentials.bankReceiptJournalCode || '',
        });
      }
    };

    loadConfig();
    updateTokenStatus();
  }, [credentials]);

  // Sync selected dimensions when requiredDimensions changes
  useEffect(() => {
    setSelectedDimensionIds(new Set(requiredDimensions.map(d => d.id)));
  }, [requiredDimensions]);

  const updateTokenStatus = () => {
    const subscriptionMeta = getTokenMetadata('subscription');
    const tenantMeta = getTokenMetadata('tenant');
    
    setTokenStatus({
      subscription: { 
        valid: subscriptionMeta?.isValid || false, 
        expiresAt: subscriptionMeta?.expiresAt || null 
      },
      tenant: { 
        valid: tenantMeta?.isValid || false, 
        expiresAt: tenantMeta?.expiresAt || null 
      },
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCredentials(formData);
    saveConfig(formData);
    
    toast({
      title: "Settings saved",
      description: "Your API credentials have been saved successfully.",
    });
  };

  const handleTestConnection = async (type: 'subscription' | 'tenant') => {
    setIsTesting(type);
    
    try {
      saveConfig(formData);
      clearToken(type);
      
      const clientId = type === 'subscription' ? formData.subscriptionClientId : formData.clientId;
      const clientSecret = type === 'subscription' ? formData.subscriptionClientSecret : formData.clientSecret;
      
      const token = await getToken(type, clientId, clientSecret);
      
      if (token) {
        updateTokenStatus();
        toast({
          title: "Connection successful",
          description: `${type === 'subscription' ? 'Subscription' : 'Tenant'} credentials are valid.`,
        });
      } else {
        toast({
          title: "Connection failed",
          description: `Failed to authenticate with ${type} credentials.`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description: error.message || `Failed to authenticate with ${type} credentials.`,
        variant: "destructive",
      });
    } finally {
      setIsTesting(null);
    }
  };

  const handleLoadDimensions = async () => {
    if (!activeTenantId || !credentials) {
      toast({
        title: "Cannot load dimensions",
        description: "Please select a tenant and configure credentials first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingDimensions(true);
    try {
      const dims = await dimensionService.getDimensions(activeTenantId, credentials);
      // Only show active dimensions
      const activeDims = (Array.isArray(dims) ? dims : []).filter(d => d.IsActive);
      setDimensions(activeDims);
      toast({
        title: "Dimensions loaded",
        description: `Found ${activeDims.length} active dimension(s).`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to load dimensions",
        description: error.message || "Could not fetch dimensions from API.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDimensions(false);
    }
  };

  const handleDimensionToggle = (dim: SageDimension, checked: boolean) => {
    const newSet = new Set(selectedDimensionIds);
    if (checked) {
      newSet.add(dim.Id);
    } else {
      newSet.delete(dim.Id);
    }
    setSelectedDimensionIds(newSet);
  };

  const handleSaveDimensions = () => {
    const selected: RequiredDimension[] = dimensions
      .filter(d => selectedDimensionIds.has(d.Id))
      .map(d => ({ id: d.Id, code: d.Code, name: d.Name }));
    
    setRequiredDimensions(selected);
    toast({
      title: "Dimension settings saved",
      description: `${selected.length} dimension(s) marked as required for transactions.`,
    });
  };

  const formatExpiry = (timestamp: number | null) => {
    if (!timestamp) return 'Not authenticated';
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = timestamp - now;
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `Expires in ${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    return `Expires in ${hours}h ${minutes % 60}m`;
  };

  return (
    <MainLayout>
      <div className="max-w-3xl animate-fade-in">
        {/* Local Demo Warning Banner */}
        <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground">Local Demo Only</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Credentials are stored locally in your browser for this sandbox demo. 
              This is not suitable for production use.
            </p>
          </div>
        </div>

        {/* Config File Indicator */}
        {isConfigLoaded && (
          <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-lg flex items-start gap-3">
            <FileJson className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-foreground">Config File Detected</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Settings were loaded from <code className="bg-background px-1 rounded">app-config.local.json</code>. 
                Changes here will override the file settings.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Admin Settings</h1>
          <p className="page-description">
            Configure your Sage Embedded Services API credentials
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* OAuth Credentials (Tenant Services) */}
          <div className="form-section">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Key className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="section-title">Tenant Services Credentials</h2>
                  <p className="section-description">For bank accounts, transactions, and reports</p>
                </div>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => handleTestConnection('tenant')}
                disabled={isTesting !== null || !formData.clientId || !formData.clientSecret}
              >
                {isTesting === 'tenant' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Test
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={formData.clientId}
                  onChange={(e) => handleChange('clientId', e.target.value)}
                  placeholder="Enter client ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  value={formData.clientSecret}
                  onChange={(e) => handleChange('clientSecret', e.target.value)}
                  placeholder="Enter client secret"
                />
              </div>
            </div>

            {/* Token Status - Developer Mode Only */}
            {isDeveloperMode && (
              <div className="mt-4 p-3 bg-muted rounded-lg flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Token Status:</span>
                <span className={tokenStatus.tenant.valid ? "text-success" : "text-muted-foreground"}>
                  {formatExpiry(tokenStatus.tenant.expiresAt)}
                </span>
              </div>
            )}
          </div>

          {/* Subscription Credentials */}
          <div className="form-section">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Server className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <h2 className="section-title">Subscription Credentials</h2>
                  <p className="section-description">For tenant creation and metadata</p>
                </div>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => handleTestConnection('subscription')}
                disabled={isTesting !== null || !formData.subscriptionClientId || !formData.subscriptionClientSecret}
              >
                {isTesting === 'subscription' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Test
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subscriptionClientId">Subscription Client ID</Label>
                <Input
                  id="subscriptionClientId"
                  value={formData.subscriptionClientId}
                  onChange={(e) => handleChange('subscriptionClientId', e.target.value)}
                  placeholder="Enter subscription client ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionClientSecret">Subscription Client Secret</Label>
                <Input
                  id="subscriptionClientSecret"
                  type="password"
                  value={formData.subscriptionClientSecret}
                  onChange={(e) => handleChange('subscriptionClientSecret', e.target.value)}
                  placeholder="Enter subscription client secret"
                />
              </div>
            </div>

            {/* Token Status - Developer Mode Only */}
            {isDeveloperMode && (
              <div className="mt-4 p-3 bg-muted rounded-lg flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Token Status:</span>
                <span className={tokenStatus.subscription.valid ? "text-success" : "text-muted-foreground"}>
                  {formatExpiry(tokenStatus.subscription.expiresAt)}
                </span>
              </div>
            )}
          </div>

          {/* Additional Settings */}
          <div className="form-section">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="section-title">Subscription Settings</h2>
                <p className="section-description">Values from the subscriptions endpoint</p>
              </div>
              <a 
                href="https://developer.sage.com/embedded-services/apis/embedded-services/latest/openapi" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View API Docs
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productCode">Product Code</Label>
                <Input
                  id="productCode"
                  value={formData.productCode}
                  onChange={(e) => handleChange('productCode', e.target.value)}
                  placeholder="e.g., SAGE_ONE"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Input
                  id="platform"
                  value={formData.platform}
                  onChange={(e) => handleChange('platform', e.target.value)}
                  placeholder="e.g., UK"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessTypeCode">Business Type Code</Label>
                <Input
                  id="businessTypeCode"
                  value={formData.businessTypeCode}
                  onChange={(e) => handleChange('businessTypeCode', e.target.value)}
                  placeholder="e.g., SOLE_TRADER"
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="space-y-2">
                <Label htmlFor="bankOpeningBalanceJournalCode">Bank Opening Balance Journal Code</Label>
                <Input
                  id="bankOpeningBalanceJournalCode"
                  value={formData.bankOpeningBalanceJournalCode}
                  onChange={(e) => handleChange('bankOpeningBalanceJournalCode', e.target.value)}
                  placeholder="e.g., 759b6bdc-7200-09bc-e93b-9284bd95a344"
                />
                <p className="text-xs text-muted-foreground">
                  The journal type ID used in bank opening balance API calls
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="bankPaymentJournalCode">Bank Payment Journal Code</Label>
                <Input
                  id="bankPaymentJournalCode"
                  value={formData.bankPaymentJournalCode}
                  onChange={(e) => handleChange('bankPaymentJournalCode', e.target.value)}
                  placeholder="e.g., 7078df86-3c36-f139-1b3a-390d1197b0f8"
                />
                <p className="text-xs text-muted-foreground">
                  The journal type ID used for bank payment transactions
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankReceiptJournalCode">Bank Receipt Journal Code</Label>
                <Input
                  id="bankReceiptJournalCode"
                  value={formData.bankReceiptJournalCode}
                  onChange={(e) => handleChange('bankReceiptJournalCode', e.target.value)}
                  placeholder="e.g., d6be52be-4361-1dc6-21f4-f895bba7ed5a"
                />
                <p className="text-xs text-muted-foreground">
                  The journal type ID used for bank receipt transactions
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4">
            {credentials && (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Credentials configured</span>
              </div>
            )}
            <Button type="submit" className="ml-auto">
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </form>

        {/* Dimensions Configuration */}
        <div className="form-section mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="section-title">Transaction Dimensions</h2>
                <p className="section-description">Select which dimensions are required when uploading transactions</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadDimensions}
              disabled={isLoadingDimensions || !activeTenantId || !credentials}
            >
              {isLoadingDimensions ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Load Dimensions
            </Button>
          </div>

          {!activeTenantId && (
            <p className="text-sm text-muted-foreground">Select a tenant first to load dimensions.</p>
          )}

          {dimensions.length > 0 && (
            <div className="space-y-3">
              {dimensions.map((dim) => (
                <div key={dim.Id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Checkbox
                    id={`dim-${dim.Id}`}
                    checked={selectedDimensionIds.has(dim.Id)}
                    onCheckedChange={(checked) => handleDimensionToggle(dim, checked === true)}
                  />
                  <label htmlFor={`dim-${dim.Id}`} className="flex-1 cursor-pointer">
                    <span className="font-medium text-foreground">{dim.Name}</span>
                    <span className="text-sm text-muted-foreground ml-2">({dim.Code})</span>
                  </label>
                </div>
              ))}

              <Button type="button" onClick={handleSaveDimensions} className="mt-2">
                <Save className="w-4 h-4 mr-2" />
                Save Dimension Settings
              </Button>
            </div>
          )}

          {requiredDimensions.length > 0 && dimensions.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Currently required dimensions:</p>
              {requiredDimensions.map((dim) => (
                <div key={dim.id} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="font-medium">{dim.name}</span>
                  <span className="text-muted-foreground">({dim.code})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-muted rounded-lg space-y-3">
          <h3 className="font-medium text-foreground">Configuration Options</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Option 1 (File-based):</strong> Create <code className="bg-background px-1 rounded">app-config.local.json</code> in 
              the public folder based on <code className="bg-background px-1 rounded">app-config.example.json</code>.
            </p>
            <p>
              <strong>Option 2 (UI-based):</strong> Enter credentials above. They will be saved to localStorage.
            </p>
            <p className="text-xs">
              File-based configuration takes precedence unless overridden here.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
