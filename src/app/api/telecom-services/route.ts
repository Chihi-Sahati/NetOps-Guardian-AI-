import { NextRequest, NextResponse } from 'next/server';

// ============================================
// NETOPS GUARDIAN AI - Telecom Services Monitoring
// Matching Manuscript Table VI: 10 Telecom Services
// Deterministic computed metrics (no Math.random)
// ============================================

type ServiceType =
  | 'volte_srvc'
  | '5g_nr_srvc'
  | 'broadband_srvc'
  | 'iptv_srvc'
  | 'voip_ims_srvc'
  | 'vpn_enterprise_srvc'
  | 'mobile_core_srvc'
  | 'sms_mms_srvc'
  | 'dns_cdn_srvc'
  | 'cloud_vnf_srvc';

type ServiceStatus = 'operational' | 'degraded' | 'partial_outage' | 'full_outage' | 'maintenance';
type HealthLevel = 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'CRITICAL';

interface KPIDefinition {
  name: string;
  unit: string;
  target: number;
  compute: (params: ServiceComputeParams) => number;
}

interface ServiceComputeParams {
  hour: number;
  dayOfWeek: number;
  loadFactor: number;
  baseSubscribers: number;
  serviceIndex: number;
}

interface ServiceHealth {
  status: ServiceStatus;
  health_level: HealthLevel;
  score: number;
  availability_24h: number;
  kpis: Record<string, { value: number; unit: string; target: number; status: 'ok' | 'warning' | 'critical' }>;
  active_subscribers: number;
  throughput_gbps: number;
  vendors: string[];
  issues: string[];
  recommendations: string[];
  last_check: string;
  sla_target: number;
  sla_actual: number;
}

interface ServiceConfig {
  id: ServiceType;
  name: string;
  description: string;
  color: string;
  vendors: string[];
  kpiCount: number;
  slaTarget: number;
  baseSubscribers: number;
  degradeThreshold: number;
  outageThreshold: number;
}

// ============================================
// SERVICE DEFINITIONS (Table VI from Manuscript)
// ============================================

const SERVICE_DEFINITIONS: Record<ServiceType, ServiceConfig> = {
  volte_srvc: {
    id: 'volte_srvc',
    name: '4G LTE Voice (VoLTE/SRVCC)',
    description: 'Voice over LTE with SRVCC handover',
    color: 'from-blue-500 to-cyan-500',
    vendors: ['Ericsson', 'Nokia'],
    kpiCount: 12,
    slaTarget: 99.95,
    baseSubscribers: 185000,
    degradeThreshold: 0.78,
    outageThreshold: 0.93,
  },
  '5g_nr_srvc': {
    id: '5g_nr_srvc',
    name: '5G NR Services (SA/NSA)',
    description: 'New Radio Standalone and Non-Standalone',
    color: 'from-green-500 to-emerald-500',
    vendors: ['Huawei', 'Ericsson'],
    kpiCount: 15,
    slaTarget: 99.99,
    baseSubscribers: 92000,
    degradeThreshold: 0.72,
    outageThreshold: 0.91,
  },
  broadband_srvc: {
    id: 'broadband_srvc',
    name: 'Broadband Internet (FTTH/xDSL)',
    description: 'Fiber-to-the-Home and DSL broadband',
    color: 'from-purple-500 to-pink-500',
    vendors: ['Cisco', 'Huawei'],
    kpiCount: 10,
    slaTarget: 99.95,
    baseSubscribers: 310000,
    degradeThreshold: 0.80,
    outageThreshold: 0.94,
  },
  iptv_srvc: {
    id: 'iptv_srvc',
    name: 'IPTV and Streaming Media',
    description: 'IP Television and media streaming',
    color: 'from-red-500 to-rose-500',
    vendors: ['Nokia', 'Huawei'],
    kpiCount: 8,
    slaTarget: 99.90,
    baseSubscribers: 145000,
    degradeThreshold: 0.75,
    outageThreshold: 0.92,
  },
  voip_ims_srvc: {
    id: 'voip_ims_srvc',
    name: 'VoIP/IMS Telephony',
    description: 'Voice over IP via IP Multimedia Subsystem',
    color: 'from-teal-500 to-cyan-500',
    vendors: ['Cisco', 'Ericsson'],
    kpiCount: 11,
    slaTarget: 99.99,
    baseSubscribers: 220000,
    degradeThreshold: 0.76,
    outageThreshold: 0.93,
  },
  vpn_enterprise_srvc: {
    id: 'vpn_enterprise_srvc',
    name: 'VPN and Enterprise Connectivity',
    description: 'Enterprise VPN tunnels and WAN connectivity',
    color: 'from-orange-500 to-amber-500',
    vendors: ['Cisco', 'Juniper'],
    kpiCount: 9,
    slaTarget: 99.99,
    baseSubscribers: 8500,
    degradeThreshold: 0.70,
    outageThreshold: 0.90,
  },
  mobile_core_srvc: {
    id: 'mobile_core_srvc',
    name: 'Mobile Data Core (EPC/5GC)',
    description: 'Evolved Packet Core and 5G Core Network',
    color: 'from-indigo-500 to-purple-500',
    vendors: ['Ericsson', 'Huawei'],
    kpiCount: 14,
    slaTarget: 99.99,
    baseSubscribers: 410000,
    degradeThreshold: 0.82,
    outageThreshold: 0.95,
  },
  sms_mms_srvc: {
    id: 'sms_mms_srvc',
    name: 'SMS/MMS Messaging',
    description: 'Short Message and Multimedia Messaging',
    color: 'from-yellow-500 to-orange-500',
    vendors: ['Ericsson', 'Nokia'],
    kpiCount: 6,
    slaTarget: 99.95,
    baseSubscribers: 420000,
    degradeThreshold: 0.74,
    outageThreshold: 0.92,
  },
  dns_cdn_srvc: {
    id: 'dns_cdn_srvc',
    name: 'DNS and CDN',
    description: 'Domain Name System and Content Delivery Network',
    color: 'from-emerald-500 to-green-500',
    vendors: ['Cisco', 'Juniper'],
    kpiCount: 7,
    slaTarget: 99.99,
    baseSubscribers: 500000,
    degradeThreshold: 0.77,
    outageThreshold: 0.94,
  },
  cloud_vnf_srvc: {
    id: 'cloud_vnf_srvc',
    name: 'Cloud/VNF Services',
    description: 'Virtualized Network Functions and Cloud Infrastructure',
    color: 'from-violet-500 to-purple-600',
    vendors: ['Cisco', 'Huawei', 'Nokia', 'Ericsson', 'Juniper'],
    kpiCount: 13,
    slaTarget: 99.99,
    baseSubscribers: 15000,
    degradeThreshold: 0.73,
    outageThreshold: 0.91,
  },
};

// ============================================
// DETERMINISTIC KPI COMPUTATION FUNCTIONS
// All use deterministic formulas based on time-of-day
// load patterns and subscriber counts (no Math.random)
// ============================================

function getLoadFactor(hour: number, dayOfWeek: number): number {
  // Sinusoidal load model: business hours peak, night low
  // Peak at hours 10-12 and 14-16
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    // Weekend: lower overall load
    return 0.25 + 0.15 * Math.sin(Math.PI * (hour - 6) / 12);
  }
  // Weekday pattern
  const morningPeak = 0.85 * Math.exp(-0.5 * Math.pow((hour - 11) / 2.5, 2));
  const afternoonPeak = 0.75 * Math.exp(-0.5 * Math.pow((hour - 15) / 2.0, 2));
  const nightValley = 0.12 * Math.exp(-0.5 * Math.pow((hour - 3) / 2.0, 2));
  return Math.min(0.98, Math.max(0.08, morningPeak + afternoonPeak + nightValley + 0.08));
}

// KPI computation functions - each returns deterministic value
function computeMOS(p: ServiceComputeParams): number {
  // Mean Opinion Score: 4.5 at low load, degrades under high load
  return Math.max(1.0, Math.min(5.0, 4.5 - p.loadFactor * 1.2));
}

function computeLatency(baseMs: number, p: ServiceComputeParams): number {
  // Latency increases with load: M/M/1-like response time
  // E[T] = base / (1 - rho)
  const rho = Math.min(0.98, p.loadFactor);
  return baseMs / Math.max(0.02, 1 - rho);
}

function computeThroughput(baseGbps: number, p: ServiceComputeParams): number {
  // Throughput decreases under congestion
  return baseGbps * (1 - Math.pow(p.loadFactor, 2) * 0.4);
}

function computePacketLoss(p: ServiceComputeParams): number {
  // Packet loss exponentially increases near capacity
  if (p.loadFactor < 0.7) return 0.001 + p.loadFactor * 0.005;
  return 0.0035 + Math.pow(p.loadFactor - 0.7, 2) * 2.0;
}

function computeJitter(p: ServiceComputeParams): number {
  return 0.5 + p.loadFactor * 12.0;
}

function computeErrorRate(p: ServiceComputeParams): number {
  if (p.loadFactor < 0.75) return 0.001 + p.loadFactor * 0.01;
  return 0.0085 + Math.pow(p.loadFactor - 0.75, 2) * 3.0;
}

function computeAvailability(p: ServiceComputeParams, slaTarget: number, degrade: number, outage: number): number {
  if (p.loadFactor >= outage) return slaTarget - 4.5 - (p.loadFactor - outage) * 15;
  if (p.loadFactor >= degrade) return slaTarget - (p.loadFactor - degrade) * 5;
  return slaTarget;
}

function computeCPU(p: ServiceComputeParams): number {
  return 15 + p.loadFactor * 70 + (p.serviceIndex % 5) * 1.3;
}

function computeMemory(p: ServiceComputeParams): number {
  return 35 + p.loadFactor * 45 + (p.serviceIndex % 7) * 0.8;
}

// ============================================
// PER-SERVICE KPI DEFINITIONS
// ============================================

function getKPIs(serviceType: ServiceType): KPIDefinition[] {
  const kpiMap: Record<ServiceType, KPIDefinition[]> = {
    volte_srvc: [
      { name: 'MOS', unit: 'score', target: 4.2, compute: (p) => computeMOS(p) },
      { name: 'Call Setup Latency', unit: 'ms', target: 150, compute: (p) => computeLatency(45, p) },
      { name: 'RTP Packet Loss', unit: '%', target: 0.5, compute: (p) => computePacketLoss(p) * 100 },
      { name: 'SRVCC Handover Success', unit: '%', target: 99.5, compute: (p) => 99.9 - p.loadFactor * 0.8 },
      { name: 'Call Drop Rate', unit: '%', target: 0.2, compute: (p) => 0.05 + p.loadFactor * 0.3 },
      { name: 'Voice Jitter', unit: 'ms', target: 30, compute: (p) => computeJitter(p) },
      { name: 'Bearer Setup Success', unit: '%', target: 99.8, compute: (p) => 99.95 - p.loadFactor * 0.3 },
      { name: 'Registration Success', unit: '%', target: 99.9, compute: (p) => 99.98 - p.loadFactor * 0.2 },
      { name: 'Session Setup Time', unit: 'ms', target: 200, compute: (p) => computeLatency(80, p) },
      { name: 'Codec Negotiation Success', unit: '%', target: 99.5, compute: (p) => 99.8 - p.loadFactor * 0.5 },
      { name: 'Emergency Call Success', unit: '%', target: 99.99, compute: (p) => 99.995 - p.loadFactor * 0.02 },
      { name: 'VoLTE Coverage Ratio', unit: '%', target: 95, compute: (p) => 97 - p.loadFactor * 3 },
    ],
    '5g_nr_srvc': [
      { name: 'DL Throughput', unit: 'Mbps', target: 1000, compute: (p) => computeThroughput(1.5, p) * 1000 },
      { name: 'UL Throughput', unit: 'Mbps', target: 200, compute: (p) => computeThroughput(0.3, p) * 1000 },
      { name: 'Latency (URLLC)', unit: 'ms', target: 5, compute: (p) => computeLatency(2, p) },
      { name: 'Latency (eMBB)', unit: 'ms', target: 15, compute: (p) => computeLatency(6, p) },
      { name: 'RSRP', unit: 'dBm', target: -90, compute: (p) => -75 - p.loadFactor * 20 },
      { name: 'RSRQ', unit: 'dB', target: -12, compute: (p) => -8 - p.loadFactor * 6 },
      { name: 'SINR', unit: 'dB', target: 15, compute: (p) => 25 - p.loadFactor * 12 },
      { name: 'PDCP Packet Loss', unit: '%', target: 0.01, compute: (p) => computePacketLoss(p) * 10 },
      { name: 'Handover Success Rate', unit: '%', target: 99.5, compute: (p) => 99.8 - p.loadFactor * 0.6 },
      { name: 'gNB Availability', unit: '%', target: 99.99, compute: (p) => 99.995 - p.loadFactor * 0.03 },
      { name: 'NSSAI Activation Success', unit: '%', target: 99.9, compute: (p) => 99.95 - p.loadFactor * 0.15 },
      { name: 'Slicing Isolation', unit: '%', target: 100, compute: (p) => 100 - p.loadFactor * 0.01 },
      { name: 'Beamforming Gain', unit: 'dB', target: 12, compute: (p) => 15 - p.loadFactor * 4 },
      { name: 'PRB Utilization', unit: '%', target: 70, compute: (p) => p.loadFactor * 95 },
      { name: 'QoS Flow Setup', unit: 'ms', target: 20, compute: (p) => computeLatency(8, p) },
    ],
    broadband_srvc: [
      { name: 'Download Speed', unit: 'Mbps', target: 500, compute: (p) => computeThroughput(0.8, p) * 1000 },
      { name: 'Upload Speed', unit: 'Mbps', target: 200, compute: (p) => computeThroughput(0.25, p) * 1000 },
      { name: 'Packet Loss', unit: '%', target: 0.01, compute: (p) => computePacketLoss(p) * 100 },
      { name: 'Latency', unit: 'ms', target: 10, compute: (p) => computeLatency(4, p) },
      { name: 'Jitter', unit: 'ms', target: 5, compute: (p) => computeJitter(p) * 0.3 },
      { name: 'FTTH Uptime', unit: '%', target: 99.99, compute: (p) => 99.995 - p.loadFactor * 0.02 },
      { name: 'PPPoE Setup Time', unit: 'ms', target: 500, compute: (p) => computeLatency(200, p) },
      { name: 'DNS Resolution', unit: 'ms', target: 30, compute: (p) => computeLatency(12, p) },
      { name: 'Bandwidth Utilization', unit: '%', target: 60, compute: (p) => p.loadFactor * 90 },
      { name: 'SLA Compliance Rate', unit: '%', target: 99.5, compute: (p) => 99.8 - p.loadFactor * 0.5 },
    ],
    iptv_srvc: [
      { name: 'Channel ZAP Time', unit: 'ms', target: 1000, compute: (p) => computeLatency(300, p) },
      { name: 'Video Bitrate', unit: 'Mbps', target: 8, compute: (p) => computeThroughput(12, p) },
      { name: 'Video Freeze Ratio', unit: '%', target: 0.05, compute: (p) => 0.01 + p.loadFactor * 0.1 },
      { name: 'Channel Change Success', unit: '%', target: 99.5, compute: (p) => 99.9 - p.loadFactor * 0.6 },
      { name: 'Multicast Join Latency', unit: 'ms', target: 200, compute: (p) => computeLatency(60, p) },
      { name: 'STB Boot Time', unit: 's', target: 30, compute: (p) => 15 + p.loadFactor * 20 },
      { name: 'EPG Update Latency', unit: 's', target: 5, compute: (p) => 2 + p.loadFactor * 5 },
      { name: 'Concurrent Streams', unit: 'count', target: 50000, compute: (p) => Math.round(p.baseSubscribers * p.loadFactor * 0.3) },
    ],
    voip_ims_srvc: [
      { name: 'R-Factor', unit: 'score', target: 90, compute: (p) => 94 - p.loadFactor * 8 },
      { name: 'Session Setup Rate', unit: 'sessions/s', target: 5000, compute: (p) => Math.round(8000 * (1 - p.loadFactor * 0.4)) },
      { name: 'SIP Register Success', unit: '%', target: 99.9, compute: (p) => 99.98 - p.loadFactor * 0.2 },
      { name: 'INVITE Success Rate', unit: '%', target: 99.5, compute: (p) => 99.8 - p.loadFactor * 0.5 },
      { name: 'Session Duration', unit: 'min', target: 5, compute: (p) => 6.5 - p.loadFactor * 2 },
      { name: 'Codec Interop Success', unit: '%', target: 99.9, compute: (p) => 99.95 - p.loadFactor * 0.15 },
      { name: 'IMS Registration', unit: '%', target: 99.95, compute: (p) => 99.99 - p.loadFactor * 0.1 },
      { name: 'VoLTE-to-VoIP Handover', unit: '%', target: 99.8, compute: (p) => 99.9 - p.loadFactor * 0.3 },
      { name: 'Media Gateway Latency', unit: 'ms', target: 20, compute: (p) => computeLatency(8, p) },
      { name: 'Bandwidth per Call', unit: 'Kbps', target: 100, compute: (p) => 85 + p.loadFactor * 15 },
      { name: 'Concurrent Sessions', unit: 'count', target: 100000, compute: (p) => Math.round(p.baseSubscribers * p.loadFactor * 0.12) },
    ],
    vpn_enterprise_srvc: [
      { name: 'Tunnel Uptime', unit: '%', target: 99.99, compute: (p) => 99.998 - p.loadFactor * 0.015 },
      { name: 'IPSec Throughput', unit: 'Mbps', target: 1000, compute: (p) => computeThroughput(1.5, p) * 1000 },
      { name: 'Encrypt/Decrypt Latency', unit: 'ms', target: 2, compute: (p) => computeLatency(0.8, p) },
      { name: 'Tunnel Setup Time', unit: 'ms', target: 500, compute: (p) => computeLatency(150, p) },
      { name: 'SA Negotiation Time', unit: 'ms', target: 300, compute: (p) => computeLatency(100, p) },
      { name: 'Packet Loss', unit: '%', target: 0.001, compute: (p) => computePacketLoss(p) * 50 },
      { name: 'BGP Session Uptime', unit: '%', target: 99.99, compute: (p) => 99.995 - p.loadFactor * 0.02 },
      { name: 'MPLS Label Switching', unit: 'us', target: 10, compute: (p) => computeLatency(4, p) },
      { name: 'SLA Violation Rate', unit: '%', target: 0.01, compute: (p) => 0.005 + p.loadFactor * 0.05 },
    ],
    mobile_core_srvc: [
      { name: 'Attach Success Rate', unit: '%', target: 99.9, compute: (p) => 99.97 - p.loadFactor * 0.15 },
      { name: 'Session Density', unit: 'sessions/s', target: 50000, compute: (p) => Math.round(80000 * (1 - p.loadFactor * 0.3)) },
      { name: 'Bearer Setup Time', unit: 'ms', target: 50, compute: (p) => computeLatency(15, p) },
      { name: 'SGW Throughput', unit: 'Gbps', target: 10, compute: (p) => computeThroughput(15, p) },
      { name: 'PGW Throughput', unit: 'Gbps', target: 10, compute: (p) => computeThroughput(15, p) },
      { name: 'MME Load', unit: '%', target: 60, compute: (p) => computeCPU(p) },
      { name: 'HSS Query Latency', unit: 'ms', target: 20, compute: (p) => computeLatency(5, p) },
      { name: 'PCRF Update Latency', unit: 'ms', target: 30, compute: (p) => computeLatency(10, p) },
      { name: 'E-RAB Setup Success', unit: '%', target: 99.5, compute: (p) => 99.8 - p.loadFactor * 0.5 },
      { name: 'Detach Success Rate', unit: '%', target: 99.9, compute: (p) => 99.95 - p.loadFactor * 0.1 },
      { name: 'Handover Prepare Time', unit: 'ms', target: 50, compute: (p) => computeLatency(18, p) },
      { name: 'TAU Success Rate', unit: '%', target: 99.8, compute: (p) => 99.9 - p.loadFactor * 0.2 },
      { name: 'AMF Registration (5GC)', unit: '%', target: 99.9, compute: (p) => 99.95 - p.loadFactor * 0.1 },
      { name: 'SMF PDU Session Setup', unit: 'ms', target: 40, compute: (p) => computeLatency(12, p) },
    ],
    sms_mms_srvc: [
      { name: 'SMS Delivery Rate', unit: '%', target: 99.9, compute: (p) => 99.95 - p.loadFactor * 0.15 },
      { name: 'SMS Delivery Latency', unit: 'ms', target: 5000, compute: (p) => computeLatency(1500, p) },
      { name: 'MMS Delivery Rate', unit: '%', target: 99.5, compute: (p) => 99.8 - p.loadFactor * 0.5 },
      { name: 'MMS Delivery Latency', unit: 'ms', target: 10000, compute: (p) => computeLatency(3000, p) },
      { name: 'SMSC Throughput', unit: 'msg/s', target: 10000, compute: (p) => Math.round(15000 * (1 - p.loadFactor * 0.35)) },
      { name: 'Storage Utilization', unit: '%', target: 50, compute: (p) => computeMemory(p) },
    ],
    dns_cdn_srvc: [
      { name: 'DNS Resolution Time', unit: 'ms', target: 15, compute: (p) => computeLatency(5, p) },
      { name: 'DNS Cache Hit Ratio', unit: '%', target: 95, compute: (p) => 98 - p.loadFactor * 3 },
      { name: 'CDN Hit Ratio', unit: '%', target: 92, compute: (p) => 96 - p.loadFactor * 5 },
      { name: 'CDN Origin Latency', unit: 'ms', target: 50, compute: (p) => computeLatency(20, p) },
      { name: 'DNS Query Rate', unit: 'qps', target: 500000, compute: (p) => Math.round(800000 * (1 - p.loadFactor * 0.25)) },
      { name: 'Edge Node Availability', unit: '%', target: 99.99, compute: (p) => 99.998 - p.loadFactor * 0.01 },
      { name: 'SSL Handshake Time', unit: 'ms', target: 50, compute: (p) => computeLatency(15, p) },
    ],
    cloud_vnf_srvc: [
      { name: 'vCPU Utilization', unit: '%', target: 65, compute: (p) => computeCPU(p) },
      { name: 'Memory Utilization', unit: '%', target: 70, compute: (p) => computeMemory(p) },
      { name: 'vCPU Ready', unit: 'ms', target: 5, compute: (p) => 2 + p.loadFactor * 15 },
      { name: 'Storage IOPS', unit: 'K', target: 500, compute: (p) => Math.round(600 * (1 - p.loadFactor * 0.3) / 1000) },
      { name: 'Network Bandwidth', unit: 'Gbps', target: 25, compute: (p) => computeThroughput(40, p) },
      { name: 'VM Provisioning Time', unit: 's', target: 60, compute: (p) => 30 + p.loadFactor * 45 },
      { name: 'Auto-Scaling Response', unit: 's', target: 120, compute: (p) => 60 + p.loadFactor * 90 },
      { name: 'Container Restart Rate', unit: '/h', target: 0.5, compute: (p) => 0.1 + p.loadFactor * 0.8 },
      { name: 'API Gateway Latency', unit: 'ms', target: 10, compute: (p) => computeLatency(3, p) },
      { name: 'Service Mesh Latency', unit: 'ms', target: 5, compute: (p) => computeLatency(1.5, p) },
      { name: 'VNF Instantiation', unit: 's', target: 180, compute: (p) => 90 + p.loadFactor * 120 },
      { name: 'Resource Oversubscription', unit: '%', target: 30, compute: (p) => p.loadFactor * 50 },
      { name: 'Health Check Pass Rate', unit: '%', target: 99.9, compute: (p) => 99.95 - p.loadFactor * 0.2 },
    ],
  };

  return kpiMap[serviceType] || [];
}

// ============================================
// COMPUTE SERVICE HEALTH
// ============================================

function computeServiceHealth(serviceType: ServiceType, serviceIndex: number): ServiceHealth {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const config = SERVICE_DEFINITIONS[serviceType];
  const loadFactor = getLoadFactor(hour, dayOfWeek);

  const params: ServiceComputeParams = { hour, dayOfWeek, loadFactor, baseSubscribers: config.baseSubscribers, serviceIndex };

  const kpis = getKPIs(serviceType);
  const kpiResults: Record<string, { value: number; unit: string; target: number; status: 'ok' | 'warning' | 'critical' }> = {};

  let kpiOkCount = 0;
  let kpiWarningCount = 0;
  let kpiCriticalCount = 0;

  for (const kpi of kpis) {
    const value = kpi.compute(params);
    // Determine status based on deviation from target
    const deviation = Math.abs(value - kpi.target) / Math.max(0.001, Math.abs(kpi.target));

    // For metrics where lower is better (latency, loss, jitter, cpu, memory)
    const lowerIsBetter = ['ms', '%', 'dBm', 'dB', 's', '/h'].includes(kpi.unit) &&
      !['%', '%', '%', '%'].includes(kpi.unit) || // Skip percentages that are ratios
      ['Latency', 'Loss', 'Jitter', 'Utilization', 'CPU', 'Memory', 'Ready', 'Violation', 'Restart', 'Oversubscription', 'Freeze'].some(k => kpi.name.includes(k));

    let status: 'ok' | 'warning' | 'critical';
    if (lowerIsBetter) {
      if (value <= kpi.target * 1.1) status = 'ok';
      else if (value <= kpi.target * 1.5) status = 'warning';
      else status = 'critical';
    } else {
      if (value >= kpi.target * 0.95) status = 'ok';
      else if (value >= kpi.target * 0.85) status = 'warning';
      else status = 'critical';
    }

    kpiResults[kpi.name] = { value: Math.round(value * 100) / 100, unit: kpi.unit, target: kpi.target, status };
    if (status === 'ok') kpiOkCount++;
    else if (status === 'warning') kpiWarningCount++;
    else kpiCriticalCount++;
  }

  // Compute health score: weighted average of KPI statuses
  const totalKPIs = kpis.length;
  const score = (kpiOkCount * 1.0 + kpiWarningCount * 0.5 + kpiCriticalCount * 0.1) / Math.max(1, totalKPIs);

  // Availability
  const availability = computeAvailability(params, config.slaTarget, config.degradeThreshold, config.outageThreshold);

  // Determine status and health level
  let status: ServiceStatus;
  let healthLevel: HealthLevel;

  if (loadFactor >= config.outageThreshold) {
    status = 'partial_outage';
    healthLevel = 'CRITICAL';
  } else if (loadFactor >= config.degradeThreshold) {
    status = 'degraded';
    healthLevel = score > 0.7 ? 'ACCEPTABLE' : 'POOR';
  } else if (score > 0.95) {
    status = 'operational';
    healthLevel = 'EXCELLENT';
  } else {
    status = 'operational';
    healthLevel = 'GOOD';
  }

  // Subscribers (deterministic based on hour)
  const hourMultiplier = 0.85 + 0.15 * Math.sin(Math.PI * (hour - 4) / 12);
  const activeSubscribers = Math.round(config.baseSubscribers * hourMultiplier);

  // Throughput
  const throughput = computeThroughput(
    serviceType === 'broadband_srvc' ? 2.5 :
    serviceType === '5g_nr_srvc' ? 1.5 :
    serviceType === 'mobile_core_srvc' ? 5.0 :
    serviceType === 'vpn_enterprise_srvc' ? 0.5 :
    serviceType === 'dns_cdn_srvc' ? 3.0 :
    serviceType === 'cloud_vnf_srvc' ? 2.0 :
    0.3,
    params
  );

  // Issues and recommendations
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (status === 'partial_outage') {
    issues.push('Service capacity threshold exceeded');
    issues.push(`${kpiCriticalCount} KPIs in critical range`);
    issues.push('Elevated error rate detected across platform');
    recommendations.push('Enable additional capacity immediately');
    recommendations.push('Investigate root cause - escalate to L3');
    recommendations.push('Notify affected subscribers via SMS/push');
  } else if (status === 'degraded') {
    if (kpiCriticalCount > 0) issues.push(`${kpiCriticalCount} KPI(s) in critical: ${kpis.filter(k => kpiResults[k.name]?.status === 'critical').map(k => k.name).join(', ')}`);
    if (kpiWarningCount > 2) issues.push(`${kpiWarningCount} KPIs in warning state`);
    recommendations.push('Monitor closely for escalation');
    recommendations.push('Consider load balancing adjustment');
    if (kpiCriticalCount > 0) recommendations.push('Evaluate vendor-side performance');
  } else if (kpiWarningCount > 0) {
    issues.push(`${kpiWarningCount} KPI(s) approaching threshold`);
    recommendations.push('Continue standard monitoring');
  }

  return {
    status,
    health_level: healthLevel,
    score: Math.round(score * 100) / 100,
    availability_24h: Math.round(availability * 100) / 100,
    kpis: kpiResults,
    active_subscribers: activeSubscribers,
    throughput_gbps: Math.round(throughput * 100) / 100,
    vendors: config.vendors,
    issues,
    recommendations,
    last_check: new Date().toISOString(),
    sla_target: config.slaTarget,
    sla_actual: Math.round(availability * 100) / 100,
  };
}

// ============================================
// CACHE
// ============================================

let cache: { data: Record<string, { health: ServiceHealth; config: ServiceConfig }>; timestamp: number } | null = null;
const CACHE_TTL = 5000;

function getAllServices(): Record<string, { health: ServiceHealth; config: ServiceConfig }> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  const allServiceTypes: ServiceType[] = [
    'volte_srvc', '5g_nr_srvc', 'broadband_srvc', 'iptv_srvc', 'voip_ims_srvc',
    'vpn_enterprise_srvc', 'mobile_core_srvc', 'sms_mms_srvc', 'dns_cdn_srvc', 'cloud_vnf_srvc',
  ];

  const services: Record<string, { health: ServiceHealth; config: ServiceConfig }> = {};

  for (let i = 0; i < allServiceTypes.length; i++) {
    const type = allServiceTypes[i];
    const health = computeServiceHealth(type, i);
    services[type] = {
      health,
      config: SERVICE_DEFINITIONS[type],
    };
  }

  cache = { data: services, timestamp: now };
  return services;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const serviceType = searchParams.get('service') as ServiceType | null;

  try {
    if (!serviceType) {
      const services = getAllServices();
      const serviceValues = Object.values(services);

      const summary = {
        total: serviceValues.length,
        operational: serviceValues.filter(s => s.health.status === 'operational').length,
        degraded: serviceValues.filter(s => s.health.status === 'degraded').length,
        outage: serviceValues.filter(s => ['partial_outage', 'full_outage'].includes(s.health.status)).length,
        avg_availability: Math.round(serviceValues.reduce((sum, s) => sum + s.health.availability_24h, 0) / serviceValues.length * 100) / 100,
        total_subscribers: serviceValues.reduce((sum, s) => sum + s.health.active_subscribers, 0),
        total_throughput_gbps: Math.round(serviceValues.reduce((sum, s) => sum + s.health.throughput_gbps, 0) * 10) / 10,
      };

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        services,
        summary,
        serviceConfig: SERVICE_DEFINITIONS,
      });
    }

    if (SERVICE_DEFINITIONS[serviceType]) {
      const allServiceTypes: ServiceType[] = [
        'volte_srvc', '5g_nr_srvc', 'broadband_srvc', 'iptv_srvc', 'voip_ims_srvc',
        'vpn_enterprise_srvc', 'mobile_core_srvc', 'sms_mms_srvc', 'dns_cdn_srvc', 'cloud_vnf_srvc',
      ];
      const idx = allServiceTypes.indexOf(serviceType);
      const health = computeServiceHealth(serviceType, idx);

      return NextResponse.json({
        success: true,
        service: serviceType,
        config: SERVICE_DEFINITIONS[serviceType],
        health,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid service type' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
