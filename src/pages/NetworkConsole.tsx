/**
 * Network Console Page
 * 
 * Displays all API logs with filtering, details drawer, and export/clear actions.
 * Only accessible when Developer Mode is ON.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useDeveloperMode } from '@/contexts/DeveloperModeContext';
import { NetworkConsoleTable } from '@/components/developer/NetworkConsoleTable';
import { LogDetailDrawer } from '@/components/developer/LogDetailDrawer';
import { getAllLogs, clearAllLogs, exportLogsToFile, ApiLogEntry, getLogCount } from '@/lib/logger';
import { Download, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function NetworkConsole() {
  const navigate = useNavigate();
  const { isDeveloperMode } = useDeveloperMode();
  const { toast } = useToast();
  
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ApiLogEntry | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [logCount, setLogCount] = useState(0);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const allLogs = await getAllLogs();
      setLogs(allLogs);
      const count = await getLogCount();
      setLogCount(count);
    } catch (error) {
      console.error('Failed to load logs:', error);
      toast({
        title: 'Error loading logs',
        description: 'Failed to load API logs from storage.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isDeveloperMode) {
      navigate('/');
      return;
    }
    loadLogs();
  }, [isDeveloperMode, navigate, loadLogs]);

  const handleSelectLog = (log: ApiLogEntry) => {
    setSelectedLog(log);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedLog(null);
  };

  const handleExportLogs = () => {
    if (logs.length === 0) {
      toast({
        title: 'No logs to export',
        description: 'There are no API logs to export.',
      });
      return;
    }
    
    exportLogsToFile(logs);
    toast({
      title: 'Logs exported',
      description: `Exported ${logs.length} log entries.`,
    });
  };

  const handleClearLogs = async () => {
    try {
      await clearAllLogs();
      setLogs([]);
      setLogCount(0);
      toast({
        title: 'Logs cleared',
        description: 'All API logs have been deleted.',
      });
    } catch (error) {
      toast({
        title: 'Error clearing logs',
        description: 'Failed to clear API logs.',
        variant: 'destructive',
      });
    }
  };

  if (!isDeveloperMode) {
    return null;
  }

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Network Console</h1>
            <p className="text-muted-foreground">
              View and analyze all API calls ({logCount} total)
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadLogs}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportLogs}>
              <Download className="w-4 h-4 mr-2" />
              Export Logs
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Logs
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Clear all logs?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {logCount} API log entries from IndexedDB. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearLogs}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Clear All Logs
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Developer Mode Badge */}
        <div className="mb-6 p-3 bg-primary/10 border border-primary/20 rounded-lg inline-flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-medium text-primary">Developer Mode Active</span>
        </div>

        {/* Network Console Table */}
        <NetworkConsoleTable
          logs={logs}
          onSelectLog={handleSelectLog}
          isLoading={isLoading}
        />

        {/* Log Detail Drawer */}
        <LogDetailDrawer
          log={selectedLog}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
        />
      </div>
    </MainLayout>
  );
}
