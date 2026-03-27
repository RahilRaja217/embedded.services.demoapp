import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Landmark, 
  Calendar, 
  Upload, 
  FileText, 
  Settings,
  LogOut,
  Terminal
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useDeveloperMode } from '@/contexts/DeveloperModeContext';
import { DeveloperModeToggle } from '@/components/developer/DeveloperModeToggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/tenants', label: 'Tenants', icon: Building2 },
  { path: '/bank-accounts', label: 'Bank Accounts', icon: Landmark },
  { path: '/financial-years', label: 'Financial Years', icon: Calendar },
  { path: '/transactions', label: 'Transactions', icon: Upload },
  { path: '/reports', label: 'P&L Report', icon: FileText },
  { path: '/admin', label: 'Admin Settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { tenants, activeTenantId, setActiveTenant, logout } = useApp();
  const { isDeveloperMode } = useDeveloperMode();

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-screen fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-lg">S</span>
          </div>
          <div>
            <h1 className="font-bold text-lg">Sage Demo</h1>
            <p className="text-xs text-sidebar-foreground/60">Embedded Services</p>
          </div>
        </div>
      </div>

      {/* Tenant Selector */}
      {tenants.length > 0 && (
        <div className="px-4 py-4 border-b border-sidebar-border">
          <label className="text-xs text-sidebar-foreground/60 mb-2 block">Active Tenant</label>
          <Select value={activeTenantId || ''} onValueChange={setActiveTenant}>
            <SelectTrigger className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
              <SelectValue placeholder="Select tenant" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.businessName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Show Active Tenant ID in Developer Mode */}
          {isDeveloperMode && activeTenantId && (
            <div className="mt-2 p-2 bg-sidebar-accent/50 rounded text-xs font-mono text-sidebar-foreground/70 break-all">
              {activeTenantId}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          
          {/* Network Console - only visible in Developer Mode */}
          {isDeveloperMode && (
            <li>
              <Link
                to="/network-console"
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === '/network-console'
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Terminal className="w-5 h-5" />
                Network Console
              </Link>
            </li>
          )}
        </ul>
      </nav>

      {/* Developer Mode Toggle */}
      <div className="px-3 py-2 border-t border-sidebar-border">
        <DeveloperModeToggle />
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
