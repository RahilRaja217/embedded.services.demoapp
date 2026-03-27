import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/contexts/AppContext';
import { useDeveloperMode } from '@/contexts/DeveloperModeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Building2, 
  CheckCircle2,
  Clock,
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
import { subscriptionService } from '@/services/subscriptionService';
import { getConfig, hasValidCredentials } from '@/lib/configManager';
import { Credentials } from '@/types/sage';

export default function Tenants() {
  const { tenants, activeTenantId, addTenant, setActiveTenant } = useApp();
  const { isDeveloperMode } = useDeveloperMode();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [loadedCredentials, setLoadedCredentials] = useState<Credentials | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
  });

  // Load credentials from configManager on mount
  useEffect(() => {
    async function loadCredentials() {
      const config = await getConfig();
      setLoadedCredentials(config.credentials);
    }
    loadCredentials();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hasValidCredentials(loadedCredentials)) {
      toast({
        title: "Configuration required",
        description: "Please configure your API credentials in Admin Settings first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setLoadingStatus('Creating tenant...');
    
    try {
      // Call real API with loaded credentials, passing status callback
      const response = await subscriptionService.createTenant(
        formData, 
        loadedCredentials!,
        (status) => setLoadingStatus(status)
      );
      
      // Add to local state using the ID returned from the Sage API (GUID)
      const tenant = addTenant({
        id: response.id, // Use the GUID from Sage API response
        name: formData.name,
        businessName: formData.businessName,
      });
      setActiveTenant(response.id);
      
      setFormData({ name: '', businessName: '' });
      setIsDialogOpen(false);
      toast({
        title: "Tenant created",
        description: `${formData.businessName} has been created successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to create tenant",
        description: error.message || "An error occurred while creating the tenant.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="page-header mb-0">
            <h1 className="page-title">Tenants</h1>
            <p className="page-description">
              Manage your business tenants
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Tenant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Tenant</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Contact Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., John Smith"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                    placeholder="e.g., Smith's Consulting Ltd"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isLoading && loadingStatus ? loadingStatus : 'Create Tenant'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tenants List */}
        {tenants.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No tenants yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first tenant to get started with the demo.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Tenant
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((tenant) => {
              const isActive = tenant.id === activeTenantId;
              return (
                <div
                  key={tenant.id}
                  className={cn(
                    "bg-card rounded-xl border p-5 transition-all cursor-pointer",
                    isActive 
                      ? "border-primary shadow-md" 
                      : "border-border hover:border-primary/50 hover:shadow-sm"
                  )}
                  onClick={() => setActiveTenant(tenant.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    {isActive && (
                      <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </span>
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-foreground mb-1">{tenant.businessName}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{tenant.name}</p>
                  
                  {/* Show Tenant ID in Developer Mode */}
                  {isDeveloperMode && (
                    <div className="mb-3 p-2 bg-muted rounded text-xs font-mono text-muted-foreground break-all">
                      <span className="text-foreground/60">ID:</span> {tenant.id}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Created {new Date(tenant.createdAt).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* API Integration Panel - Only visible in Developer Mode */}
        {isDeveloperMode && (
          <div className="mt-8">
            <ApiIntegrationPanel featureArea="tenants" />
          </div>
        )}

        {/* API Info - Always visible */}
        {!isDeveloperMode && (
          <div className="mt-8 p-4 bg-muted rounded-lg">
            <h3 className="font-medium text-foreground mb-2">API Integration</h3>
            <p className="text-sm text-muted-foreground">
              Tenants are created via the <code className="bg-background px-1 rounded">POST /subscriptions/tenants</code> endpoint 
              using the subscription service token.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
