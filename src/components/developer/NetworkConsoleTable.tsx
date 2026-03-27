/**
 * Network Console Table Component
 * 
 * Displays API logs in a filterable, sortable table.
 */

import { useState, useMemo } from 'react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, ChevronRight } from 'lucide-react';
import { ApiLogEntry, LogFilter } from '@/lib/logger';
import { cn } from '@/lib/utils';

interface NetworkConsoleTableProps {
  logs: ApiLogEntry[];
  onSelectLog: (log: ApiLogEntry) => void;
  isLoading?: boolean;
}

const FEATURE_AREAS = [
  { value: 'all', label: 'All Features' },
  { value: 'tenants', label: 'Tenants' },
  { value: 'bank-accounts', label: 'Bank Accounts' },
  { value: 'financial-years', label: 'Financial Years' },
  { value: 'transactions', label: 'Transactions' },
  { value: 'reports', label: 'Reports' },
  { value: 'auth', label: 'Auth' },
];

const STATUS_RANGES = [
  { value: 'all', label: 'All Status' },
  { value: '2xx', label: '2xx Success' },
  { value: '4xx', label: '4xx Client Error' },
  { value: '5xx', label: '5xx Server Error' },
  { value: 'error', label: '0 (Error)' },
];

export function NetworkConsoleTable({ logs, onSelectLog, isLoading }: NetworkConsoleTableProps) {
  const [endpointSearch, setEndpointSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [featureFilter, setFeatureFilter] = useState('all');

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Endpoint search
      if (endpointSearch && !log.url.toLowerCase().includes(endpointSearch.toLowerCase())) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'error' && log.status !== 0) return false;
        if (statusFilter === '2xx' && (log.status < 200 || log.status >= 300)) return false;
        if (statusFilter === '4xx' && (log.status < 400 || log.status >= 500)) return false;
        if (statusFilter === '5xx' && (log.status < 500 || log.status >= 600)) return false;
      }

      // Feature filter
      if (featureFilter !== 'all' && log.featureArea !== featureFilter) {
        return false;
      }

      return true;
    });
  }, [logs, endpointSearch, statusFilter, featureFilter]);

  const clearFilters = () => {
    setEndpointSearch('');
    setStatusFilter('all');
    setFeatureFilter('all');
  };

  const hasFilters = endpointSearch || statusFilter !== 'all' || featureFilter !== 'all';

  const getStatusColor = (status: number) => {
    if (status === 0) return 'bg-warning/10 text-warning';
    if (status >= 200 && status < 300) return 'bg-success/10 text-success';
    if (status >= 400 && status < 500) return 'bg-destructive/10 text-destructive';
    if (status >= 500) return 'bg-destructive/10 text-destructive';
    return 'bg-muted text-foreground';
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      case 'POST': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'PUT': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'DELETE': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'PATCH': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const truncateUrl = (url: string, maxLength: number = 60) => {
    if (url.length <= maxLength) return url;
    
    // Try to keep the path visible
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname + urlObj.search;
      if (path.length > maxLength) {
        return '...' + path.slice(-maxLength + 3);
      }
      return path;
    } catch {
      return '...' + url.slice(-maxLength + 3);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search endpoints..."
            value={endpointSearch}
            onChange={(e) => setEndpointSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_RANGES.map(range => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={featureFilter} onValueChange={setFeatureFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Feature" />
          </SelectTrigger>
          <SelectContent>
            {FEATURE_AREAS.map(area => (
              <SelectItem key={area.value} value={area.value}>
                {area.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredLogs.length} of {logs.length} requests
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[140px]">Time</TableHead>
              <TableHead className="w-[80px]">Method</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[80px]">Duration</TableHead>
              <TableHead className="w-[100px]">Feature</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading logs...
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {hasFilters ? 'No logs match your filters' : 'No API calls logged yet'}
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow
                  key={log.id || log.requestId}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectLog(log)}
                >
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded",
                      getMethodColor(log.method)
                    )}>
                      {log.method}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs truncate max-w-[300px]" title={log.url}>
                    {truncateUrl(log.url)}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded",
                      getStatusColor(log.status)
                    )}>
                      {log.status === 0 ? 'ERR' : log.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.durationMs}ms
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground capitalize">
                    {log.featureArea}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
