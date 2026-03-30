// ============================================
// NET'S AI SECURITY AGENT - Type Definitions
// Multi-Vendor Network Operations Center
// ============================================

// Network Element Types
export type ElementStatus = 'active' | 'inactive' | 'maintenance' | 'unknown';
export type ElementType = 'router' | 'switch' | 'firewall' | 'server' | 'loadbalancer' | 'wireless' | 'other';

export interface NetworkElement {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  vendor: Vendor;
  model?: string;
  osVersion?: string;
  elementType: ElementType;
  site?: string;
  region?: string;
  status: ElementStatus;
  lastSeen?: Date;
  capabilities?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Vendor Types
export type Vendor = 'cisco' | 'huawei' | 'nokia' | 'juniper' | 'ericsson' | 'tp-link' | 'arista' | 'other';

export interface VendorConfig {
  vendorName: string;
  protocols: Protocol[];
  defaultPort: number;
  apiEndpoint?: string;
  configTemplates?: Record<string, string>;
}

// Protocol Types
export type Protocol = 'NETCONF' | 'SSH' | 'SNMP' | 'RESTCONF' | 'TL1' | 'CLI';

// Alarm Types
export type AlarmSeverity = 'critical' | 'major' | 'minor' | 'warning' | 'info';
export type AlarmStatus = 'active' | 'acknowledged' | 'cleared';
export type AlarmCategory = 'security' | 'performance' | 'connectivity' | 'hardware' | 'configuration' | 'other';

export interface Alarm {
  id: string;
  networkElementId: string;
  networkElement?: NetworkElement;
  severity: AlarmSeverity;
  alarmCode: string;
  alarmName: string;
  description?: string;
  source?: string;
  category?: AlarmCategory;
  status: AlarmStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  clearedAt?: Date;
  firstSeen: Date;
  lastSeen: Date;
  count: number;
  rawMessage?: string;
  metadata?: Record<string, unknown>;
}

// Log Types
export type LogLevel = 'emergency' | 'alert' | 'critical' | 'error' | 'warning' | 'notice' | 'info' | 'debug';
export type LogType = 'system' | 'security' | 'audit' | 'config' | 'performance' | 'access';

export interface LogEntry {
  id: string;
  networkElementId?: string;
  networkElement?: NetworkElement;
  timestamp: Date;
  logLevel: LogLevel;
  facility?: string;
  source?: string;
  process?: string;
  message: string;
  rawLog?: string;
  parsed: boolean;
  logType: LogType;
  metadata?: Record<string, unknown>;
}

// Provisioning Types
export type TaskType = 'config_push' | 'firmware_update' | 'backup' | 'restore' | 'provision' | 'discover';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ProvisioningTask {
  id: string;
  networkElementId: string;
  networkElement?: NetworkElement;
  createdById: string;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  description?: string;
  configData?: Record<string, unknown>;
  protocol?: Protocol;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: string;
  errorDetails?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

// Security Types (Zero Trust)
export type UserRole = 'admin' | 'operator' | 'viewer';
export type AuditAction = 'login' | 'logout' | 'config_change' | 'access_granted' | 'access_denied' | 'provisioning' | 'alarm_ack';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityAudit {
  id: string;
  userId?: string;
  action: AuditAction;
  resource?: string;
  resourceType?: string;
  result: 'success' | 'failure' | 'denied';
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  riskLevel: RiskLevel;
  timestamp: Date;
}

// Agent Types (Multi-Agent Architecture)
export type AgentType = 'provisioning' | 'alarm' | 'log' | 'security' | 'orchestrator';
export type AgentStatus = 'idle' | 'running' | 'waiting' | 'error';

export interface AgentTask {
  id: string;
  agentType: AgentType;
  action: string;
  payload: Record<string, unknown>;
  status: AgentStatus;
  result?: unknown;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// WebSocket Message Types
export type WSMessageType = 'alarm' | 'log' | 'task_update' | 'notification' | 'system';

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  timestamp: Date;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'alarm' | 'task' | 'system' | 'security';
  title: string;
  message: string;
  severity: AlarmSeverity;
  read: boolean;
  createdAt: Date;
}
