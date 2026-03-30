// ============================================
// NET'S AI SECURITY AGENT - Training Data Generator
// Massive Dataset for AI Training
// ============================================

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  NETWORK_ELEMENTS: 500,      // عدد عناصر الشبكة
  ALARMS_PER_ELEMENT: 20,     // إنذارات لكل عنصر
  LOGS_PER_ELEMENT: 100,      // سجلات لكل عنصر
  SECURITY_EVENTS: 5000,      // أحداث أمنية
  PROVISIONING_TASKS: 200,    // مهام تكوين
  USERS: 50,                  // مستخدمين
};

// ============================================
// VENDOR DATA
// ============================================
const VENDORS = ['cisco', 'huawei', 'nokia', 'juniper', 'ericsson', 'tp-link'] as const;
const ELEMENT_TYPES = ['router', 'switch', 'firewall', 'server', 'loadbalancer', 'wireless'] as const;
const REGIONS = ['Tunis', 'Sfax', 'Sousse', 'Gabes', 'Bizerte', 'Nabeul', 'Kairouan', 'Gafsa'];
const SITES = ['DataCenter-1', 'DataCenter-2', 'HeadQuarters', 'Branch-North', 'Branch-South', 'Branch-Central', 'DR-Site'];

const VENDOR_MODELS: Record<string, string[]> = {
  cisco: ['Catalyst-9300', 'Catalyst-9500', 'ASR-1001', 'ASR-9001', 'Nexus-9000', 'ISR-4000', 'Firepower-4100', 'CSR-1000v'],
  huawei: ['CE-12800', 'AR-6300', 'S-7700', 'CloudEngine-16800', 'USG-6000E', 'NetEngine-8000', 'OceanStor-2600'],
  nokia: ['7750-SR', '7950-XRS', '1830-PSI', '7250-IXR', '6380-SAS', '5000-NSP'],
  juniper: ['MX-204', 'MX-960', 'EX-4300', 'QFX-5200', 'SRX-4100', 'PTX-1000', 'ACX-710'],
  ericsson: ['RAN-6660', 'RAN-6651', 'MINI-LINK-6600', 'Router-6000', 'SSR-8000'],
  'tp-link': [
    // SD-WAN / VPN Routers
    'ER605', 'ER7206', 'TL-ER6120', 'TL-ER6020', 'TL-R600VPN',
    // Omada Managed Switches
    'TL-SG3428X', 'TL-SG3428', 'TL-SG2428P', 'TL-SG2428X', 'TL-SG2210P', 'TL-SG108E', 'TL-SG116E',
    // JetStream Smart Managed Switches
    'TL-SG3428X-M2', 'TL-SG2428X-M2', 'TL-SG2218P', 'TL-SG3428P',
    // Omada EAP WiFi Access Points
    'EAP660 HD', 'EAP670', 'EAP660', 'EAP245', 'EAP225', 'EAP620 HD',
    // Omada SDN Controllers / Gateways
    'OC200', 'ER706W', 'ER605 v2',
    // Archer WiFi Routers
    'Archer AX73', 'Archer AX1800', 'Archer AX3000', 'Archer AX5400', 'Archer C7', 'Archer VR2600v',
    // Deco Mesh WiFi
    'Deco X60', 'Deco X20', 'Deco M5', 'Deco M4', 'Deco W2400',
  ],
};

const VENDOR_OS: Record<string, string[]> = {
  cisco: ['IOS-XE 17.9', 'IOS-XR 7.8', 'NX-OS 10.2', 'ASA 9.18'],
  huawei: ['VRP 8.180', 'VRP 5.170', 'CloudOS 8.0', 'VersaStack 1.0'],
  nokia: ['SR-OS 23.10', 'TiMOS 8.0', 'SROS 22.10'],
  juniper: ['JunOS 23.2', 'JunOS-EVO 21.4', 'Contrail 22.1'],
  ericsson: ['Ericsson-OS 2.0', 'MINI-LINK-CN 4.0'],
  'tp-link': [
    'Omada SDN Firmware 5.x', 'TP-Link Firmware 2.1', 'OpenWrt-based 3.x',
    'Omada Controller 5.14', 'TP-Link Firmware 1.3', 'Deco Firmware 3.2',
    'Archer Firmware 1.6', 'EAP Firmware 5.0',
  ],
};

// ============================================
// ALARM TEMPLATES
// ============================================
const ALARM_TEMPLATES = [
  // Critical Alarms
  { code: 'LINK-DOWN-001', name: 'Interface Down', severity: 'critical', category: 'connectivity', desc: 'Physical interface {interface} is down' },
  { code: 'BGP-DOWN-001', name: 'BGP Session Down', severity: 'critical', category: 'routing', desc: 'BGP session with peer {peer} is down' },
  { code: 'POWER-FAIL-001', name: 'Power Supply Failure', severity: 'critical', category: 'hardware', desc: 'Power supply unit {unit} has failed' },
  { code: 'FAN-FAIL-001', name: 'Fan Failure', severity: 'critical', category: 'hardware', desc: 'Cooling fan {fan} has stopped' },
  { code: 'CPU-HIGH-001', name: 'CPU Utilization Critical', severity: 'critical', category: 'performance', desc: 'CPU utilization exceeded 95%' },
  { code: 'MEM-HIGH-001', name: 'Memory Exhaustion', severity: 'critical', category: 'performance', desc: 'Memory usage exceeded 95%' },
  { code: 'SEC-BREACH-001', name: 'Security Breach Detected', severity: 'critical', category: 'security', desc: 'Potential security breach detected from IP {ip}' },
  { code: 'OPTICAL-LOSS-001', name: 'Optical Signal Loss', severity: 'critical', category: 'hardware', desc: 'Optical signal loss on port {port}' },
  
  // Major Alarms
  { code: 'LINK-DEG-001', name: 'Link Degradation', severity: 'major', category: 'connectivity', desc: 'High error rate on interface {interface}' },
  { code: 'BGP-FLAP-001', name: 'BGP Route Flapping', severity: 'major', category: 'routing', desc: 'BGP routes flapping for prefix {prefix}' },
  { code: 'CPU-WARN-001', name: 'CPU High Warning', severity: 'major', category: 'performance', desc: 'CPU utilization at {percent}%' },
  { code: 'MEM-WARN-001', name: 'Memory Warning', severity: 'major', category: 'performance', desc: 'Memory usage at {percent}%' },
  { code: 'DISK-HIGH-001', name: 'Disk Space Low', severity: 'major', category: 'performance', desc: 'Disk usage at {percent}%' },
  { code: 'TEMP-HIGH-001', name: 'Temperature High', severity: 'major', category: 'hardware', desc: 'Temperature at {temp}C exceeds threshold' },
  { code: 'AUTH-FAIL-001', name: 'Authentication Failures', severity: 'major', category: 'security', desc: 'Multiple authentication failures from {ip}' },
  { code: 'CONFIG-MISMATCH-001', name: 'Configuration Mismatch', severity: 'major', category: 'configuration', desc: 'Running config differs from startup' },
  
  // Minor Alarms
  { code: 'LINK-UTIL-001', name: 'Link Utilization High', severity: 'minor', category: 'performance', desc: 'Interface {interface} utilization at {percent}%' },
  { code: 'OSPF-ADJ-001', name: 'OSPF Adjacency Change', severity: 'minor', category: 'routing', desc: 'OSPF adjacency state change with {neighbor}' },
  { code: 'SNMP-TRAP-001', name: 'SNMP Trap Received', severity: 'minor', category: 'system', desc: 'SNMP trap received: {trap}' },
  { code: 'LLDP-CHANGE-001', name: 'LLDP Neighbor Change', severity: 'minor', category: 'connectivity', desc: 'LLDP neighbor {neighbor} changed' },
  { code: 'VLAN-MISMATCH-001', name: 'VLAN Mismatch', severity: 'minor', category: 'configuration', desc: 'VLAN mismatch on trunk port {port}' },
  
  // Warning Alarms
  { code: 'LOG-RATE-001', name: 'High Log Rate', severity: 'warning', category: 'system', desc: 'Log generation rate exceeded threshold' },
  { code: 'SESSION-LIMIT-001', name: 'Session Limit Warning', severity: 'warning', category: 'performance', desc: 'NAT session usage at {percent}%' },
  { code: 'CERT-EXPIRE-001', name: 'Certificate Expiring', severity: 'warning', category: 'security', desc: 'Certificate {cert} expires in {days} days' },
  { code: 'LICENSE-EXP-001', name: 'License Expiring', severity: 'warning', category: 'system', desc: 'License {license} expires in {days} days' },
  
  // Info Alarms
  { code: 'BACKUP-DONE-001', name: 'Backup Completed', severity: 'info', category: 'system', desc: 'Configuration backup completed successfully' },
  { code: 'USER-LOGIN-001', name: 'User Login', severity: 'info', category: 'security', desc: 'User {user} logged in from {ip}' },
  { code: 'FW-UPDATE-001', name: 'Firmware Update Available', severity: 'info', category: 'system', desc: 'New firmware version {version} available' },
  { code: 'HA-SWITCH-001', name: 'HA Failover', severity: 'info', category: 'system', desc: 'HA failover to secondary unit' },
];

// ============================================
// LOG TEMPLATES
// ============================================
const LOG_TEMPLATES = {
  emergency: [
    'System panic - kernel failure',
    'Hardware failure detected - system halted',
    'Critical memory corruption detected',
    'Security violation - system lockdown initiated',
  ],
  alert: [
    'Immediate action required: {service} service critical',
    'Security alert: Intrusion detection triggered',
    'System instability detected - potential crash imminent',
  ],
  critical: [
    'Critical process {process} terminated unexpectedly',
    'Database connection lost - {db}',
    'Network interface {interface} failed',
    'Power supply {unit} offline',
  ],
  error: [
    'Failed to establish connection to {host}',
    'Authentication failed for user {user} from {ip}',
    'Configuration commit failed: {reason}',
    'Script execution failed: {script}',
    'API call failed with status {status}',
    'SSL certificate verification failed for {host}',
    'BGP peer {peer} session establishment failed',
    'DNS resolution failed for {domain}',
  ],
  warning: [
    'High CPU usage detected: {percent}%',
    'Memory usage warning: {percent}%',
    'Disk space low: {percent}% remaining',
    'Connection timeout to {host}',
    'Rate limit exceeded for {service}',
    'License expiring in {days} days',
    'Certificate {cert} will expire soon',
    'Deprecated API call from {ip}',
    'SSH connection attempt from unknown host {ip}',
  ],
  notice: [
    'Configuration change by user {user}',
    'Interface {interface} status changed to {status}',
    'BGP peer {peer} session established',
    'User {user} logged in from {ip}',
    'Scheduled backup completed',
    'Firmware update staged: version {version}',
    'New neighbor detected: {neighbor}',
  ],
  info: [
    'Service {service} started',
    'Health check passed for {component}',
    'Metrics exported to monitoring system',
    'Configuration sync completed',
    'Session established with {host}',
    'Background task {task} completed',
    'Cache cleared for {service}',
    'Log rotation completed',
  ],
  debug: [
    'Processing request ID: {id}',
    'Cache hit for key: {key}',
    'Query executed in {time}ms',
    'Packet received: {bytes} bytes from {ip}',
    'Heartbeat received from {host}',
  ],
};

// ============================================
// SECURITY EVENT TEMPLATES
// ============================================
const SECURITY_EVENTS = [
  { action: 'login', success: true, desc: 'User login successful' },
  { action: 'login', success: false, desc: 'Failed login attempt' },
  { action: 'logout', success: true, desc: 'User logout' },
  { action: 'access_granted', success: true, desc: 'Resource access granted' },
  { action: 'access_denied', success: false, desc: 'Resource access denied' },
  { action: 'config_change', success: true, desc: 'Configuration modified' },
  { action: 'provisioning', success: true, desc: 'Provisioning task executed' },
  { action: 'alarm_ack', success: true, desc: 'Alarm acknowledged' },
];

const ATTACK_PATTERNS = [
  { type: 'brute_force', ips: ['10.0.0.100', '192.168.1.50', '172.16.0.200'], attempts: [10, 50, 100, 200] },
  { type: 'port_scan', ips: ['10.0.0.101', '192.168.1.51'], attempts: [100, 500, 1000] },
  { type: 'sql_injection', ips: ['10.0.0.102', '192.168.1.52'], attempts: [1, 5, 10] },
  { type: 'xss_attack', ips: ['10.0.0.103'], attempts: [1, 3, 5] },
  { type: 'ddos_attempt', ips: ['10.0.0.200', '10.0.0.201', '10.0.0.202'], attempts: [1000, 5000, 10000] },
  { type: 'privilege_escalation', ips: ['10.0.0.104'], attempts: [1, 2, 3] },
];

// ============================================
// HELPER FUNCTIONS
// ============================================
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomItems = <T>(arr: readonly T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const generateIP = () => {
  const prefixes = ['10.0', '172.16', '192.168', '10.1', '10.2'];
  return `${randomItem(prefixes)}.${random(0, 255)}.${random(1, 254)}`;
};

const generateMAC = () => {
  return Array(6).fill(0).map(() => random(0, 255).toString(16).padStart(2, '0')).join(':');
};

const generateInterface = () => {
  const types = ['GigabitEthernet', 'TenGigabitEthernet', 'FortyGigabitEthernet', 'HundredGigabitEthernet', 'Ethernet'];
  return `${randomItem(types)}/${random(0, 5)}/${random(0, 48)}`;
};

const generateTimestamp = (daysBack: number = 30) => {
  const now = Date.now();
  const start = now - (daysBack * 24 * 60 * 60 * 1000);
  return new Date(random(start, now));
};

const hashPassword = (password: string) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// ============================================
// DATA GENERATORS
// ============================================
async function generateUsers() {
  console.log('👥 Generating users...');
  const users = [];
  const roles = ['admin', 'operator', 'viewer'];
  const departments = ['NOC', 'Security', 'Operations', 'Engineering', 'IT'];
  
  for (let i = 0; i < CONFIG.USERS; i++) {
    const role = randomItem(roles);
    const user = await prisma.user.create({
      data: {
        email: `user${i + 1}@nets-ai.tn`,
        name: `User ${i + 1}`,
        password: hashPassword('Password123!'),
        role,
        department: randomItem(departments),
        isActive: Math.random() > 0.1,
        lastLogin: Math.random() > 0.5 ? generateTimestamp(7) : null,
      },
    });
    users.push(user);
  }
  console.log(`   ✅ Created ${users.length} users`);
  return users;
}

async function generateNetworkElements() {
  console.log('🌐 Generating network elements...');
  const elements = [];
  
  for (let i = 0; i < CONFIG.NETWORK_ELEMENTS; i++) {
    const vendor = randomItem(VENDORS);
    const element = await prisma.networkElement.create({
      data: {
        name: `${vendor.toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
        hostname: `${vendor}-device-${i + 1}.nets-ai.tn`,
        ipAddress: generateIP(),
        vendor,
        model: randomItem(VENDOR_MODELS[vendor] || ['Unknown']),
        osVersion: randomItem(VENDOR_OS[vendor] || ['Unknown']),
        elementType: randomItem(ELEMENT_TYPES),
        site: randomItem(SITES),
        region: randomItem(REGIONS),
        status: Math.random() > 0.05 ? 'active' : randomItem(['inactive', 'maintenance', 'unknown'] as const),
        lastSeen: generateTimestamp(1),
        capabilities: JSON.stringify({
          protocols: randomItems(['NETCONF', 'SSH', 'SNMP', 'RESTCONF', 'TL1'], 3),
          interfaces: random(24, 96),
          uptime: random(1, 365),
        }),
      },
    });
    elements.push(element);
  }
  console.log(`   ✅ Created ${elements.length} network elements`);
  return elements;
}

// Generate network elements for specific vendors only
async function generateNetworkElementsForVendors(vendors: readonly string[]) {
  console.log('🌐 Generating network elements for vendors:', vendors.join(', '));
  const elements = [];
  
  for (let i = 0; i < CONFIG.NETWORK_ELEMENTS; i++) {
    const vendor = randomItem(vendors);
    const element = await prisma.networkElement.create({
      data: {
        name: `${vendor.toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
        hostname: `${vendor}-device-${i + 1}.nets-ai.tn`,
        ipAddress: generateIP(),
        vendor,
        model: randomItem(VENDOR_MODELS[vendor] || ['Unknown']),
        osVersion: randomItem(VENDOR_OS[vendor] || ['Unknown']),
        elementType: randomItem(ELEMENT_TYPES),
        site: randomItem(SITES),
        region: randomItem(REGIONS),
        status: Math.random() > 0.05 ? 'active' : randomItem(['inactive', 'maintenance', 'unknown'] as const),
        lastSeen: generateTimestamp(1),
        capabilities: JSON.stringify({
          protocols: randomItems(['NETCONF', 'SSH', 'SNMP', 'RESTCONF', 'TL1'], 3),
          interfaces: random(24, 96),
          uptime: random(1, 365),
        }),
      },
    });
    elements.push(element);
  }
  console.log(`   ✅ Created ${elements.length} network elements`);
  return elements;
}

async function generateAlarms(elements: Awaited<ReturnType<typeof generateNetworkElements>>) {
  console.log('🚨 Generating alarms...');
  let alarmCount = 0;
  
  for (const element of elements) {
    const numAlarms = random(5, CONFIG.ALARMS_PER_ELEMENT);
    
    for (let i = 0; i < numAlarms; i++) {
      const template = randomItem(ALARM_TEMPLATES);
      const firstSeen = generateTimestamp(30);
      const lastSeen = new Date(firstSeen.getTime() + random(0, 7 * 24 * 60 * 60 * 1000));
      
      let description = template.desc
        .replace('{interface}', generateInterface())
        .replace('{peer}', generateIP())
        .replace('{unit}', String(random(1, 4)))
        .replace('{fan}', String(random(1, 8)))
        .replace('{ip}', generateIP())
        .replace('{port}', generateInterface())
        .replace('{percent}', String(random(70, 99)))
        .replace('{temp}', String(random(40, 80)))
        .replace('{prefix}', `10.${random(0, 255)}.0.0/16`)
        .replace('{trap}', randomItem(['linkDown', 'coldStart', 'warmStart', 'authFailure']))
        .replace('{neighbor}', generateIP())
        .replace('{cert}', `cert-${random(1, 10)}`)
        .replace('{license}', `license-${random(1, 5)}`)
        .replace('{days}', String(random(1, 30)))
        .replace('{user}', `user${random(1, 50)}`)
        .replace('{version}', `${random(1, 10)}.${random(0, 20)}`);
      
      await prisma.alarm.create({
        data: {
          networkElementId: element.id,
          severity: template.severity as any,
          alarmCode: template.code,
          alarmName: template.name,
          description,
          source: element.ipAddress,
          category: template.category,
          status: Math.random() > 0.3 ? 'active' : randomItem(['acknowledged', 'cleared'] as const),
          acknowledgedBy: Math.random() > 0.5 ? `user${random(1, 10)}` : null,
          acknowledgedAt: Math.random() > 0.5 ? generateTimestamp(7) : null,
          clearedAt: Math.random() > 0.7 ? generateTimestamp(7) : null,
          firstSeen,
          lastSeen,
          count: random(1, 100),
          rawMessage: description,
          metadata: JSON.stringify({
            vendor: element.vendor,
            site: element.site,
            region: element.region,
          }),
        },
      });
      alarmCount++;
    }
  }
  console.log(`   ✅ Created ${alarmCount} alarms`);
}

async function generateLogs(elements: Awaited<ReturnType<typeof generateNetworkElements>>) {
  console.log('📝 Generating logs...');
  let logCount = 0;
  const logLevels = Object.keys(LOG_TEMPLATES) as (keyof typeof LOG_TEMPLATES)[];
  const logTypes = ['system', 'security', 'audit', 'config', 'performance', 'access'];
  
  for (const element of elements) {
    const numLogs = random(50, CONFIG.LOGS_PER_ELEMENT);
    
    for (let i = 0; i < numLogs; i++) {
      const level = randomItem(logLevels);
      const template = randomItem(LOG_TEMPLATES[level]);
      
      let message = template
        .replace('{service}', randomItem(['SSH', 'HTTP', 'SNMP', 'BGP', 'OSPF', 'DNS']))
        .replace('{process}', randomItem(['systemd', 'nginx', 'sshd', 'snmpd', 'bgpd']))
        .replace('{interface}', generateInterface())
        .replace('{host}', generateIP())
        .replace('{user}', `user${random(1, 50)}`)
        .replace('{ip}', generateIP())
        .replace('{db}', randomItem(['primary', 'secondary', 'analytics']))
        .replace('{unit}', String(random(1, 4)))
        .replace('{reason}', randomItem(['validation error', 'timeout', 'permission denied']))
        .replace('{script}', `script_${random(1, 20)}.sh`)
        .replace('{status}', String(random(400, 599)))
        .replace('{peer}', generateIP())
        .replace('{domain}', randomItem(['example.com', 'internal.net', 'api.local']))
        .replace('{percent}', String(random(60, 99)))
        .replace('{days}', String(random(1, 30)))
        .replace('{cert}', `cert-${random(1, 10)}`)
        .replace('{neighbor}', generateIP())
        .replace('{component}', randomItem(['CPU', 'Memory', 'Disk', 'Network']))
        .replace('{version}', `${random(1, 10)}.${random(0, 20)}`)
        .replace('{id}', crypto.randomUUID().substring(0, 8))
        .replace('{key}', `cache_key_${random(1, 100)}`)
        .replace('{time}', String(random(1, 500)))
        .replace('{bytes}', String(random(64, 65535)))
        .replace('{status}', randomItem(['up', 'down', 'degraded']));
      
      await prisma.log.create({
        data: {
          networkElementId: element.id,
          timestamp: generateTimestamp(7),
          logLevel: level,
          facility: randomItem(['kern', 'user', 'mail', 'daemon', 'auth', 'syslog', 'local0', 'local7']),
          source: element.ipAddress,
          process: randomItem(['kernel', 'systemd', 'sshd', 'snmpd', 'nginx', 'bgpd', 'ospfd']),
          message,
          rawLog: message,
          parsed: Math.random() > 0.3,
          logType: randomItem(logTypes as any),
          metadata: Math.random() > 0.5 ? JSON.stringify({
            severity: level,
            facility: random(0, 23),
          }) : null,
        },
      });
      logCount++;
    }
  }
  console.log(`   ✅ Created ${logCount} logs`);
}

async function generateProvisioningTasks(elements: Awaited<ReturnType<typeof generateNetworkElements>>, users: Awaited<ReturnType<typeof generateUsers>>) {
  console.log('⚙️ Generating provisioning tasks...');
  const taskTypes = ['config_push', 'firmware_update', 'backup', 'restore', 'provision', 'discover'];
  const priorities = ['low', 'medium', 'high', 'critical'];
  const statuses = ['pending', 'in_progress', 'completed', 'failed'];
  
  for (let i = 0; i < CONFIG.PROVISIONING_TASKS; i++) {
    const element = randomItem(elements);
    const status = randomItem(statuses as any);
    const startedAt = status !== 'pending' ? generateTimestamp(7) : null;
    const completedAt = status === 'completed' || status === 'failed' ? 
      (startedAt ? new Date(startedAt.getTime() + random(60000, 3600000)) : null) : null;
    
    await prisma.provisioningTask.create({
      data: {
        networkElementId: element.id,
        createdById: randomItem(users).id,
        taskType: randomItem(taskTypes as any),
        status,
        priority: randomItem(priorities as any),
        description: `${randomItem(taskTypes).replace('_', ' ')} for ${element.name}`,
        configData: Math.random() > 0.5 ? JSON.stringify({
          vlan: random(1, 4094),
          interface: generateInterface(),
          ip: generateIP(),
        }) : null,
        protocol: randomItem(['NETCONF', 'SSH', 'RESTCONF', 'SNMP'] as any),
        scheduledAt: Math.random() > 0.7 ? generateTimestamp(7) : null,
        startedAt,
        completedAt,
        result: status === 'completed' ? 'Success: Configuration applied' : 
                status === 'failed' ? 'Error: Connection timeout' : null,
        errorDetails: status === 'failed' ? 'Connection timeout after 30 seconds' : null,
        retryCount: status === 'failed' ? random(1, 3) : 0,
        maxRetries: 3,
      },
    });
  }
  console.log(`   ✅ Created ${CONFIG.PROVISIONING_TASKS} provisioning tasks`);
}

async function generateSecurityAudits(users: Awaited<ReturnType<typeof generateUsers>>) {
  console.log('🔒 Generating security audits...');
  let auditCount = 0;
  
  // Normal security events
  for (let i = 0; i < CONFIG.SECURITY_EVENTS; i++) {
    const event = randomItem(SECURITY_EVENTS);
    const user = Math.random() > 0.1 ? randomItem(users) : null;
    
    await prisma.securityAudit.create({
      data: {
        userId: user?.id,
        action: event.action as any,
        resource: randomItem(['/api/alarms', '/api/logs', '/api/network-elements', '/api/provisioning', '/api/security']),
        resourceType: randomItem(['alarm', 'log', 'network_element', 'provisioning_task', 'user']),
        result: event.success ? 'success' : (Math.random() > 0.5 ? 'failure' : 'denied'),
        ipAddress: generateIP(),
        userAgent: randomItem(['Mozilla/5.0', 'curl/7.68.0', 'Python-requests/2.28.0', 'NOC-Agent/1.0']),
        details: JSON.stringify({ description: event.desc }),
        riskLevel: event.success ? 'low' : randomItem(['medium', 'high', 'critical'] as any),
        timestamp: generateTimestamp(30),
      },
    });
    auditCount++;
  }
  
  // Attack patterns
  for (const attack of ATTACK_PATTERNS) {
    for (const ip of attack.ips) {
      const attempts = randomItem(attack.attempts);
      for (let i = 0; i < Math.min(attempts, 20); i++) {
        await prisma.securityAudit.create({
          data: {
            userId: null,
            action: 'access_denied' as any,
            resource: randomItem(['/api/auth', '/api/admin', '/api/config']),
            resourceType: 'security',
            result: 'denied',
            ipAddress: ip,
            userAgent: randomItem(['curl/7.68.0', 'Python-requests/2.28.0', 'Nmap/7.80', 'Unknown']),
            details: JSON.stringify({ attackType: attack.type, suspicious: true }),
            riskLevel: 'critical' as any,
            timestamp: generateTimestamp(7),
          },
        });
        auditCount++;
      }
    }
  }
  console.log(`   ✅ Created ${auditCount} security audits`);
}

async function generateVendorConfigs() {
  console.log('🔧 Generating vendor configurations...');
  for (const vendor of VENDORS) {
    await prisma.vendorConfig.create({
      data: {
        vendorName: vendor,
        protocols: JSON.stringify(randomItems(['NETCONF', 'SSH', 'SNMP', 'RESTCONF', 'TL1'], 4)),
        defaultPort: vendor === 'cisco' ? 830 : vendor === 'huawei' ? 830 : vendor === 'tp-link' ? 443 : 22,
        apiEndpoint: `https://api.${vendor}.com/nets-ai`,
        credentials: JSON.stringify({ encrypted: true, type: 'ssh-key' }),
        configTemplates: JSON.stringify({
          backup: `show running-config`,
          interfaces: `show interfaces`,
          version: `show version`,
        }),
      },
    });
  }
  console.log(`   ✅ Created ${VENDORS.length} vendor configurations`);
}

async function generateNotificationRules() {
  console.log('🔔 Generating notification rules...');
  const rules = [
    { name: 'Critical Alarm Alert', condition: JSON.stringify({ severity: 'critical', status: 'active' }), channels: JSON.stringify(['email', 'sms', 'webhook']) },
    { name: 'Security Breach Alert', condition: JSON.stringify({ category: 'security', riskLevel: 'critical' }), channels: JSON.stringify(['email', 'sms']) },
    { name: 'Device Offline Alert', condition: JSON.stringify({ status: 'inactive' }), channels: JSON.stringify(['email']) },
    { name: 'Provisioning Failure', condition: JSON.stringify({ status: 'failed' }), channels: JSON.stringify(['email', 'webhook']) },
    { name: 'High CPU Alert', condition: JSON.stringify({ alarmCode: 'CPU-HIGH-001' }), channels: JSON.stringify(['email']) },
  ];
  
  for (const rule of rules) {
    await prisma.notificationRule.create({
      data: {
        name: rule.name,
        description: `Auto-generated rule for ${rule.name}`,
        condition: rule.condition,
        channels: rule.channels,
        recipients: JSON.stringify(['admin@nets-ai.tn', 'noc@nets-ai.tn']),
        isActive: true,
      },
    });
  }
  console.log(`   ✅ Created ${rules.length} notification rules`);
}

async function generateSystemConfigs() {
  console.log('⚙️ Generating system configurations...');
  const configs = [
    { key: 'system.name', value: "Net's AI Security Agent", description: 'System name', category: 'system' },
    { key: 'system.version', value: '1.0.0', description: 'System version', category: 'system' },
    { key: 'alarm.auto_acknowledge', value: 'false', description: 'Auto acknowledge alarms', category: 'alarm' },
    { key: 'alarm.retention_days', value: '90', description: 'Alarm retention in days', category: 'alarm' },
    { key: 'log.retention_days', value: '30', description: 'Log retention in days', category: 'log' },
    { key: 'security.max_login_attempts', value: '5', description: 'Max login attempts before lockout', category: 'security' },
    { key: 'security.lockout_duration', value: '900', description: 'Lockout duration in seconds', category: 'security' },
    { key: 'security.session_timeout', value: '28800', description: 'Session timeout in seconds', category: 'security' },
    { key: 'provisioning.max_retries', value: '3', description: 'Max provisioning retries', category: 'provisioning' },
    { key: 'notification.email_enabled', value: 'true', description: 'Enable email notifications', category: 'notification' },
  ];
  
  for (const config of configs) {
    await prisma.systemConfig.create({
      data: {
        key: config.key,
        value: config.value,
        description: config.description,
        category: config.category,
      },
    });
  }
  console.log(`   ✅ Created ${configs.length} system configurations`);
}

// ============================================
// MAIN SEED FUNCTION
// ============================================
async function generateTPLinkElements() {
  console.log('🌐 Generating TP-LINK network elements...');
  const elements = [];

  // TP-LINK device definitions with realistic names, models, and sites
  const tpLinkDevices = [
    // === SD-WAN / VPN Routers (15) ===
    { name: 'TPLINK-SDWAN-HQ-01', hostname: 'tplink-sdwan-hq-01.nets-ai.tn', model: 'ER7206', type: 'router', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-SDWAN-HQ-02', hostname: 'tplink-sdwan-hq-02.nets-ai.tn', model: 'ER7206', type: 'router', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-VPN-DC1-01', hostname: 'tplink-vpn-dc1-01.nets-ai.tn', model: 'TL-ER6120', type: 'router', site: 'DataCenter-1', region: 'Tunis' },
    { name: 'TPLINK-VPN-DC2-01', hostname: 'tplink-vpn-dc2-01.nets-ai.tn', model: 'TL-ER6120', type: 'router', site: 'DataCenter-2', region: 'Sfax' },
    { name: 'TPLINK-SDWAN-BN-01', hostname: 'tplink-sdwan-bn-01.nets-ai.tn', model: 'ER605', type: 'router', site: 'Branch-North', region: 'Bizerte' },
    { name: 'TPLINK-SDWAN-BN-02', hostname: 'tplink-sdwan-bn-02.nets-ai.tn', model: 'ER605 v2', type: 'router', site: 'Branch-North', region: 'Nabeul' },
    { name: 'TPLINK-SDWAN-BS-01', hostname: 'tplink-sdwan-bs-01.nets-ai.tn', model: 'ER605', type: 'router', site: 'Branch-South', region: 'Gabes' },
    { name: 'TPLINK-SDWAN-BS-02', hostname: 'tplink-sdwan-bs-02.nets-ai.tn', model: 'ER605 v2', type: 'router', site: 'Branch-South', region: 'Gafsa' },
    { name: 'TPLINK-SDWAN-BC-01', hostname: 'tplink-sdwan-bc-01.nets-ai.tn', model: 'ER605', type: 'router', site: 'Branch-Central', region: 'Sousse' },
    { name: 'TPLINK-SDWAN-BC-02', hostname: 'tplink-sdwan-bc-02.nets-ai.tn', model: 'ER605', type: 'router', site: 'Branch-Central', region: 'Kairouan' },
    { name: 'TPLINK-VPN-DR-01', hostname: 'tplink-vpn-dr-01.nets-ai.tn', model: 'TL-R600VPN', type: 'router', site: 'DR-Site', region: 'Tunis' },
    { name: 'TPLINK-ER6020-SF-01', hostname: 'tplink-er6020-sf-01.nets-ai.tn', model: 'TL-ER6020', type: 'router', site: 'DataCenter-1', region: 'Sfax' },
    { name: 'TPLINK-ER706W-SF-01', hostname: 'tplink-er706w-sf-01.nets-ai.tn', model: 'ER706W', type: 'router', site: 'HeadQuarters', region: 'Sfax' },
    { name: 'TPLINK-VR2600-BC-01', hostname: 'tplink-vr2600-bc-01.nets-ai.tn', model: 'Archer VR2600v', type: 'router', site: 'Branch-Central', region: 'Kairouan' },
    { name: 'TPLINK-AX3000-HQ-01', hostname: 'tplink-ax3000-hq-01.nets-ai.tn', model: 'Archer AX3000', type: 'router', site: 'HeadQuarters', region: 'Tunis' },

    // === Omada Managed Switches (20) ===
    { name: 'TPLINK-SW-DC1-01', hostname: 'tplink-sw-dc1-01.nets-ai.tn', model: 'TL-SG3428X', type: 'switch', site: 'DataCenter-1', region: 'Tunis' },
    { name: 'TPLINK-SW-DC1-02', hostname: 'tplink-sw-dc1-02.nets-ai.tn', model: 'TL-SG3428X', type: 'switch', site: 'DataCenter-1', region: 'Tunis' },
    { name: 'TPLINK-SW-DC2-01', hostname: 'tplink-sw-dc2-01.nets-ai.tn', model: 'TL-SG3428', type: 'switch', site: 'DataCenter-2', region: 'Sfax' },
    { name: 'TPLINK-SW-HQ-01', hostname: 'tplink-sw-hq-01.nets-ai.tn', model: 'TL-SG3428X-M2', type: 'switch', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-SW-HQ-02', hostname: 'tplink-sw-hq-02.nets-ai.tn', model: 'TL-SG2428P', type: 'switch', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-SW-BN-01', hostname: 'tplink-sw-bn-01.nets-ai.tn', model: 'TL-SG2428X', type: 'switch', site: 'Branch-North', region: 'Bizerte' },
    { name: 'TPLINK-SW-BN-02', hostname: 'tplink-sw-bn-02.nets-ai.tn', model: 'TL-SG2428P', type: 'switch', site: 'Branch-North', region: 'Nabeul' },
    { name: 'TPLINK-SW-BS-01', hostname: 'tplink-sw-bs-01.nets-ai.tn', model: 'TL-SG2428P', type: 'switch', site: 'Branch-South', region: 'Gabes' },
    { name: 'TPLINK-SW-BS-02', hostname: 'tplink-sw-bs-02.nets-ai.tn', model: 'TL-SG2428X-M2', type: 'switch', site: 'Branch-South', region: 'Gafsa' },
    { name: 'TPLINK-SW-BC-01', hostname: 'tplink-sw-bc-01.nets-ai.tn', model: 'TL-SG2210P', type: 'switch', site: 'Branch-Central', region: 'Sousse' },
    { name: 'TPLINK-SW-BC-02', hostname: 'tplink-sw-bc-02.nets-ai.tn', model: 'TL-SG2210P', type: 'switch', site: 'Branch-Central', region: 'Kairouan' },
    { name: 'TPLINK-SW-DR-01', hostname: 'tplink-sw-dr-01.nets-ai.tn', model: 'TL-SG3428P', type: 'switch', site: 'DR-Site', region: 'Tunis' },
    { name: 'TPLINK-SW-AGG-01', hostname: 'tplink-sw-agg-01.nets-ai.tn', model: 'TL-SG3428P', type: 'switch', site: 'DataCenter-1', region: 'Tunis' },
    { name: 'TPLINK-SW-ACC-SF01', hostname: 'tplink-sw-acc-sf01.nets-ai.tn', model: 'TL-SG108E', type: 'switch', site: 'Branch-Central', region: 'Sfax' },
    { name: 'TPLINK-SW-ACC-NB01', hostname: 'tplink-sw-acc-nb01.nets-ai.tn', model: 'TL-SG116E', type: 'switch', site: 'Branch-North', region: 'Nabeul' },
    { name: 'TPLINK-SW-ACC-GB01', hostname: 'tplink-sw-acc-gb01.nets-ai.tn', model: 'TL-SG108E', type: 'switch', site: 'Branch-South', region: 'Gabes' },
    { name: 'TPLINK-SW-FLOOR-HQ01', hostname: 'tplink-sw-floor-hq01.nets-ai.tn', model: 'TL-SG2218P', type: 'switch', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-SW-FLOOR-HQ02', hostname: 'tplink-sw-floor-hq02.nets-ai.tn', model: 'TL-SG2218P', type: 'switch', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-SW-POE-DC1-01', hostname: 'tplink-sw-poe-dc1-01.nets-ai.tn', model: 'TL-SG2428P', type: 'switch', site: 'DataCenter-1', region: 'Tunis' },
    { name: 'TPLINK-SW-POE-DC2-01', hostname: 'tplink-sw-poe-dc2-01.nets-ai.tn', model: 'TL-SG2428P', type: 'switch', site: 'DataCenter-2', region: 'Sfax' },

    // === WiFi Access Points / EAP Series (20) ===
    { name: 'TPLINK-EAP-HQ-F1-01', hostname: 'tplink-eap-hq-f1-01.nets-ai.tn', model: 'EAP660 HD', type: 'wireless', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-EAP-HQ-F1-02', hostname: 'tplink-eap-hq-f1-02.nets-ai.tn', model: 'EAP660 HD', type: 'wireless', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-EAP-HQ-F2-01', hostname: 'tplink-eap-hq-f2-01.nets-ai.tn', model: 'EAP670', type: 'wireless', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-EAP-HQ-F2-02', hostname: 'tplink-eap-hq-f2-02.nets-ai.tn', model: 'EAP670', type: 'wireless', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-EAP-HQ-CONF-01', hostname: 'tplink-eap-hq-conf-01.nets-ai.tn', model: 'EAP660', type: 'wireless', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-EAP-DC1-01', hostname: 'tplink-eap-dc1-01.nets-ai.tn', model: 'EAP620 HD', type: 'wireless', site: 'DataCenter-1', region: 'Tunis' },
    { name: 'TPLINK-EAP-DC2-01', hostname: 'tplink-eap-dc2-01.nets-ai.tn', model: 'EAP620 HD', type: 'wireless', site: 'DataCenter-2', region: 'Sfax' },
    { name: 'TPLINK-EAP-BN-01', hostname: 'tplink-eap-bn-01.nets-ai.tn', model: 'EAP245', type: 'wireless', site: 'Branch-North', region: 'Bizerte' },
    { name: 'TPLINK-EAP-BN-02', hostname: 'tplink-eap-bn-02.nets-ai.tn', model: 'EAP245', type: 'wireless', site: 'Branch-North', region: 'Nabeul' },
    { name: 'TPLINK-EAP-BS-01', hostname: 'tplink-eap-bs-01.nets-ai.tn', model: 'EAP225', type: 'wireless', site: 'Branch-South', region: 'Gabes' },
    { name: 'TPLINK-EAP-BS-02', hostname: 'tplink-eap-bs-02.nets-ai.tn', model: 'EAP225', type: 'wireless', site: 'Branch-South', region: 'Gafsa' },
    { name: 'TPLINK-EAP-BC-01', hostname: 'tplink-eap-bc-01.nets-ai.tn', model: 'EAP245', type: 'wireless', site: 'Branch-Central', region: 'Sousse' },
    { name: 'TPLINK-EAP-BC-02', hostname: 'tplink-eap-bc-02.nets-ai.tn', model: 'EAP245', type: 'wireless', site: 'Branch-Central', region: 'Kairouan' },
    { name: 'TPLINK-EAP-LOBBY-01', hostname: 'tplink-eap-lobby-01.nets-ai.tn', model: 'EAP660', type: 'wireless', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-EAP-WAREHOUSE-01', hostname: 'tplink-eap-warehouse-01.nets-ai.tn', model: 'EAP620 HD', type: 'wireless', site: 'DataCenter-2', region: 'Sfax' },
    { name: 'TPLINK-EAP-MEETING-01', hostname: 'tplink-eap-meeting-01.nets-ai.tn', model: 'EAP660 HD', type: 'wireless', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-EAP-CAFETERIA-01', hostname: 'tplink-eap-cafeteria-01.nets-ai.tn', model: 'EAP670', type: 'wireless', site: 'DataCenter-1', region: 'Tunis' },
    { name: 'TPLINK-EAP-PARKING-01', hostname: 'tplink-eap-parking-01.nets-ai.tn', model: 'EAP225', type: 'wireless', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-EAP-EXT-DC1-01', hostname: 'tplink-eap-ext-dc1-01.nets-ai.tn', model: 'EAP660', type: 'wireless', site: 'DataCenter-1', region: 'Tunis' },
    { name: 'TPLINK-EAP-EXT-DC2-01', hostname: 'tplink-eap-ext-dc2-01.nets-ai.tn', model: 'EAP660', type: 'wireless', site: 'DataCenter-2', region: 'Sfax' },

    // === Deco Mesh Systems (8) ===
    { name: 'TPLINK-DECO-EXEC-01', hostname: 'tplink-deco-exec-01.nets-ai.tn', model: 'Deco X60', type: 'wireless', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-DECO-EXEC-02', hostname: 'tplink-deco-exec-02.nets-ai.tn', model: 'Deco X60', type: 'wireless', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-DECO-ENG-01', hostname: 'tplink-deco-eng-01.nets-ai.tn', model: 'Deco X20', type: 'wireless', site: 'DataCenter-1', region: 'Tunis' },
    { name: 'TPLINK-DECO-ENG-02', hostname: 'tplink-deco-eng-02.nets-ai.tn', model: 'Deco X20', type: 'wireless', site: 'DataCenter-1', region: 'Tunis' },
    { name: 'TPLINK-DECO-DEV-01', hostname: 'tplink-deco-dev-01.nets-ai.tn', model: 'Deco M5', type: 'wireless', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-DECO-GUEST-01', hostname: 'tplink-deco-guest-01.nets-ai.tn', model: 'Deco M4', type: 'wireless', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-DECO-W2400-01', hostname: 'tplink-deco-w2400-01.nets-ai.tn', model: 'Deco W2400', type: 'wireless', site: 'Branch-Central', region: 'Sousse' },
    { name: 'TPLINK-DECO-BC-01', hostname: 'tplink-deco-bc-01.nets-ai.tn', model: 'Deco X20', type: 'wireless', site: 'Branch-Central', region: 'Kairouan' },

    // === Omada SDN Controllers & Archer WiFi Routers (7) ===
    { name: 'TPLINK-OC200-HQ-01', hostname: 'tplink-oc200-hq-01.nets-ai.tn', model: 'OC200', type: 'server', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-AX73-HQ-01', hostname: 'tplink-ax73-hq-01.nets-ai.tn', model: 'Archer AX73', type: 'router', site: 'HeadQuarters', region: 'Tunis' },
    { name: 'TPLINK-AX1800-BC-01', hostname: 'tplink-ax1800-bc-01.nets-ai.tn', model: 'Archer AX1800', type: 'router', site: 'Branch-Central', region: 'Sousse' },
    { name: 'TPLINK-AX5400-SF-01', hostname: 'tplink-ax5400-sf-01.nets-ai.tn', model: 'Archer AX5400', type: 'router', site: 'DataCenter-2', region: 'Sfax' },
    { name: 'TPLINK-AX73-NB-01', hostname: 'tplink-ax73-nb-01.nets-ai.tn', model: 'Archer AX73', type: 'router', site: 'Branch-North', region: 'Nabeul' },
    { name: 'TPLINK-C7-GF-01', hostname: 'tplink-c7-gf-01.nets-ai.tn', model: 'Archer C7', type: 'router', site: 'Branch-South', region: 'Gabes' },
    { name: 'TPLINK-AX1800-GF-01', hostname: 'tplink-ax1800-gf-01.nets-ai.tn', model: 'Archer AX1800', type: 'router', site: 'Branch-South', region: 'Gafsa' },
  ];

  // IP address ranges for each site
  const siteIPRanges: Record<string, string> = {
    'HeadQuarters': '10.10',
    'DataCenter-1': '10.20',
    'DataCenter-2': '10.30',
    'Branch-North': '10.40',
    'Branch-South': '10.50',
    'Branch-Central': '10.60',
    'DR-Site': '10.70',
  };

  for (let i = 0; i < tpLinkDevices.length; i++) {
    const device = tpLinkDevices[i];
    const ipPrefix = siteIPRanges[device.site] || '10.10';
    const ipSuffix = (i % 250) + 2;
    const ipAddress = `${ipPrefix}.${Math.floor(ipSuffix / 250)}.${ipSuffix}`;

    const element = await prisma.networkElement.create({
      data: {
        name: device.name,
        hostname: device.hostname,
        ipAddress,
        vendor: 'tp-link',
        model: device.model,
        osVersion: randomItem(VENDOR_OS['tp-link']),
        elementType: device.type,
        site: device.site,
        region: device.region,
        status: Math.random() > 0.06 ? 'active' : randomItem(['inactive', 'maintenance'] as const),
        lastSeen: generateTimestamp(1),
        capabilities: JSON.stringify({
          protocols: ['SSH', 'SNMP', 'RESTCONF'],
          interfaces: device.type === 'switch' ? random(8, 52) : device.type === 'wireless' ? random(2, 4) : random(2, 8),
          wifi: device.type === 'wireless',
          poe: device.model.includes('P'),
          sdn: device.model.includes('EAP') || device.model.includes('TL-SG3') || device.model.includes('ER') || device.model.includes('OC'),
          mesh: device.model.includes('Deco'),
          uptime: random(1, 365),
        }),
      },
    });
    elements.push(element);
  }
  console.log(`   ✅ Created ${elements.length} TP-LINK network elements`);
  return elements;
}

async function generateTPLinkAlarms(elements: Awaited<ReturnType<typeof generateTPLinkElements>>) {
  console.log('🚨 Generating TP-LINK alarms...');
  let alarmCount = 0;

  // TP-LINK specific alarm templates
  const tpLinkAlarms = [
    // Critical
    { code: 'TPL-WIFI-DOWN-001', name: 'WiFi Radio Down', severity: 'critical', category: 'connectivity', desc: 'WiFi radio interface {interface} is down on {model}' },
    { code: 'TPL-SDWAN-TUNNEL-001', name: 'SD-WAN Tunnel Down', severity: 'critical', category: 'connectivity', desc: 'SD-WAN tunnel to peer {peer} is down' },
    { code: 'TPL-POE-OVERLOAD-001', name: 'PoE Power Overload', severity: 'critical', category: 'hardware', desc: 'PoE budget exceeded on port {interface}' },
    { code: 'TPL-FW-CRASH-001', name: 'Firmware Crash Detected', severity: 'critical', category: 'hardware', desc: 'Device {model} firmware crash - auto-reboot triggered' },
    // Major
    { code: 'TPL-WIFI-INTERF-001', name: 'WiFi Interference', severity: 'major', category: 'performance', desc: 'High interference detected on channel {channel} ({percent}% utilization)' },
    { code: 'TPL-SDWAN-DEGRADED-001', name: 'SD-WAN Link Degraded', severity: 'major', category: 'connectivity', desc: 'SD-WAN link quality degraded to {percent}%' },
    { code: 'TPL-CPU-HIGH-001', name: 'High CPU on {model}', severity: 'major', category: 'performance', desc: 'CPU utilization at {percent}% on {model}' },
    { code: 'TPL-MEM-HIGH-001', name: 'Memory High', severity: 'major', category: 'performance', desc: 'Memory usage at {percent}%' },
    { code: 'TPL-VLAN-MISMATCH-001', name: 'VLAN Configuration Mismatch', severity: 'major', category: 'configuration', desc: 'VLAN mismatch detected on Omada controller for port {interface}' },
    { code: 'TPL-AP-OFFLINE-001', name: 'Access Point Offline', severity: 'major', category: 'connectivity', desc: 'EAP {model} lost connectivity to Omada controller' },
    { code: 'TPL-PORT-LOOP-001', name: 'Network Loop Detected', severity: 'major', category: 'connectivity', desc: 'Loop detected on port {interface}' },
    // Minor
    { code: 'TPL-LINK-UTIL-001', name: 'Link Utilization High', severity: 'minor', category: 'performance', desc: 'Port {interface} utilization at {percent}%' },
    { code: 'TPL-SSID-AUTH-001', name: 'SSID Authentication Failures', severity: 'minor', category: 'security', desc: 'Multiple auth failures on SSID {ssid}' },
    { code: 'TPL-MESH-HOP-001', name: 'Mesh Hop Count High', severity: 'minor', category: 'connectivity', desc: 'Deco mesh hop count reached {count} hops' },
    { code: 'TPL-TEMP-HIGH-001', name: 'Device Temperature High', severity: 'minor', category: 'hardware', desc: 'Temperature at {temp}C on {model}' },
    { code: 'TPL-POE-FAULT-001', name: 'PoE Port Fault', severity: 'minor', category: 'hardware', desc: 'PoE fault detected on port {interface}' },
    // Warning
    { code: 'TPL-FW-UPDATE-001', name: 'Firmware Update Available', severity: 'warning', category: 'system', desc: 'Firmware version {version} available for {model}' },
    { code: 'TPL-LICENSE-EXP-001', name: 'Omada License Expiring', severity: 'warning', category: 'security', desc: 'Omada SDN license expires in {days} days' },
    { code: 'TPL-DISK-LOW-001', name: 'Controller Disk Low', severity: 'warning', category: 'performance', desc: 'OC200 storage at {percent}% capacity' },
    { code: 'TPL-CLIENT-HIGH-001', name: 'High Client Count', severity: 'warning', category: 'performance', desc: '{count} clients connected to {model} (threshold: 128)' },
    // Info
    { code: 'TPL-AP-PROVISIONED-001', name: 'AP Provisioned', severity: 'info', category: 'configuration', desc: '{model} provisioned by Omada controller' },
    { code: 'TPL-FW-UPDATED-001', name: 'Firmware Updated', severity: 'info', category: 'system', desc: '{model} firmware updated to version {version}' },
    { code: 'TPL-SDN-SYNC-001', name: 'SDN Sync Completed', severity: 'info', category: 'system', desc: 'Omada SDN sync completed for {count} devices' },
  ];

  for (const element of elements) {
    const numAlarms = random(5, 10);
    for (let i = 0; i < numAlarms; i++) {
      const template = randomItem(tpLinkAlarms);
      const firstSeen = generateTimestamp(30);
      const lastSeen = new Date(firstSeen.getTime() + random(0, 7 * 24 * 60 * 60 * 1000));

      let description = template.desc
        .replace('{interface}', generateInterface())
        .replace('{peer}', generateIP())
        .replace('{model}', element.model || 'Unknown')
        .replace('{percent}', String(random(70, 99)))
        .replace('{channel}', String(random(1, 13)))
        .replace('{ssid}', randomItem(['NOC-Staff', 'NOC-Guest', 'NOC-IoT', 'Mgmt-WiFi']))
        .replace('{count}', String(random(5, 200)))
        .replace('{temp}', String(random(45, 80)))
        .replace('{version}', `${random(2, 6)}.${random(0, 20)}.${random(0, 9)}`)
        .replace('{days}', String(random(1, 30)));

      await prisma.alarm.create({
        data: {
          networkElementId: element.id,
          severity: template.severity as any,
          alarmCode: template.code,
          alarmName: template.name,
          description,
          source: element.ipAddress,
          category: template.category,
          status: Math.random() > 0.35 ? 'active' : randomItem(['acknowledged', 'cleared'] as const),
          acknowledgedBy: Math.random() > 0.5 ? `user${random(1, 10)}` : null,
          acknowledgedAt: Math.random() > 0.5 ? generateTimestamp(7) : null,
          clearedAt: Math.random() > 0.7 ? generateTimestamp(7) : null,
          firstSeen,
          lastSeen,
          count: random(1, 50),
          rawMessage: description,
          metadata: JSON.stringify({
            vendor: 'tp-link',
            site: element.site,
            region: element.region,
          }),
        },
      });
      alarmCount++;
    }
  }
  console.log(`   ✅ Created ${alarmCount} TP-LINK alarms`);
}

async function generateTPLinkLogs(elements: Awaited<ReturnType<typeof generateTPLinkElements>>) {
  console.log('📝 Generating TP-LINK logs...');
  let logCount = 0;
  const logLevels = Object.keys(LOG_TEMPLATES) as (keyof typeof LOG_TEMPLATES)[];
  const logTypes = ['system', 'security', 'audit', 'config', 'performance', 'access'];

  // TP-LINK specific log messages
  const tpLinkLogMessages = {
    emergency: [
      'Omada controller panic - SDN service crashed',
      'Kernel panic on {model} - system halted',
      'Critical firmware corruption detected on {model}',
    ],
    alert: [
      'SD-WAN tunnel {tunnel} to {peer} dropped - failover initiated',
      'PoE budget exceeded on {model} - port shutdown triggered',
      'Security alert: Unauthorized access attempt on Omada controller',
    ],
    critical: [
      'SD-WAN link to peer {peer} failed - switching to backup',
      'EAP {model} lost connection to Omada controller',
      'WiFi radio {radio} on {model} is down',
      'PoE port {port} fault detected on {model}',
    ],
    error: [
      'Failed to establish SD-WAN tunnel with {peer}',
      'SNMP polling failed for {model} at {ip}',
      'Omada provisioning failed for EAP {model}',
      'Firmware download failed: {reason}',
      'SSH login failed for user {user} from {ip}',
      'VLAN configuration commit failed on {model}',
    ],
    warning: [
      'High WiFi interference on channel {channel} - RSSI at {percent}%',
      'CPU usage on {model} at {percent}%',
      'Memory usage warning on {model}: {percent}%',
      'Deco mesh node {node} disconnected - reconnecting',
      'Client roaming failed between APs on SSID {ssid}',
      'PoE power budget at {percent}% on {model}',
      'Certificate for Omada controller expires in {days} days',
    ],
    notice: [
      'EAP {model} adopted by Omada controller',
      'SD-WAN tunnel {tunnel} established to {peer}',
      'Firmware updated on {model} to version {version}',
      'VLAN {vlan} added to port {port} on {model}',
      'New client {mac} connected to SSID {ssid}',
      'Omada SDN configuration sync completed',
      'SSD backup completed for OC200 controller',
    ],
    info: [
      'Omada SDN service started on {model}',
      'Health check passed for {model}',
      'WiFi client count on {model}: {count} clients',
      'SD-WAN link monitoring heartbeat from {peer}',
      'Deco mesh topology updated - {count} nodes active',
      'Background firmware check completed',
      'SNMP trap sent to NMS for {model}',
    ],
    debug: [
      'Processing SDN request ID: {id}',
      'WiFi scan results on {model}: {count} BSSIDs found',
      'SD-WAN QoS policy applied: bandwidth {percent}%',
      'DHCP lease renewal for {mac}',
    ],
  };

  for (const element of elements) {
    const numLogs = random(35, 50);
    for (let i = 0; i < numLogs; i++) {
      const level = randomItem(logLevels);
      // Mix TP-LINK specific and generic log messages
      const useVendorLog = Math.random() > 0.3;
      const template = useVendorLog
        ? randomItem(tpLinkLogMessages[level] || ['Generic ' + level + ' event'])
        : randomItem(LOG_TEMPLATES[level]);

      let message = template
        .replace('{model}', element.model || 'Unknown')
        .replace('{peer}', generateIP())
        .replace('{ip}', element.ipAddress)
        .replace('{user}', `user${random(1, 50)}`)
        .replace('{port}', String(random(1, 28)))
        .replace('{channel}', String(random(1, 13)))
        .replace('{radio}', randomItem(['radio0', 'radio1', '2.4GHz', '5GHz']))
        .replace('{percent}', String(random(60, 99)))
        .replace('{ssid}', randomItem(['NOC-Staff', 'NOC-Guest', 'NOC-IoT', 'Mgmt-WiFi']))
        .replace('{tunnel}', `tunnel${random(0, 10)}`)
        .replace('{node}', `Deco-${random(1, 8)}`)
        .replace('{vlan}', String(random(1, 4094)))
        .replace('{mac}', generateMAC())
        .replace('{count}', String(random(1, 200)))
        .replace('{version}', `${random(2, 6)}.${random(0, 20)}.${random(0, 9)}`)
        .replace('{days}', String(random(1, 30)))
        .replace('{reason}', randomItem(['timeout', 'auth failure', 'network unreachable', 'disk full']))
        .replace('{id}', crypto.randomUUID().substring(0, 8))
        .replace('{service}', randomItem(['Omada SDN', 'SNMP Agent', 'SSH Server', 'WiFi Daemon', 'SD-WAN']))
        .replace('{interface}', generateInterface())
        .replace('{host}', generateIP());

      await prisma.log.create({
        data: {
          networkElementId: element.id,
          timestamp: generateTimestamp(7),
          logLevel: level,
          facility: randomItem(['kern', 'user', 'daemon', 'auth', 'syslog', 'local0', 'local7']),
          source: element.ipAddress,
          process: randomItem(['omada_sdn', 'sdwan', 'wifi_daemon', 'sshd', 'snmpd', 'dhcpd', 'kernel']),
          message,
          rawLog: message,
          parsed: Math.random() > 0.25,
          logType: randomItem(logTypes as any),
          metadata: Math.random() > 0.5 ? JSON.stringify({
            severity: level,
            vendor: 'tp-link',
            model: element.model,
            facility: random(0, 23),
          }) : null,
        },
      });
      logCount++;
    }
  }
  console.log(`   ✅ Created ${logCount} TP-LINK logs`);
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     NET\'S AI SECURITY AGENT - Training Data Generator     ║');
  console.log('║                  Massive Dataset Creation                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const startTime = Date.now();
  
  try {
    // Generate all data
    const users = await generateUsers();

    // Generate original 5-vendor elements (excluding TP-LINK to avoid duplicates)
    const originalVendors = ['cisco', 'huawei', 'nokia', 'juniper', 'ericsson'] as const;
    const originalElements = await generateNetworkElementsForVendors(originalVendors);

    // Generate dedicated TP-LINK elements with realistic ISP deployment
    const tpLinkElements = await generateTPLinkElements();
    await generateTPLinkAlarms(tpLinkElements);
    await generateTPLinkLogs(tpLinkElements);

    // Generate alarms/logs for original vendor elements
    const allElements = [...originalElements, ...tpLinkElements];
    await generateAlarms(originalElements);
    await generateLogs(originalElements);
    await generateProvisioningTasks(allElements, users);
    await generateSecurityAudits(users);
    await generateVendorConfigs();
    await generateNotificationRules();
    await generateSystemConfigs();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    GENERATION COMPLETE                     ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Total Duration: ${duration.padStart(6)} seconds                            ║`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Generated Data:                                           ║');
    console.log(`║    • Network Elements:  ${String(CONFIG.NETWORK_ELEMENTS).padStart(5)}                        ║`);
    console.log(`║    • Alarms:            ~${String(CONFIG.NETWORK_ELEMENTS * CONFIG.ALARMS_PER_ELEMENT).padStart(5)}                        ║`);
    console.log(`║    • Logs:              ~${String(CONFIG.NETWORK_ELEMENTS * CONFIG.LOGS_PER_ELEMENT).padStart(5)}                      ║`);
    console.log(`║    • Security Events:   ${String(CONFIG.SECURITY_EVENTS).padStart(5)}                        ║`);
    console.log(`║    • Provisioning:      ${String(CONFIG.PROVISIONING_TASKS).padStart(5)}                        ║`);
    console.log(`║    • Users:             ${String(CONFIG.USERS).padStart(5)}                        ║`);
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
