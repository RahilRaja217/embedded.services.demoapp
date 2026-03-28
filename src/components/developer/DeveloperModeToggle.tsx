/**
 * Developer Mode Toggle Component
 * 
 * A toggle switch for enabling/disabling Developer Mode in the sidebar.
 */

import { Code2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useDeveloperMode } from '@/contexts/DeveloperModeContext';

export function DeveloperModeToggle() {
  const { isDeveloperMode, toggleDeveloperMode } = useDeveloperMode();

  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Code2 className="w-5 h-5 text-sidebar-foreground/80" />
        <span className="text-sm font-medium text-sidebar-foreground/80">
          Developer Mode
        </span>
      </div>
      <Switch
        checked={isDeveloperMode}
        onCheckedChange={toggleDeveloperMode}
        className="data-[state=checked]:bg-sidebar-primary"
      />
    </div>
  );
}
