'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Server,
  Activity,
  Shield,
  Settings,
  FileText,
  RefreshCw,
  Plus,
  CheckCircle2,
  Clock,
  Zap,
  Globe,
  Lock,
  Search,
  Filter,
  Download,
  Brain,
  Cpu,
  Network,
  TrendingUp,
  AlertCircle,
  Terminal,
  Database,
  Eye,
  ChevronRight,
  Sparkles,
  Radar,
  XCircle,
  Loader2,
  RotateCcw,
  X,
  MapPin,
  Monitor,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface Alarm {
  id: string;
  severity: string;
  alarmName: string;
  alarmCode: string;
  description?: string;
  status: string;
  networkElement?: { name: string; hostname: string };
  firstSeen: string;
  lastSeen: string;
  count: number;
}

interface NetworkElement {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  vendor: string;
  elementType: string;
  status: string;
  site?: string;
  region?: string;
  model?: string;
  capabilities?: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  logLevel: string;
  message: string;
  source?: string;
  logType: string;
}

interface ProvisioningTask {
  id: string;
  taskType: string;
  status: string;
  priority: string;
  description?: string;
  networkElement?: { name: string; hostname: string; id?: string };
  createdAt: string;
}

interface AgentStatus {
  name: string;
  type: string;
  status: string;
  tasks_processed: number;
  tasks_pending: number;
  last_activity: string;
  cpu_usage: number;
  memory_usage_mb: number;
  uptime_seconds: number;
  events_per_minute: number;
}

interface SecurityEvent {
  id: string;
  action: string;
  userId?: string;
  user?: { name?: string; email?: string };
  resource?: string;
  resourceType?: string;
  result?: string;
  riskLevel?: string;
  ipAddress?: string;
  timestamp: string;
  details?: string;
}

interface DiscoveryResult {
  success: boolean;
  interfaces: Array<{ name: string; interface: string; address: string; netmask: string; mac: string; cidr: string }>;
  gateway: string;
  subnet: string;
  discoveredDevices: Array<{
    hostname: string;
    ipAddress: string;
    vendor: string;
    elementType: string;
    status: string;
    macAddress: string;
    responseTimeMs: number;
  }>;
  totalDevices: number;
  activeDevices: number;
  scanTime: string;
  timestamp: string;
}

// ── Color maps ─────────────────────────────────────────────────────────────
const severityColors: Record<string, string> = {
  critical: 'bg-red-500 text-white border-red-600',
  major: 'bg-orange-500 text-white border-orange-600',
  minor: 'bg-yellow-500 text-black border-yellow-600',
  warning: 'bg-blue-500 text-white border-blue-600',
  info: 'bg-slate-500 text-white border-slate-600',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500 shadow-emerald-500/50',
  inactive: 'bg-slate-400',
  maintenance: 'bg-amber-500',
  unknown: 'bg-slate-300',
};

const vendorColors: Record<string, string> = {
  cisco: 'from-cyan-500 to-blue-600',
  huawei: 'from-red-500 to-rose-600',
  nokia: 'from-blue-500 to-indigo-600',
  juniper: 'from-purple-500 to-violet-600',
  ericsson: 'from-amber-500 to-orange-600',
  'tp-link': 'from-green-500 to-teal-600',
};

const riskColors: Record<string, string> = {
  high: 'text-red-400 border-red-500/50',
  medium: 'text-amber-400 border-amber-500/50',
  low: 'text-emerald-400 border-emerald-500/50',
  info: 'text-slate-400 border-slate-500/50',
};

// ── Helpers ────────────────────────────────────────────────────────────────
const timeAgo = (date: string) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const downloadCSV = (data: Record<string, unknown>[], filename: string) => {
  if (data.length === 0) { toast.error('No data to export'); return; }
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = String(row[h] ?? '');
      return val.includes(',') ? `"${val}"` : val;
    }).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${data.length} records`);
};

// ── Spinner component ─────────────────────────────────────────────────────
function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} />;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function NetsAISecurityDashboard() {
  // ── Data state ───────────────────────────────────────────────────────────
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [networkElements, setNetworkElements] = useState<NetworkElement[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tasks, setTasks] = useState<ProvisioningTask[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [agentSystem, setAgentSystem] = useState<Record<string, unknown> | null>(null);
  const [telecomServices, setTelecomServices] = useState<Record<string, { health: Record<string, unknown>; config: Record<string, unknown> }>>({});
  const [telecomSummary, setTelecomSummary] = useState<Record<string, unknown> | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Alarm filters
  const [alarmSeverityFilter, setAlarmSeverityFilter] = useState('all');
  const [alarmStatusFilter, setAlarmStatusFilter] = useState('all');

  // Network filters
  const [networkVendorFilter, setNetworkVendorFilter] = useState('all');
  const [networkStatusFilter, setNetworkStatusFilter] = useState('all');

  // Log filters
  const [logLevelFilter, setLogLevelFilter] = useState('all');
  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Provisioning filters
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all');

  // Security filters
  const [securityActionFilter, setSecurityActionFilter] = useState('all');
  const [securityRiskFilter, setSecurityRiskFilter] = useState('all');

  // Dialog states
  const [addElementOpen, setAddElementOpen] = useState(false);
  const [elementDetailOpen, setElementDetailOpen] = useState(false);
  const [selectedElement, setSelectedElement] = useState<NetworkElement | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);

  // Form states
  const [addElementForm, setAddElementForm] = useState({ name: '', hostname: '', ipAddress: '', vendor: '', elementType: '', site: '', region: '' });
  const [newTaskForm, setNewTaskForm] = useState({ networkElementId: '', taskType: '', priority: 'medium', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // ── Fetch all data ───────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [alarmsRes, elementsRes, logsRes, tasksRes, agentsRes, telecomRes, securityRes] = await Promise.all([
        fetch('/api/alarms?limit=50'),
        fetch('/api/network-elements?limit=50'),
        fetch('/api/logs?limit=100'),
        fetch('/api/provisioning?limit=50'),
        fetch('/api/agents'),
        fetch('/api/telecom-services'),
        fetch('/api/security?limit=50'),
      ]);
      const [alarmsData, elementsData, logsData, tasksData, agentsData, telecomData, securityData] = await Promise.all([
        alarmsRes.json(), elementsRes.json(), logsRes.json(), tasksRes.json(), agentsRes.json(), telecomRes.json(), securityRes.json(),
      ]);
      if (alarmsData.success) setAlarms(alarmsData.data);
      if (elementsData.success) setNetworkElements(elementsData.data);
      if (logsData.success) setLogs(logsData.data);
      if (tasksData.success) setTasks(tasksData.data);
      if (agentsData.success) { setAgents(agentsData.agents); setAgentSystem(agentsData.system); }
      if (telecomData.success) { setTelecomServices(telecomData.services); setTelecomSummary(telecomData.summary); }
      if (securityData.success) setSecurityEvents(securityData.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch logs with filters
  const fetchFilteredLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (logLevelFilter !== 'all') params.set('logLevel', logLevelFilter);
      if (logTypeFilter !== 'all') params.set('logType', logTypeFilter);
      if (logSearchQuery) params.set('q', logSearchQuery);
      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      if (data.success) setLogs(data.data);
    } catch { toast.error('Failed to filter logs'); }
  }, [logLevelFilter, logTypeFilter, logSearchQuery]);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 30000); return () => clearInterval(iv); }, [fetchData]);
  useEffect(() => { fetchFilteredLogs(); }, [fetchFilteredLogs]);

  // ── Alarm actions ────────────────────────────────────────────────────────
  const acknowledgeAlarm = async (id: string) => {
    const res = await fetch('/api/alarms', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'acknowledge', acknowledgedBy: 'admin' }) });
    const data = await res.json();
    if (data.success) { toast.success('Alarm acknowledged'); fetchData(); }
    else toast.error(data.error || 'Failed to acknowledge alarm');
  };
  const clearAlarm = async (id: string) => {
    const res = await fetch('/api/alarms', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'clear', acknowledgedBy: 'admin' }) });
    const data = await res.json();
    if (data.success) { toast.success('Alarm cleared'); fetchData(); }
    else toast.error(data.error || 'Failed to clear alarm');
  };

  // ── Add element ──────────────────────────────────────────────────────────
  const handleAddElement = async () => {
    if (!addElementForm.name || !addElementForm.hostname || !addElementForm.ipAddress || !addElementForm.vendor || !addElementForm.elementType) {
      toast.error('Please fill in all required fields'); return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/network-elements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addElementForm) });
      const data = await res.json();
      if (data.success) { toast.success(`Element "${addElementForm.name}" created`); setAddElementOpen(false); setAddElementForm({ name: '', hostname: '', ipAddress: '', vendor: '', elementType: '', site: '', region: '' }); fetchData(); }
      else toast.error(data.error || 'Failed to create element');
    } catch { toast.error('Network error'); } finally { setIsSubmitting(false); }
  };

  // ── New provisioning task ────────────────────────────────────────────────
  const handleNewTask = async () => {
    if (!newTaskForm.networkElementId || !newTaskForm.taskType) { toast.error('Please select element and task type'); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/provisioning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTaskForm) });
      const data = await res.json();
      if (data.success) { toast.success('Task created and queued'); setNewTaskOpen(false); setNewTaskForm({ networkElementId: '', taskType: '', priority: 'medium', description: '' }); fetchData(); }
      else toast.error(data.error || 'Failed to create task');
    } catch { toast.error('Network error'); } finally { setIsSubmitting(false); }
  };

  // ── Cancel / retry task ──────────────────────────────────────────────────
  const handleTaskAction = async (id: string, action: string) => {
    const res = await fetch('/api/provisioning', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    const data = await res.json();
    if (data.success) { toast.success(`Task ${action} successful`); fetchData(); }
    else toast.error(data.error || `Failed to ${action} task`);
  };

  // ── Network discovery ────────────────────────────────────────────────────
  const handleScanNetwork = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/network-discovery');
      const data = await res.json();
      if (data.success) { setDiscoveryResult(data); toast.success(`Scan complete: ${data.totalDevices} devices found`); }
      else toast.error('Discovery failed');
    } catch { toast.error('Network discovery error'); } finally { setIsScanning(false); }
  };

  // ── Computed / filtered data ─────────────────────────────────────────────
  const filteredAlarms = alarms.filter(a => {
    if (alarmSeverityFilter !== 'all' && a.severity !== alarmSeverityFilter) return false;
    if (alarmStatusFilter !== 'all' && a.status !== alarmStatusFilter) return false;
    return true;
  });

  const filteredElements = networkElements.filter(e => {
    if (networkVendorFilter !== 'all' && e.vendor !== networkVendorFilter) return false;
    if (networkStatusFilter !== 'all' && e.status !== networkStatusFilter) return false;
    return true;
  });

  const filteredTasks = tasks.filter(t => {
    if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false;
    if (taskPriorityFilter !== 'all' && t.priority !== taskPriorityFilter) return false;
    return true;
  });

  const filteredSecurity = securityEvents.filter(e => {
    if (securityActionFilter !== 'all' && e.action !== securityActionFilter) return false;
    if (securityRiskFilter !== 'all' && e.riskLevel !== securityRiskFilter) return false;
    return true;
  });

  // Search across all data for overview
  const searchLower = searchQuery.toLowerCase();
  const searchMatches = searchQuery ? {
    alarms: alarms.filter(a => a.alarmName.toLowerCase().includes(searchLower) || a.alarmCode.toLowerCase().includes(searchLower)),
    elements: networkElements.filter(e => e.name.toLowerCase().includes(searchLower) || e.hostname.toLowerCase().includes(searchLower) || e.ipAddress.includes(searchLower)),
    logs: logs.filter(l => l.message.toLowerCase().includes(searchLower)),
    tasks: tasks.filter(t => t.taskType.toLowerCase().includes(searchLower) || (t.networkElement?.name || '').toLowerCase().includes(searchLower)),
  } : null;

  const stats = {
    totalElements: networkElements.length,
    activeElements: networkElements.filter(e => e.status === 'active').length,
    criticalAlarms: alarms.filter(a => a.severity === 'critical').length,
    totalAlarms: alarms.length,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Spinner className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading NetOps Guardian AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl blur-lg opacity-50" />
                <div className="relative bg-gradient-to-r from-emerald-500 to-cyan-500 p-2.5 rounded-xl">
                  <Shield className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold">
                  <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">Net&apos;s AI</span>
                  <span className="text-white ml-1">Security Agent</span>
                </h1>
                <p className="text-xs text-slate-400 flex items-center gap-2">
                  <Brain className="w-3 h-3" />Multi-Vendor Network Operations Center
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input placeholder="Search all data..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-9 bg-slate-800/50 border-slate-700 focus:border-emerald-500/50" />
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Clock className="w-4 h-4" /><span>{lastUpdate.toLocaleTimeString()}</span>
              </div>
              <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}
                className="border-slate-700 hover:bg-slate-800 hover:border-emerald-500/50">
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 px-3 py-1">
                <Lock className="w-3 h-3 mr-1.5" />Zero Trust
              </Badge>
              <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-medium">AD</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border border-slate-700/50 mb-6 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/20 data-[state=active]:to-cyan-500/20 data-[state=active]:text-emerald-400">
              <Activity className="w-4 h-4 mr-2" />Overview
            </TabsTrigger>
            <TabsTrigger value="alarms" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
              <AlertTriangle className="w-4 h-4 mr-2" />Alarms
              {stats.criticalAlarms > 0 && <Badge className="ml-2 bg-red-500 text-white text-xs px-1.5">{stats.criticalAlarms}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="network" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Network className="w-4 h-4 mr-2" />Network
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400">
              <FileText className="w-4 h-4 mr-2" />Logs
            </TabsTrigger>
            <TabsTrigger value="provisioning" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              <Settings className="w-4 h-4 mr-2" />Provisioning
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-400">
              <Shield className="w-4 h-4 mr-2" />Security
            </TabsTrigger>
            <TabsTrigger value="telecom" className="data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-400">
              <Cpu className="w-4 h-4 mr-2" />Telecom
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════ OVERVIEW TAB ═══════════════════ */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Network Elements', value: stats.totalElements, sub: `${stats.activeElements} active`, icon: <Network className="w-7 h-7 text-emerald-400" />, gradient: 'from-emerald-500/20 to-cyan-500/20', border: 'hover:border-emerald-500/30', text: 'from-emerald-400 to-cyan-400', subColor: 'text-emerald-400' },
                { label: 'Active Alarms', value: stats.totalAlarms, sub: `${stats.criticalAlarms} critical`, icon: <AlertTriangle className="w-7 h-7 text-red-400" />, gradient: 'from-red-500/20 to-orange-500/20', border: 'hover:border-red-500/30', text: '', subColor: 'text-red-400' },
                { label: 'Log Events (24h)', value: logs.length, sub: 'Events processed', icon: <Database className="w-7 h-7 text-violet-400" />, gradient: 'from-violet-500/20 to-purple-500/20', border: 'hover:border-violet-500/30', text: '', subColor: 'text-slate-500' },
                { label: 'Pending Tasks', value: stats.pendingTasks, sub: 'In queue', icon: <Cpu className="w-7 h-7 text-amber-400" />, gradient: 'from-amber-500/20 to-orange-500/20', border: 'hover:border-amber-500/30', text: '', subColor: 'text-slate-500' },
              ].map((s, i) => (
                <Card key={i} className={`bg-slate-800/30 border-slate-700/50 backdrop-blur-sm ${s.border} transition-all duration-300 group`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm">{s.label}</p>
                        <p className={`text-3xl font-bold mt-1 ${s.text ? `bg-gradient-to-r ${s.text} bg-clip-text text-transparent` : (i === 1 ? 'text-red-400' : i === 2 ? 'text-violet-400' : 'text-amber-400')}`}>{s.value}</p>
                        <p className={`text-xs ${s.subColor} mt-1`}>{s.sub}</p>
                      </div>
                      <div className={`bg-gradient-to-br ${s.gradient} p-3 rounded-xl group-hover:scale-110 transition-transform`}>{s.icon}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Search Results */}
            {searchQuery && searchMatches && (
              <Card className="bg-slate-800/30 border-emerald-500/30 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2"><Search className="w-5 h-5 text-emerald-400" />Search Results</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="text-slate-400"><X className="w-4 h-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-96">
                    <div className="space-y-2">
                      {searchMatches.alarms.length > 0 && <p className="text-xs text-slate-500 font-medium">ALARMS ({searchMatches.alarms.length})</p>}
                      {searchMatches.alarms.slice(0, 3).map(a => (
                        <div key={a.id} className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50 text-sm">
                          <Badge className={severityColors[a.severity]}>{a.severity.toUpperCase()}</Badge>
                          <span className="ml-2">{a.alarmName}</span>
                        </div>
                      ))}
                      {searchMatches.elements.length > 0 && <p className="text-xs text-slate-500 font-medium mt-2">NETWORK ({searchMatches.elements.length})</p>}
                      {searchMatches.elements.slice(0, 3).map(e => (
                        <div key={e.id} className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50 text-sm flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-cyan-400" />{e.name} ({e.ipAddress})
                        </div>
                      ))}
                      {searchMatches.logs.length > 0 && <p className="text-xs text-slate-500 font-medium mt-2">LOGS ({searchMatches.logs.length})</p>}
                      {searchMatches.logs.slice(0, 3).map(l => (
                        <div key={l.id} className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50 text-xs font-mono text-slate-300">{l.message}</div>
                      ))}
                      {searchMatches.alarms.length + searchMatches.elements.length + searchMatches.logs.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-4">No results found</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Agent Status */}
              <Card className="bg-slate-800/30 border-slate-700/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="w-5 h-5 text-violet-400" />AI Agent Status<Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {agents.map((agent, idx) => (
                      <div key={idx} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{agent.name}</span>
                          <Badge className={`${agent.status === 'running' || agent.status === 'processing' ? 'bg-emerald-500/20 text-emerald-400' : agent.status === 'idle' ? 'bg-slate-500/20 text-slate-400' : 'bg-red-500/20 text-red-400'} text-xs`}>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${agent.status === 'running' || agent.status === 'processing' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                            {agent.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                          <div><span className="text-slate-500">Pending</span><p className="text-white font-medium">{agent.tasks_pending}</p></div>
                          <div><span className="text-slate-500">CPU</span><p className={`${agent.cpu_usage > 70 ? 'text-amber-400' : 'text-white'} font-medium`}>{agent.cpu_usage}%</p></div>
                          <div><span className="text-slate-500">Memory</span><p className="text-white font-medium">{agent.memory_usage_mb}MB</p></div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Progress value={agent.cpu_usage} className="h-1 flex-1 bg-slate-700 [&>div]:bg-cyan-500" />
                          <Progress value={(agent.memory_usage_mb / 1024) * 100} className="h-1 flex-1 bg-slate-700 [&>div]:bg-violet-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Critical Alarms */}
              <Card className="bg-slate-800/30 border-slate-700/50 backdrop-blur-sm lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-400" />Critical Alarms</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('alarms')} className="text-slate-400 hover:text-white">View All <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {alarms.filter(a => a.severity === 'critical' || a.severity === 'major').length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" /><p>No critical alarms</p><p className="text-xs text-slate-600">All systems operational</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {alarms.filter(a => a.severity === 'critical' || a.severity === 'major').slice(0, 5).map(alarm => (
                          <div key={alarm.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 hover:border-red-500/30 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={severityColors[alarm.severity]}>{alarm.severity.toUpperCase()}</Badge>
                                  <span className="text-sm font-medium">{alarm.alarmName}</span>
                                </div>
                                <p className="text-xs text-slate-400">{alarm.networkElement?.name} &bull; {alarm.alarmCode}</p>
                                <p className="text-xs text-slate-500 mt-1">{timeAgo(alarm.firstSeen)} &bull; Count: {alarm.count}</p>
                              </div>
                              <div className="flex gap-2">
                                {alarm.status === 'active' && (
                                  <Button size="sm" variant="ghost" onClick={() => acknowledgeAlarm(alarm.id)} className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">ACK</Button>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => clearAlarm(alarm.id)} className="text-slate-400 hover:text-white hover:bg-slate-500/10">Clear</Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Vendor Distribution */}
              <Card className="bg-slate-800/30 border-slate-700/50 backdrop-blur-sm">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Globe className="w-5 h-5 text-cyan-400" />Vendor Distribution</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {['cisco', 'huawei', 'nokia', 'juniper', 'ericsson', 'tp-link'].map(vendor => {
                      const count = networkElements.filter(e => e.vendor === vendor).length;
                      const pct = stats.totalElements > 0 ? (count / stats.totalElements) * 100 : 0;
                      return (
                        <div key={vendor} className="space-y-2">
                          <div className="flex items-center justify-between text-sm"><span className="capitalize font-medium">{vendor}</span><span className="text-slate-400">{count} devices</span></div>
                          <div className="relative h-2 bg-slate-700/50 rounded-full overflow-hidden">
                            <div className={`absolute inset-y-0 left-0 bg-gradient-to-r ${vendorColors[vendor] || 'from-slate-500 to-slate-600'} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Logs */}
              <Card className="bg-slate-800/30 border-slate-700/50 backdrop-blur-sm">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Terminal className="w-5 h-5 text-violet-400" />Recent Activity</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-2 font-mono text-xs">
                      {logs.slice(0, 10).map(log => (
                        <div key={log.id} className="flex items-start gap-2 p-2 rounded hover:bg-slate-700/30">
                          <Badge variant="outline" className={`shrink-0 ${log.logLevel === 'error' ? 'text-red-400 border-red-500/50' : log.logLevel === 'warning' ? 'text-amber-400 border-amber-500/50' : 'text-slate-400 border-slate-500/50'}`}>{log.logLevel.toUpperCase()}</Badge>
                          <span className="text-slate-300 truncate flex-1">{log.message}</span>
                          <span className="text-slate-600 shrink-0">{timeAgo(log.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══════════════════ ALARMS TAB ═══════════════════ */}
          <TabsContent value="alarms" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold">Alarm Management</h2>
              <div className="flex gap-2 flex-wrap">
                <Select value={alarmSeverityFilter} onValueChange={setAlarmSeverityFilter}>
                  <SelectTrigger className="w-36 bg-slate-800/50 border-slate-700 text-sm"><SelectValue placeholder="Severity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    {['critical', 'major', 'minor', 'warning', 'info'].map(s => <SelectItem key={s} value={s}><span className="capitalize">{s}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={alarmStatusFilter} onValueChange={setAlarmStatusFilter}>
                  <SelectTrigger className="w-36 bg-slate-800/50 border-slate-700 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {['active', 'acknowledged', 'cleared'].map(s => <SelectItem key={s} value={s}><span className="capitalize">{s}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800" onClick={() => downloadCSV(filteredAlarms as unknown as Record<string, unknown>[], `alarms-${Date.now()}.csv`)}>
                  <Download className="w-4 h-4 mr-2" />Export CSV
                </Button>
              </div>
            </div>
            <Card className="bg-slate-800/30 border-slate-700/50 backdrop-blur-sm">
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <table className="w-full">
                    <thead className="bg-slate-800/50 sticky top-0">
                      <tr>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Severity</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Alarm</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Element</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Time</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlarms.map(alarm => (
                        <tr key={alarm.id} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                          <td className="p-4"><Badge className={severityColors[alarm.severity]}>{alarm.severity.toUpperCase()}</Badge></td>
                          <td className="p-4"><div><p className="font-medium">{alarm.alarmName}</p><p className="text-xs text-slate-400">{alarm.alarmCode}</p></div></td>
                          <td className="p-4"><div><p className="text-sm">{alarm.networkElement?.name}</p><p className="text-xs text-slate-400">{alarm.networkElement?.hostname}</p></div></td>
                          <td className="p-4">
                            <Badge variant="outline" className={alarm.status === 'active' ? 'text-red-400 border-red-500/50' : alarm.status === 'acknowledged' ? 'text-amber-400 border-amber-500/50' : 'text-emerald-400 border-emerald-500/50'}>{alarm.status}</Badge>
                          </td>
                          <td className="p-4 text-sm text-slate-400">{timeAgo(alarm.firstSeen)}</td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              {alarm.status === 'active' && <Button size="sm" variant="ghost" onClick={() => acknowledgeAlarm(alarm.id)} className="text-emerald-400 hover:text-emerald-300">ACK</Button>}
                              <Button size="sm" variant="ghost" onClick={() => clearAlarm(alarm.id)} className="text-slate-400 hover:text-white">Clear</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredAlarms.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No alarms matching filter</td></tr>}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════ NETWORK TAB ═══════════════════ */}
          <TabsContent value="network" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold">Network Elements</h2>
              <div className="flex gap-2 flex-wrap">
                <Select value={networkVendorFilter} onValueChange={setNetworkVendorFilter}>
                  <SelectTrigger className="w-36 bg-slate-800/50 border-slate-700 text-sm"><SelectValue placeholder="Vendor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vendors</SelectItem>
                    {['cisco', 'huawei', 'nokia', 'juniper', 'ericsson', 'tp-link'].map(v => <SelectItem key={v} value={v}><span className="capitalize">{v}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={networkStatusFilter} onValueChange={setNetworkStatusFilter}>
                  <SelectTrigger className="w-36 bg-slate-800/50 border-slate-700 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {['active', 'inactive', 'maintenance', 'unknown'].map(s => <SelectItem key={s} value={s}><span className="capitalize">{s}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="border-slate-700 hover:bg-slate-800" onClick={() => setDiscoveryOpen(true)}>
                  <Radar className="w-4 h-4 mr-2" />Scan Network
                </Button>
                <Dialog open={discoveryOpen} onOpenChange={setDiscoveryOpen}>
                  <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2"><Radar className="w-5 h-5 text-cyan-400" />Network Discovery</DialogTitle>
                      <DialogDescription>Scan local network interfaces and discover nearby devices</DialogDescription>
                    </DialogHeader>
                    {!discoveryResult ? (
                      <div className="text-center py-8">
                        <Radar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400 mb-4">Run a network scan to discover interfaces and local devices</p>
                        <Button onClick={handleScanNetwork} disabled={isScanning} className="bg-gradient-to-r from-cyan-500 to-blue-600">
                          {isScanning ? <><Spinner className="w-4 h-4 mr-2" />Scanning...</> : <><Radar className="w-4 h-4 mr-2" />Start Scan</>}
                        </Button>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-96">
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-800/50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-cyan-400">{discoveryResult.totalDevices}</p><p className="text-xs text-slate-500">Devices Found</p></div>
                            <div className="bg-slate-800/50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-emerald-400">{discoveryResult.activeDevices}</p><p className="text-xs text-slate-500">Active</p></div>
                            <div className="bg-slate-800/50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-amber-400">{discoveryResult.scanTime}</p><p className="text-xs text-slate-500">Scan Time</p></div>
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-2">Network Interfaces</p>
                            {discoveryResult.interfaces.map((inf, i) => (
                              <div key={i} className="bg-slate-800/50 rounded-lg p-2 mb-1 text-xs flex items-center justify-between">
                                <span className="text-slate-300">{inf.interface}</span>
                                <span className="text-cyan-400">{inf.address}/{inf.cidr}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-2">Discovered Devices</p>
                            {discoveryResult.discoveredDevices.map((dev, i) => (
                              <div key={i} className="bg-slate-800/50 rounded-lg p-2 mb-1 text-xs flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${dev.status === 'active' ? 'bg-emerald-400' : dev.status === 'inactive' ? 'bg-slate-400' : 'bg-amber-400'}`} />
                                  <span className="text-slate-300">{dev.hostname}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-slate-500">{dev.ipAddress}</span>
                                  <span className="text-cyan-400 capitalize">{dev.vendor}</span>
                                  <span className="text-slate-500">{dev.responseTimeMs}ms</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => { setDiscoveryResult(null); }} className="w-full border-slate-700">
                            <RotateCcw className="w-4 h-4 mr-2" />Re-scan
                          </Button>
                        </div>
                      </ScrollArea>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog open={addElementOpen} onOpenChange={setAddElementOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"><Plus className="w-4 h-4 mr-2" />Add Element</Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-700">
                    <DialogHeader>
                      <DialogTitle>Add Network Element</DialogTitle>
                      <DialogDescription>Register a new device in the monitoring system</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div><Label className="text-slate-300">Name *</Label><Input value={addElementForm.name} onChange={e => setAddElementForm(f => ({ ...f, name: e.target.value }))} placeholder="Core Router 1" className="bg-slate-800 border-slate-700 mt-1" /></div>
                      <div><Label className="text-slate-300">Hostname *</Label><Input value={addElementForm.hostname} onChange={e => setAddElementForm(f => ({ ...f, hostname: e.target.value }))} placeholder="cr01.dc1.local" className="bg-slate-800 border-slate-700 mt-1" /></div>
                      <div><Label className="text-slate-300">IP Address *</Label><Input value={addElementForm.ipAddress} onChange={e => setAddElementForm(f => ({ ...f, ipAddress: e.target.value }))} placeholder="10.0.1.1" className="bg-slate-800 border-slate-700 mt-1" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label className="text-slate-300">Vendor *</Label>
                          <Select value={addElementForm.vendor} onValueChange={v => setAddElementForm(f => ({ ...f, vendor: v }))}>
                            <SelectTrigger className="bg-slate-800 border-slate-700 mt-1"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                            <SelectContent>{['cisco', 'huawei', 'nokia', 'juniper', 'ericsson', 'tp-link'].map(v => <SelectItem key={v} value={v}><span className="capitalize">{v}</span></SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label className="text-slate-300">Element Type *</Label>
                          <Select value={addElementForm.elementType} onValueChange={v => setAddElementForm(f => ({ ...f, elementType: v }))}>
                            <SelectTrigger className="bg-slate-800 border-slate-700 mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent>{['Router', 'Switch', 'Firewall', 'Server', 'Access Point', 'Gateway', 'Controller', 'WDM'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label className="text-slate-300">Site</Label><Input value={addElementForm.site} onChange={e => setAddElementForm(f => ({ ...f, site: e.target.value }))} placeholder="DC-East" className="bg-slate-800 border-slate-700 mt-1" /></div>
                        <div><Label className="text-slate-300">Region</Label><Input value={addElementForm.region} onChange={e => setAddElementForm(f => ({ ...f, region: e.target.value }))} placeholder="US-East" className="bg-slate-800 border-slate-700 mt-1" /></div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddElementOpen(false)} className="border-slate-700">Cancel</Button>
                      <Button onClick={handleAddElement} disabled={isSubmitting} className="bg-gradient-to-r from-emerald-500 to-cyan-500">
                        {isSubmitting ? <Spinner className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}Create Element
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredElements.map(element => (
                <Card key={element.id} className="bg-slate-800/30 border-slate-700/50 backdrop-blur-sm hover:border-cyan-500/30 transition-all duration-300 group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className={`w-3 h-3 rounded-full ${statusColors[element.status] || 'bg-slate-300'} shadow-lg animate-pulse`} />
                          <div className={`absolute inset-0 w-3 h-3 rounded-full ${statusColors[element.status] || 'bg-slate-300'} animate-ping opacity-50`} />
                        </div>
                        <div><p className="font-medium">{element.name}</p><p className="text-xs text-slate-400">{element.hostname}</p></div>
                      </div>
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${vendorColors[element.vendor] || 'from-slate-500 to-slate-600'} flex items-center justify-center text-xs font-bold uppercase`}>{element.vendor?.substring(0, 2) || 'NA'}</div>
                    </div>
                    <div className="space-y-1.5 text-sm text-slate-400">
                      <p className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-cyan-400" />{element.ipAddress}</p>
                      <p className="flex items-center gap-2"><Server className="w-3.5 h-3.5 text-violet-400" />{element.elementType}</p>
                      {element.site && <p className="flex items-center gap-2 text-xs"><MapPin className="w-3 h-3 text-slate-500" />{element.site}{element.region ? ` / ${element.region}` : ''}</p>}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-end gap-2">
                      <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-7" onClick={() => { setSelectedElement(element); setElementDetailOpen(true); }}>
                        <Eye className="w-3.5 h-3.5 mr-1" />Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredElements.length === 0 && (
                <div className="col-span-3 text-center py-12 text-slate-500"><Monitor className="w-12 h-12 mx-auto mb-2" /><p>No elements matching filter</p></div>
              )}
            </div>

            {/* Element Detail Dialog */}
            <Dialog open={elementDetailOpen} onOpenChange={setElementDetailOpen}>
              <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${statusColors[selectedElement?.status || 'unknown']}`} />
                    {selectedElement?.name}
                  </DialogTitle>
                  <DialogDescription>Full network element details</DialogDescription>
                </DialogHeader>
                {selectedElement && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        ['Hostname', selectedElement.hostname],
                        ['IP Address', selectedElement.ipAddress],
                        ['Vendor', selectedElement.vendor],
                        ['Element Type', selectedElement.elementType],
                        ['Status', selectedElement.status],
                        ['Site', selectedElement.site || 'N/A'],
                        ['Region', selectedElement.region || 'N/A'],
                        ['Model', selectedElement.model || 'N/A'],
                      ].map(([label, val]) => (
                        <div key={label as string}><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-medium capitalize">{val}</p></div>
                      ))}
                    </div>
                    {selectedElement.capabilities && (
                      <div><p className="text-xs text-slate-500 mb-1">Capabilities</p><p className="text-sm text-slate-300">{selectedElement.capabilities}</p></div>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ═══════════════════ LOGS TAB ═══════════════════ */}
          <TabsContent value="logs" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold">Centralized Logs</h2>
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="Search logs..." value={logSearchQuery} onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-48 bg-slate-800/50 border-slate-700 text-sm" />
                <Select value={logLevelFilter} onValueChange={setLogLevelFilter}>
                  <SelectTrigger className="w-36 bg-slate-800/50 border-slate-700 text-sm"><SelectValue placeholder="Level" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {['error', 'warning', 'info', 'debug'].map(l => <SelectItem key={l} value={l}><span className="capitalize">{l}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
                  <SelectTrigger className="w-36 bg-slate-800/50 border-slate-700 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {['system', 'security', 'network', 'application', 'provisioning'].map(t => <SelectItem key={t} value={t}><span className="capitalize">{t}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800" onClick={() => downloadCSV(logs as unknown as Record<string, unknown>[], `logs-${Date.now()}.csv`)}>
                  <Download className="w-4 h-4 mr-2" />Export CSV
                </Button>
              </div>
            </div>
            <Card className="bg-slate-800/30 border-slate-700/50 backdrop-blur-sm">
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="p-4 font-mono text-sm">
                    {logs.map(log => (
                      <div key={log.id} className="flex gap-4 py-2 border-b border-slate-700/30 hover:bg-slate-700/20 px-2 rounded">
                        <span className="text-slate-500 w-36 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <Badge variant="outline" className={`w-16 text-center justify-center shrink-0 ${log.logLevel === 'error' ? 'text-red-400 border-red-500/50' : log.logLevel === 'warning' ? 'text-amber-400 border-amber-500/50' : 'text-slate-400 border-slate-500/50'}`}>{log.logLevel.toUpperCase()}</Badge>
                        <Badge variant="outline" className="w-24 text-center justify-center shrink-0 text-slate-500 border-slate-600/50">{log.logType}</Badge>
                        <span className="text-slate-300">{log.message}</span>
                      </div>
                    ))}
                    {logs.length === 0 && <p className="text-center text-slate-500 py-8">No logs found</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════ PROVISIONING TAB ═══════════════════ */}
          <TabsContent value="provisioning" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold">Provisioning Tasks</h2>
              <div className="flex gap-2 flex-wrap">
                <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                  <SelectTrigger className="w-36 bg-slate-800/50 border-slate-700 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {['pending', 'in_progress', 'completed', 'failed', 'cancelled'].map(s => <SelectItem key={s} value={s}><span className="capitalize">{s.replace('_', ' ')}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={taskPriorityFilter} onValueChange={setTaskPriorityFilter}>
                  <SelectTrigger className="w-36 bg-slate-800/50 border-slate-700 text-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    {['critical', 'high', 'medium', 'low'].map(p => <SelectItem key={p} value={p}><span className="capitalize">{p}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"><Plus className="w-4 h-4 mr-2" />New Task</Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-700">
                    <DialogHeader>
                      <DialogTitle>Create Provisioning Task</DialogTitle>
                      <DialogDescription>Queue a new configuration or deployment task</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div><Label className="text-slate-300">Network Element *</Label>
                        <Select value={newTaskForm.networkElementId} onValueChange={v => setNewTaskForm(f => ({ ...f, networkElementId: v }))}>
                          <SelectTrigger className="bg-slate-800 border-slate-700 mt-1"><SelectValue placeholder="Select element" /></SelectTrigger>
                          <SelectContent>{networkElements.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.ipAddress})</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-slate-300">Task Type *</Label>
                        <Select value={newTaskForm.taskType} onValueChange={v => setNewTaskForm(f => ({ ...f, taskType: v }))}>
                          <SelectTrigger className="bg-slate-800 border-slate-700 mt-1"><SelectValue placeholder="Select task type" /></SelectTrigger>
                          <SelectContent>{['config_push', 'config_backup', 'firmware_upgrade', 'firmware_rollback', 'service_restart', 'interface_reset', 'vlan_provision', 'acl_update'].map(t => <SelectItem key={t} value={t}><span className="capitalize">{t.replace('_', ' ')}</span></SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-slate-300">Priority</Label>
                        <Select value={newTaskForm.priority} onValueChange={v => setNewTaskForm(f => ({ ...f, priority: v }))}>
                          <SelectTrigger className="bg-slate-800 border-slate-700 mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{['low', 'medium', 'high', 'critical'].map(p => <SelectItem key={p} value={p}><span className="capitalize">{p}</span></SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-slate-300">Description</Label><Textarea value={newTaskForm.description} onChange={e => setNewTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="Task description..." className="bg-slate-800 border-slate-700 mt-1 min-h-[80px]" /></div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewTaskOpen(false)} className="border-slate-700">Cancel</Button>
                      <Button onClick={handleNewTask} disabled={isSubmitting} className="bg-gradient-to-r from-violet-500 to-purple-500">
                        {isSubmitting ? <Spinner className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}Create Task
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <Card className="bg-slate-800/30 border-slate-700/50 backdrop-blur-sm">
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <table className="w-full">
                    <thead className="bg-slate-800/50 sticky top-0">
                      <tr>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Task Type</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Element</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Priority</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Created</th>
                        <th className="text-left p-4 text-sm font-medium text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map(task => (
                        <tr key={task.id} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                          <td className="p-4"><div className="flex items-center gap-2"><Settings className="w-4 h-4 text-amber-400" /><span className="capitalize">{task.taskType.replace('_', ' ')}</span></div></td>
                          <td className="p-4"><div><p className="text-sm">{task.networkElement?.name}</p><p className="text-xs text-slate-400">{task.networkElement?.hostname}</p></div></td>
                          <td className="p-4"><Badge className={task.priority === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/50' : task.priority === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' : task.priority === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-slate-500/20 text-slate-400 border-slate-500/50'}>{task.priority}</Badge></td>
                          <td className="p-4"><Badge className={task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : task.status === 'failed' ? 'bg-red-500/20 text-red-400 border-red-500/50' : task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-slate-500/20 text-slate-400 border-slate-500/50'}>{task.status.replace('_', ' ')}</Badge></td>
                          <td className="p-4 text-sm text-slate-400">{timeAgo(task.createdAt)}</td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              {task.status === 'failed' && <Button size="sm" variant="ghost" onClick={() => handleTaskAction(task.id, 'retry')} className="text-cyan-400 hover:text-cyan-300"><RotateCcw className="w-3.5 h-3.5 mr-1" />Retry</Button>}
                              {task.status !== 'in_progress' && task.status !== 'completed' && task.status !== 'cancelled' && <Button size="sm" variant="ghost" onClick={() => handleTaskAction(task.id, 'cancel')} className="text-red-400 hover:text-red-300"><XCircle className="w-3.5 h-3.5 mr-1" />Cancel</Button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredTasks.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No tasks matching filter</td></tr>}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════ SECURITY TAB ═══════════════════ */}
          <TabsContent value="security" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold">Zero Trust Security Center</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={securityActionFilter} onValueChange={setSecurityActionFilter}>
                  <SelectTrigger className="w-40 bg-slate-800/50 border-slate-700 text-sm"><SelectValue placeholder="Action" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {[...new Set(securityEvents.map(e => e.action))].map(a => <SelectItem key={a} value={a}><span className="capitalize">{a.replace(/_/g, ' ')}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={securityRiskFilter} onValueChange={setSecurityRiskFilter}>
                  <SelectTrigger className="w-36 bg-slate-800/50 border-slate-700 text-sm"><SelectValue placeholder="Risk" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk Levels</SelectItem>
                    {['high', 'medium', 'low', 'info'].map(r => <SelectItem key={r} value={r}><span className="capitalize">{r}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 px-3 py-1"><Shield className="w-3 h-3 mr-1.5" />Active</Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: <Shield className="w-12 h-12 mx-auto text-emerald-400 mb-3" />, title: 'Identity Verification', desc: 'Multi-factor authentication enabled', badge: 'Active', badgeCls: 'bg-emerald-500/20 text-emerald-400' },
                { icon: <Lock className="w-12 h-12 mx-auto text-cyan-400 mb-3" />, title: 'Least Privilege Access', desc: 'Role-based permissions', badge: 'Enforced', badgeCls: 'bg-cyan-500/20 text-cyan-400' },
                { icon: <Eye className="w-12 h-12 mx-auto text-violet-400 mb-3" />, title: 'Continuous Monitoring', desc: 'Real-time threat detection', badge: 'Monitoring', badgeCls: 'bg-violet-500/20 text-violet-400' },
              ].map((card, i) => (
                <Card key={i} className="bg-slate-800/30 border-slate-700/50 backdrop-blur-sm">
                  <CardContent className="p-5 text-center">{card.icon}<h3 className="font-semibold mb-1">{card.title}</h3><p className="text-sm text-slate-400">{card.desc}</p><Badge className={`mt-3 ${card.badgeCls}`}>{card.badge}</Badge></CardContent>
                </Card>
              ))}
            </div>

            {/* Security Audit Table */}
            <Card className="bg-slate-800/30 border-slate-700/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2"><AlertCircle className="w-5 h-5 text-rose-400" />Security Audit Trail</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <table className="w-full">
                    <thead className="bg-slate-800/50 sticky top-0">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium text-slate-400">Action</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-400">User</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-400">Risk</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-400">Resource</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-400">Result</th>
                        <th className="text-left p-3 text-sm font-medium text-slate-400">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSecurity.map((event, i) => (
                        <tr key={event.id || i} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                          <td className="p-3 text-sm capitalize">{event.action?.replace(/_/g, ' ')}</td>
                          <td className="p-3 text-sm text-slate-400">{event.user?.name || event.userId || '-'}</td>
                          <td className="p-3"><Badge variant="outline" className={riskColors[event.riskLevel || 'info']}>{event.riskLevel || 'info'}</Badge></td>
                          <td className="p-3 text-xs text-slate-400">{event.resourceType} {event.resource && <span className="text-slate-500">({String(event.resource).substring(0, 8)}...)</span>}</td>
                          <td className="p-3"><Badge variant="outline" className={event.result === 'success' ? 'text-emerald-400 border-emerald-500/50' : 'text-red-400 border-red-500/50'}>{event.result || '-'}</Badge></td>
                          <td className="p-3 text-xs text-slate-500">{event.timestamp ? timeAgo(event.timestamp) : '-'}</td>
                        </tr>
                      ))}
                      {filteredSecurity.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No security events</td></tr>}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════ TELECOM TAB (Table VI from Manuscript) ═══════════════════ */}
          <TabsContent value="telecom" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold">Telecom Services Monitoring <span className="text-xs text-slate-500 font-normal ml-2">Table VI — Manuscript</span></h2>
              <div className="flex items-center gap-2">
                {telecomSummary && (
                  <>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 px-3 py-1">{telecomSummary.operational as number} Operational</Badge>
                    {(telecomSummary.degraded as number) > 0 && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50 px-3 py-1">{telecomSummary.degraded as number} Degraded</Badge>}
                    {(telecomSummary.outage as number) > 0 && <Badge className="bg-red-500/20 text-red-400 border-red-500/50 px-3 py-1">{telecomSummary.outage as number} Outage</Badge>}
                  </>
                )}
              </div>
            </div>
            {Object.keys(telecomServices).length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                  {Object.entries(telecomServices).map(([key, service]) => {
                    const health = service.health as Record<string, unknown>;
                    const config = service.config as Record<string, unknown>;
                    const kpis = health.kpis as Record<string, { value: number; unit: string; target: number; status: string }> | undefined;
                    const vendors = health.vendors as string[] | undefined;
                    const healthLevel = health.health_level as string;
                    const status = health.status as string;
                    return (
                      <Card key={key} className={`bg-slate-800/30 border-slate-700/50 backdrop-blur-sm hover:${status === 'operational' ? 'border-emerald-500/30' : status === 'degraded' ? 'border-amber-500/30' : 'border-red-500/30'} transition-all duration-300`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${(config.color as string) || 'from-slate-500 to-slate-600'} flex items-center justify-center text-sm font-bold text-white`}>
                              {String.fromCharCode(9312 + Object.keys(telecomServices).indexOf(key))}
                            </div>
                            <Badge className={`${status === 'operational' ? 'bg-emerald-500/20 text-emerald-400' : status === 'degraded' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'} text-xs`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${status === 'operational' ? 'bg-emerald-400' : status === 'degraded' ? 'bg-amber-400 animate-pulse' : 'bg-red-400 animate-pulse'}`} />
                              {healthLevel}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-xs leading-tight">{config.name as string}</h3>
                          <p className="text-[10px] text-slate-500 mt-0.5">{config.description as string}</p>
                          {vendors && <p className="text-[10px] text-slate-600 mt-1">{vendors.join(' / ')}</p>}
                          {config.kpiCount && <p className="text-[10px] text-slate-600">{config.kpiCount as number} KPIs</p>}
                          <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5">
                            <div className="flex justify-between text-xs"><span className="text-slate-500">SLA</span><span className={(health.sla_actual as number) >= (health.sla_target as number) ? 'text-emerald-400' : 'text-red-400'}>{(health.sla_actual as number)?.toFixed(2)}% <span className="text-slate-600">/ {(health.sla_target as number)}%</span></span></div>
                            <div className="flex justify-between text-xs"><span className="text-slate-500">Subscribers</span><span className="text-cyan-400">{((health.active_subscribers as number) / 1000).toFixed(0)}K</span></div>
                            <div className="flex justify-between text-xs"><span className="text-slate-500">Throughput</span><span className="text-slate-300">{(health.throughput_gbps as number)?.toFixed(1)} Gbps</span></div>
                            {health.score !== undefined && <div className="mt-1"><Progress value={(health.score as number) * 100} className="h-1 bg-slate-700 [&>div]:bg-cyan-500" /></div>}
                            {kpis && Object.entries(kpis).slice(0, 3).map(([name, kpi]) => (
                              <div key={name} className="flex justify-between text-[10px]"><span className="text-slate-600">{name}</span><span className={kpi.status === 'ok' ? 'text-slate-300' : kpi.status === 'warning' ? 'text-amber-400' : 'text-red-400'}>{kpi.value} {kpi.unit}</span></div>
                            ))}
                            {health.issues && (health.issues as string[]).length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {(health.issues as string[]).slice(0, 2).map((issue, i) => (
                                  <p key={i} className="text-[10px] text-amber-400 truncate">{issue}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {telecomSummary && (
                  <Card className="bg-slate-800/30 border-slate-700/50 backdrop-blur-sm">
                    <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="w-5 h-5 text-cyan-400" />Service Statistics (Table VI — 10 Services)</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-slate-900/50 rounded-lg"><p className="text-2xl font-bold text-emerald-400">{((telecomSummary.avg_availability as number))?.toFixed(2)}%</p><p className="text-xs text-slate-500 mt-1">Avg Availability</p></div>
                        <div className="text-center p-3 bg-slate-900/50 rounded-lg"><p className="text-2xl font-bold text-cyan-400">{telecomSummary.total as number}</p><p className="text-xs text-slate-500 mt-1">Total Services</p></div>
                        <div className="text-center p-3 bg-slate-900/50 rounded-lg"><p className="text-2xl font-bold text-violet-400">{((telecomSummary.total_subscribers as number) / 1000).toFixed(0)}K</p><p className="text-xs text-slate-500 mt-1">Active Subscribers</p></div>
                        <div className="text-center p-3 bg-slate-900/50 rounded-lg"><p className="text-2xl font-bold text-amber-400">{telecomSummary.total_throughput_gbps as number} Gbps</p><p className="text-xs text-slate-500 mt-1">Total Throughput</p></div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="bg-slate-800/30 border-slate-700/50 backdrop-blur-sm">
                <CardContent className="p-8 text-center text-slate-500"><Cpu className="w-12 h-12 mx-auto mb-3 animate-pulse" /><p>Loading telecom services...</p></CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
