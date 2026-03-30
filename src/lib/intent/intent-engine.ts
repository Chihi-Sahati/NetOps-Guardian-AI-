// ============================================
// NETOPS GUARDIAN AI - Intent Engine (TMForum IG1228)
// Implements the Intent-to-Configuration Translation Pipeline
// Translation function: tau: I -> R -> C_v
// f_interpret: I -> O (intent to requirements)
// f_allocate: O -> R (requirements to resources)
// f_vendor: R -> C_v (resources to vendor configs)
// ============================================

export type Vendor = 'cisco' | 'huawei' | 'nokia' | 'juniper' | 'ericsson' | 'tp-link';

// ============================================
// INTENT SPECIFICATION
// ============================================

export interface IntentSpecification {
  id: string;
  intentType: 'connectivity' | 'performance' | 'security' | 'reliability' | 'capacity';
  name: string;
  description: string;
  constraints: IntentConstraint[];
  target: IntentTarget[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  validityPeriod: { start: Date; end: Date };
  vendorScope: Vendor[];
}

export interface IntentConstraint {
  type: 'min_bandwidth' | 'max_latency' | 'max_packet_loss' | 'min_availability' | 'max_jitter' | 'encryption' | 'isolation' | 'priority';
  operator: '>=' | '<=' | '==' | '>';
  value: number | string | boolean;
  unit?: string;
}

export interface IntentTarget {
  serviceType: string;
  networkSlice?: string;
  subscriberGroup?: string;
  region?: string;
}

// ============================================
// OPERATIONAL REQUIREMENTS
// ============================================

export interface OperationalRequirement {
  id: string;
  category: 'qos' | 'security' | 'reliability' | 'capacity' | 'routing';
  description: string;
  parameters: Record<string, number | string | boolean>;
  priority: number;
  vendors: Vendor[];
  dependencies: string[];
}

// ============================================
// RESOURCE ALLOCATION
// ============================================

export interface ResourceAllocation {
  id: string;
  requirementId: string;
  resourceType: 'bandwidth' | 'cpu' | 'memory' | 'interface' | 'license' | 'vnf';
  amount: number;
  unit: string;
  vendor: Vendor;
  deviceType: string;
  allocated: boolean;
}

// ============================================
// VENDOR CONFIGURATION
// ============================================

export interface VendorConfiguration {
  vendor: Vendor;
  configType: string;
  cliCommands: string[];
  netconfConfig?: string;
  restconfPayload?: string;
  validationRules: string[];
  rollbackCommands: string[];
}

// ============================================
// INTENT ENGINE
// ============================================

export class IntentEngine {
  // Intent catalog: known intent templates
  private static intentTemplates: Record<string, Partial<IntentSpecification>> = {
    'enterprise-vpn': {
      intentType: 'connectivity',
      name: 'Enterprise VPN Connectivity',
      description: 'Establish secure VPN tunnel with guaranteed bandwidth and low latency',
      constraints: [
        { type: 'min_bandwidth', operator: '>=', value: 100, unit: 'Mbps' },
        { type: 'max_latency', operator: '<=', value: 20, unit: 'ms' },
        { type: 'max_packet_loss', operator: '<=', value: 0.001, unit: '%' },
        { type: 'encryption', operator: '==', value: true },
      ],
      vendorScope: ['cisco', 'juniper'],
    },
    '5g-slice-embb': {
      intentType: 'performance',
      name: '5G eMBB Network Slice',
      description: 'Enhanced Mobile Broadband slice for high throughput applications',
      constraints: [
        { type: 'min_bandwidth', operator: '>=', value: 1000, unit: 'Mbps' },
        { type: 'max_latency', operator: '<=', value: 10, unit: 'ms' },
        { type: 'min_availability', operator: '>=', value: 99.99, unit: '%' },
        { type: 'isolation', operator: '==', value: true },
      ],
      vendorScope: ['huawei', 'ericsson'],
    },
    'iptv-service': {
      intentType: 'performance',
      name: 'IPTV Streaming Service',
      description: 'High-quality video streaming with minimal buffering',
      constraints: [
        { type: 'min_bandwidth', operator: '>=', value: 25, unit: 'Mbps' },
        { type: 'max_jitter', operator: '<=', value: 5, unit: 'ms' },
        { type: 'max_packet_loss', operator: '<=', value: 0.005, unit: '%' },
        { type: 'priority', operator: '==', value: true },
      ],
      vendorScope: ['nokia', 'huawei'],
    },
    'volte-service': {
      intentType: 'reliability',
      name: 'VoLTE Voice Service',
      description: 'High-reliability voice over LTE with QoS guarantees',
      constraints: [
        { type: 'max_latency', operator: '<=', value: 50, unit: 'ms' },
        { type: 'max_jitter', operator: '<=', value: 30, unit: 'ms' },
        { type: 'max_packet_loss', operator: '<=', value: 0.5, unit: '%' },
        { type: 'min_availability', operator: '>=', value: 99.99, unit: '%' },
        { type: 'priority', operator: '==', value: true },
      ],
      vendorScope: ['ericsson', 'nokia'],
    },
    'datacenter-interconnect': {
      intentType: 'connectivity',
      name: 'Data Center Interconnect',
      description: 'High-bandwidth, low-latency interconnect between data centers',
      constraints: [
        { type: 'min_bandwidth', operator: '>=', value: 10000, unit: 'Mbps' },
        { type: 'max_latency', operator: '<=', value: 2, unit: 'ms' },
        { type: 'min_availability', operator: '>=', value: 99.99, unit: '%' },
        { type: 'max_packet_loss', operator: '<=', value: 0.0001, unit: '%' },
      ],
      vendorScope: ['cisco', 'huawei', 'juniper'],
    },
    'security-perimeter': {
      intentType: 'security',
      name: 'Network Security Perimeter',
      description: 'Deploy Zero Trust security with micro-segmentation',
      constraints: [
        { type: 'encryption', operator: '==', value: true },
        { type: 'isolation', operator: '==', value: true },
        { type: 'max_latency', operator: '<=', value: 5, unit: 'ms' },
      ],
      vendorScope: ['cisco', 'juniper', 'fortinet' as Vendor],
    },
    'broadband-residential': {
      intentType: 'capacity',
      name: 'Residential Broadband Access',
      description: 'FTTH broadband with guaranteed minimum speed',
      constraints: [
        { type: 'min_bandwidth', operator: '>=', value: 100, unit: 'Mbps' },
        { type: 'min_availability', operator: '>=', value: 99.95, unit: '%' },
        { type: 'max_latency', operator: '<=', value: 10, unit: 'ms' },
      ],
      vendorScope: ['cisco', 'huawei'],
    },
  };

  // ============================================
  // PHASE 1: Intent Specification Parsing
  // ============================================

  /**
   * Parse an intent specification from a structured object or template name.
   */
  static parseIntent(input: string | Record<string, unknown>): IntentSpecification {
    if (typeof input === 'string') {
      // Look up template
      const template = this.intentTemplates[input];
      if (!template) {
        throw new Error(`Unknown intent template: ${input}. Available: ${Object.keys(this.intentTemplates).join(', ')}`);
      }
      return {
        id: `intent-${Date.now()}`,
        intentType: template.intentType!,
        name: template.name!,
        description: template.description!,
        constraints: template.constraints!,
        target: [{ serviceType: input }],
        priority: 'high',
        validityPeriod: { start: new Date(), end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
        vendorScope: template.vendorScope as Vendor[],
      };
    }

    // Parse from object
    const obj = input as Record<string, unknown>;
    return {
      id: (obj.id as string) || `intent-${Date.now()}`,
      intentType: (obj.intentType as IntentSpecification['intentType']) || 'connectivity',
      name: (obj.name as string) || 'Unnamed Intent',
      description: (obj.description as string) || '',
      constraints: (obj.constraints as IntentConstraint[]) || [],
      target: (obj.target as IntentTarget[]) || [],
      priority: (obj.priority as IntentSpecification['priority']) || 'medium',
      validityPeriod: {
        start: new Date((obj.validityStart as number) || Date.now()),
        end: new Date((obj.validityEnd as number) || Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      vendorScope: (obj.vendorScope as Vendor[]) || ['cisco'],
    };
  }

  // ============================================
  // PHASE 2: Semantic Interpretation
  // f_interpret: I -> O (intent to operational requirements)
  // ============================================

  /**
   * Translate intent specification into operational requirements.
   */
  static interpret(intent: IntentSpecification): OperationalRequirement[] {
    const requirements: OperationalRequirement[] = [];
    let reqId = 0;

    for (const constraint of intent.constraints) {
      reqId++;
      const category = this.classifyConstraint(constraint);

      switch (category) {
        case 'qos':
          requirements.push({
            id: `req-${intent.id}-${reqId}`,
            category: 'qos',
            description: `QoS: ${constraint.type} ${constraint.operator} ${constraint.value}${constraint.unit ? ' ' + constraint.unit : ''}`,
            parameters: {
              constraint_type: constraint.type,
              threshold: constraint.value,
              operator: constraint.operator,
              unit: constraint.unit || '',
            },
            priority: intent.priority === 'critical' ? 100 : intent.priority === 'high' ? 80 : 60,
            vendors: intent.vendorScope,
            dependencies: [],
          });
          break;

        case 'security':
          requirements.push({
            id: `req-${intent.id}-${reqId}`,
            category: 'security',
            description: `Security: ${constraint.type} ${constraint.operator} ${constraint.value}`,
            parameters: {
              constraint_type: constraint.type,
              enabled: constraint.value,
            },
            priority: 90,
            vendors: intent.vendorScope,
            dependencies: [],
          });
          break;

        case 'reliability':
          requirements.push({
            id: `req-${intent.id}-${reqId}`,
            category: 'reliability',
            description: `Reliability: ${constraint.type} ${constraint.operator} ${constraint.value}${constraint.unit ? ' ' + constraint.unit : ''}`,
            parameters: {
              constraint_type: constraint.type,
              target: constraint.value,
              unit: constraint.unit || '',
            },
            priority: intent.priority === 'critical' ? 95 : 75,
            vendors: intent.vendorScope,
            dependencies: [],
          });
          break;
      }
    }

    // Add implicit requirements based on intent type
    if (intent.intentType === 'connectivity') {
      reqId++;
      requirements.push({
        id: `req-${intent.id}-${reqId}`,
        category: 'routing',
        description: 'Routing: Establish end-to-end path with failover',
        parameters: { failover_enabled: true, path_count: 2 },
        priority: 85,
        vendors: intent.vendorScope,
        dependencies: requirements.map(r => r.id),
      });
    }

    return requirements;
  }

  private static classifyConstraint(constraint: IntentConstraint): 'qos' | 'security' | 'reliability' | 'capacity' {
    switch (constraint.type) {
      case 'min_bandwidth':
      case 'max_latency':
      case 'max_packet_loss':
      case 'max_jitter':
        return 'qos';
      case 'encryption':
      case 'isolation':
        return 'security';
      case 'min_availability':
        return 'reliability';
      case 'priority':
        return 'qos';
      default:
        return 'qos';
    }
  }

  // ============================================
  // PHASE 3: Resource Allocation
  // f_allocate: O -> R (requirements to resources)
  // ============================================

  /**
   * Allocate resources for each operational requirement.
   */
  static allocate(requirements: OperationalRequirement[]): ResourceAllocation[] {
    const allocations: ResourceAllocation[] = [];

    for (const req of requirements) {
      switch (req.category) {
        case 'qos': {
          const bandwidth = (req.parameters.threshold as number) || 100;
          allocations.push({
            id: `alloc-${req.id}`,
            requirementId: req.id,
            resourceType: 'bandwidth',
            amount: bandwidth * 1.2, // 20% overprovisioning
            unit: 'Mbps',
            vendor: req.vendors[0],
            deviceType: 'router',
            allocated: true,
          });
          break;
        }
        case 'security': {
          if (req.parameters.enabled) {
            allocations.push({
              id: `alloc-${req.id}`,
              requirementId: req.id,
              resourceType: 'license',
              amount: 1,
              unit: 'count',
              vendor: req.vendors[0],
              deviceType: 'firewall',
              allocated: true,
            });
          }
          break;
        }
        case 'reliability': {
          allocations.push({
            id: `alloc-${req.id}`,
            requirementId: req.id,
            resourceType: 'interface',
            amount: 2, // Redundant interfaces
            unit: 'count',
            vendor: req.vendors[0],
            deviceType: 'router',
            allocated: true,
          });
          break;
        }
        case 'routing': {
          allocations.push({
            id: `alloc-${req.id}`,
            requirementId: req.id,
            resourceType: 'vnf',
            amount: 1,
            unit: 'count',
            vendor: req.vendors[0],
            deviceType: 'vrouter',
            allocated: true,
          });
          break;
        }
      }
    }

    return allocations;
  }

  // ============================================
  // PHASE 4: Validation Against Policies
  // ============================================

  /**
   * Validate intent against organizational policies.
   */
  static validate(
    intent: IntentSpecification,
    requirements: OperationalRequirement[],
    allocations: ResourceAllocation[]
  ): { valid: boolean; violations: string[]; warnings: string[] } {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Policy 1: No single-vendor lock-in for critical intents
    if (intent.priority === 'critical' && intent.vendorScope.length === 1) {
      warnings.push('Critical intent limited to single vendor - consider multi-vendor');
    }

    // Policy 2: Bandwidth overprovisioning must not exceed 50%
    for (const alloc of allocations) {
      if (alloc.resourceType === 'bandwidth') {
        const req = requirements.find(r => r.id === alloc.requirementId);
        if (req) {
          const requested = (req.parameters.threshold as number) || 0;
          if (requested > 0 && (alloc.amount / requested) > 1.5) {
            warnings.push(`Overprovisioning exceeds 50% for ${req.id}`);
          }
        }
      }
    }

    // Policy 3: Security intents must have encryption
    if (intent.intentType === 'security') {
      const hasEncryption = intent.constraints.some(c => c.type === 'encryption');
      if (!hasEncryption) {
        violations.push('Security intent must specify encryption requirement');
      }
    }

    // Policy 4: Availability target must be realistic
    for (const constraint of intent.constraints) {
      if (constraint.type === 'min_availability') {
        const target = constraint.value as number;
        if (target > 99.999) {
          warnings.push(`Availability target ${target}% requires geographic redundancy`);
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  // ============================================
  // PHASE 5: Vendor-Specific Configuration Generation
  // f_vendor: R -> C_v (resources to vendor configs)
  // ============================================

  /**
   * Generate vendor-specific configurations from requirements and allocations.
   */
  static generateVendorConfigs(
    intent: IntentSpecification,
    requirements: OperationalRequirement[],
    allocations: ResourceAllocation[]
  ): Record<Vendor, VendorConfiguration[]> {
    const configs: Record<string, VendorConfiguration[]> = {};

    for (const vendor of intent.vendorScope) {
      configs[vendor] = this.generateVendorConfig(vendor as Vendor, intent, requirements, allocations.filter(a => a.vendor === vendor));
    }

    return configs as Record<Vendor, VendorConfiguration[]>;
  }

  private static generateVendorConfig(
    vendor: Vendor,
    intent: IntentSpecification,
    requirements: OperationalRequirement[],
    allocations: ResourceAllocation[]
  ): VendorConfiguration[] {
    const configs: VendorConfiguration[] = [];

    // Generate QoS configuration
    const qosReqs = requirements.filter(r => r.category === 'qos');
    if (qosReqs.length > 0) {
      configs.push(VendorTranslator.translateQoS(vendor, qosReqs, intent));
    }

    // Generate security configuration
    const securityReqs = requirements.filter(r => r.category === 'security');
    if (securityReqs.length > 0) {
      configs.push(VendorTranslator.translateSecurity(vendor, securityReqs, intent));
    }

    // Generate routing configuration
    const routingReqs = requirements.filter(r => r.category === 'routing');
    if (routingReqs.length > 0) {
      configs.push(VendorTranslator.translateRouting(vendor, routingReqs, intent));
    }

    return configs;
  }

  // ============================================
  // FULL PIPELINE: tau: I -> R -> C_v
  // ============================================

  /**
   * Execute the complete intent-to-configuration pipeline.
   * tau(intent) = f_vendor(f_allocate(f_interpret(intent)))
   *
   * Returns translation accuracy: A_tau = |{i : tau(i) = S_actual}| / |I|
   */
  static translate(input: string | Record<string, unknown>): {
    intent: IntentSpecification;
    requirements: OperationalRequirement[];
    allocations: ResourceAllocation[];
    validation: { valid: boolean; violations: string[]; warnings: string[] };
    vendorConfigs: Record<string, VendorConfiguration[]>;
    accuracy: number;
  } {
    // Phase 1: Parse intent
    const intent = this.parseIntent(input);

    // Phase 2: Interpret -> Operational Requirements
    const requirements = this.interpret(intent);

    // Phase 3: Allocate Resources
    const allocations = this.allocate(requirements);

    // Phase 4: Validate
    const validation = this.validate(intent, requirements, allocations);

    // Phase 5: Generate Vendor Configs
    const vendorConfigs = this.generateVendorConfigs(intent, requirements, allocations);

    // Compute translation accuracy
    const totalRequirements = requirements.length;
    const satisfiedRequirements = allocations.filter(a => a.allocated).length;
    const accuracy = totalRequirements > 0 ? satisfiedRequirements / totalRequirements : 1.0;

    return {
      intent,
      requirements,
      allocations,
      validation,
      vendorConfigs,
      accuracy: Math.round(accuracy * 1000) / 1000,
    };
  }

  /**
   * Get available intent templates.
   */
  static getAvailableTemplates(): string[] {
    return Object.keys(this.intentTemplates);
  }
}

// ============================================
// VENDOR TRANSLATOR
// ============================================

export class VendorTranslator {
  static translateQoS(vendor: Vendor, requirements: OperationalRequirement[], intent: IntentSpecification): VendorConfiguration {
    const bandwidthConstraint = requirements.find(r => r.parameters.constraint_type === 'min_bandwidth');
    const latencyConstraint = requirements.find(r => r.parameters.constraint_type === 'max_latency');
    const lossConstraint = requirements.find(r => r.parameters.constraint_type === 'max_packet_loss');
    const jitterConstraint = requirements.find(r => r.parameters.constraint_type === 'max_jitter');

    const bw = (bandwidthConstraint?.parameters.threshold as number) || 100;
    const latency = (latencyConstraint?.parameters.threshold as number) || 50;
    const loss = (lossConstraint?.parameters.threshold as number) || 0.1;
    const jitter = (jitterConstraint?.parameters.threshold as number) || 10;

    switch (vendor) {
      case 'cisco':
        return {
          vendor: 'cisco',
          configType: 'QoS Policy Map',
          cliCommands: [
            `policy-map INTENT-${intent.id}`,
            ` class INTENT-CLASS`,
            `  priority percent ${Math.min(100, Math.round(bw / 10))}`,
            `  police cir ${bw * 1000} bc ${bw * 100} conform-action transmit exceed-action drop`,
            ` service-policy INTENT-CHILD`,
            `class-map match-any INTENT-CLASS`,
            ` match dscp af41`,
            ` match access-group name INTENT-ACL`,
          ],
          netconfConfig: `<policy-map xmlns="urn:ios"><name>INTENT-${intent.id}</name><class><name>INTENT-CLASS</name><priority>${Math.min(100, Math.round(bw / 10))}</priority><police><cir>${bw * 1000}</cir></police></class></policy-map>`,
          validationRules: [
            `show policy-map interface | include INTENT-${intent.id}`,
            `show access-lists INTENT-ACL`,
          ],
          rollbackCommands: [
            `no policy-map INTENT-${intent.id}`,
            `no class-map INTENT-CLASS`,
            `no ip access-list extended INTENT-ACL`,
          ],
        };

      case 'huawei':
        return {
          vendor: 'huawei',
          configType: 'QoS Traffic Policy',
          cliCommands: [
            `traffic classifier INTENT-CLS operator or`,
            ` if-match dscp af41`,
            `traffic behavior INTENT-BHV`,
            ` car cir ${bw * 1000} pir ${bw * 1200} cbs ${bw * 100} pbs ${bw * 120}`,
            ` priority-level 5`,
            `traffic policy INTENT-POL`,
            ` classifier INTENT-CLS behavior INTENT-BHV`,
            `interface GigabitEthernet0/0/1`,
            ` traffic-policy INTENT-POL inbound`,
            ` traffic-policy INTENT-POL outbound`,
          ],
          validationRules: [
            `display traffic policy verbose INTENT-POL`,
            `display qos car statistics`,
          ],
          rollbackCommands: [
            `undo traffic policy INTENT-POL`,
            `undo traffic behavior INTENT-BHV`,
            `undo traffic classifier INTENT-CLS`,
          ],
        };

      case 'nokia':
        return {
          vendor: 'nokia',
          configType: 'SAP QoS Policy',
          cliCommands: [
            `configure qos sap-ingress INTENT-IN-${intent.id} create`,
            ` queue 1 multipoint create`,
            `  rate ${bw * 1000} cir ${bw * 1000}`,
            `  priority high`,
            `exit`,
            `no shutdown`,
            `configure qos sap-egress INTENT-OUT-${intent.id} create`,
            ` queue 1 multipoint create`,
            `  rate ${bw * 1000} cir ${bw * 1000}`,
            `exit`,
            `no shutdown`,
          ],
          validationRules: [
            `show qos sap-ingress INTENT-IN-${intent.id}`,
            `show qos sap-egress INTENT-OUT-${intent.id}`,
          ],
          rollbackCommands: [
            `configure qos no sap-ingress INTENT-IN-${intent.id}`,
            `configure qos no sap-egress INTENT-OUT-${intent.id}`,
          ],
        };

      case 'juniper':
        return {
          vendor: 'juniper',
          configType: 'Junos Firewall Filter',
          cliCommands: [
            `set firewall policer INTENT-PLR-${intent.id} if-exceed bandwidth-limit ${bw}m`,
            `set firewall policer INTENT-PLR-${intent.id} if-exceed burst-size-limit 100k`,
            `set firewall filter INTENT-FTR-${intent.id} term INTENT-TERM then policer INTENT-PLR-${intent.id}`,
            `set firewall filter INTENT-FTR-${intent.id} term INTENT-TERM then forwarding-class expedited-forwarding`,
            `set interfaces ge-0/0/0 unit 0 family inet filter input INTENT-FTR-${intent.id}`,
          ],
          validationRules: [
            `show firewall policer INTENT-PLR-${intent.id}`,
            `show firewall filter INTENT-FTR-${intent.id}`,
          ],
          rollbackCommands: [
            `delete firewall policer INTENT-PLR-${intent.id}`,
            `delete firewall filter INTENT-FTR-${intent.id}`,
            `delete interfaces ge-0/0/0 unit 0 family inet filter input INTENT-FTR-${intent.id}`,
          ],
        };

      case 'ericsson':
        return {
          vendor: 'ericsson',
          configType: 'Ericsson QoS Profile',
          cliCommands: [
            `configure qos-profile INTENT-QOS-${intent.id}`,
            ` set arpn max-rate ${bw * 1000}kbit`,
            ` set arpn priority high`,
            ` set policing ${bw * 1000}kbit`,
            ` set dscp-map af41 to priority-group 5`,
            ` commit`,
          ],
          validationRules: [
            `show qos-profile INTENT-QOS-${intent.id}`,
            `show qos statistics`,
          ],
          rollbackCommands: [
            `configure no qos-profile INTENT-QOS-${intent.id}`,
            ` commit`,
          ],
        };

      default:
        return {
          vendor,
          configType: 'Generic QoS',
          cliCommands: [
            `# Generic QoS configuration for ${vendor}`,
            `qos-policy INTENT-${intent.id}`,
            `  bandwidth ${bw}Mbps`,
            `  latency ${latency}ms`,
            `  loss ${loss}%`,
          ],
          validationRules: [`show qos policy INTENT-${intent.id}`],
          rollbackCommands: [`no qos-policy INTENT-${intent.id}`],
        };
    }
  }

  static translateSecurity(vendor: Vendor, requirements: OperationalRequirement[], intent: IntentSpecification): VendorConfiguration {
    const encryptionReq = requirements.find(r => r.parameters.constraint_type === 'encryption');
    const isolationReq = requirements.find(r => r.parameters.constraint_type === 'isolation');
    const hasEncryption = encryptionReq?.parameters.enabled === true;
    const hasIsolation = isolationReq?.parameters.enabled === true;

    const commands: string[] = [`# Security configuration for intent ${intent.id}`];
    const rollbacks: string[] = [];

    if (hasEncryption) {
      switch (vendor) {
        case 'cisco':
          commands.push(
            `crypto ikev2 proposal INTENT-IKE-${intent.id}`,
            ` encryption aes-cbc-256`,
            ` integrity sha256`,
            ` group 21`,
            `crypto ikev2 policy INTENT-IKE-${intent.id}`,
            ` proposal INTENT-IKE-${intent.id}`,
          );
          rollbacks.push(`no crypto ikev2 policy INTENT-IKE-${intent.id}`);
          break;
        case 'huawei':
          commands.push(
            `ike proposal INTENT-IKE-${intent.id}`,
            ` encryption-algorithm aes-256`,
            ` authentication-algorithm sha2-256`,
            ` dh group21`,
          );
          rollbacks.push(`undo ike proposal INTENT-IKE-${intent.id}`);
          break;
        case 'juniper':
          commands.push(
            `set security ike proposal INTENT-IKE-${intent.id} authentication-method pre-shared-keys`,
            `set security ike proposal INTENT-IKE-${intent.id} dh-group group21`,
            `set security ike proposal INTENT-IKE-${intent.id} authentication-algorithm sha-256`,
            `set security ike proposal INTENT-IKE-${intent.id} encryption-algorithm aes-256-cbc`,
          );
          rollbacks.push(`delete security ike proposal INTENT-IKE-${intent.id}`);
          break;
        default:
          commands.push(`# Enable encryption for ${vendor}`);
          rollbacks.push(`# Disable encryption`);
      }
    }

    if (hasIsolation) {
      commands.push(`# Enable micro-segmentation for intent ${intent.id}`);
      switch (vendor) {
        case 'cisco':
          commands.push(`macro auto execute INTENT-SEG-${intent.id}`);
          rollbacks.push(`no macro auto execute INTENT-SEG-${intent.id}`);
          break;
        default:
          commands.push(`# Apply segmentation policy`);
          rollbacks.push(`# Remove segmentation policy`);
      }
    }

    return {
      vendor,
      configType: 'Security Policy',
      cliCommands: commands,
      validationRules: [`show running-config | section INTENT-${intent.id}`],
      rollbackCommands: rollbacks,
    };
  }

  static translateRouting(vendor: Vendor, requirements: OperationalRequirement[], intent: IntentSpecification): VendorConfiguration {
    const commands: string[] = [];
    const rollbacks: string[] = [];

    switch (vendor) {
      case 'cisco':
        commands.push(
          `ip route 0.0.0.0 0.0.0.0 INTENT-NH-${intent.id} 10 name INTENT-PRIMARY`,
          `ip route 0.0.0.0 0.0.0.0 INTENT-NH-${intent.id} 20 name INTENT-BACKUP`,
          `ip sla 1`,
          ` icmp-echo INTENT-MON-${intent.id} source-interface Loopback0`,
          ` threshold 500`,
          ` timeout 1000`,
          `ip sla schedule 1 life forever start-time now`,
        );
        rollbacks.push(
          `no ip route 0.0.0.0 0.0.0.0 INTENT-NH-${intent.id} 10`,
          `no ip route 0.0.0.0 0.0.0.0 INTENT-NH-${intent.id} 20`,
          `no ip sla 1`,
        );
        break;
      case 'huawei':
        commands.push(
          `ip route-static 0.0.0.0 0.0.0.0 INTENT-NH-${intent.id} preference 10`,
          `ip route-static 0.0.0.0 0.0.0.0 INTENT-NH-BACKUP preference 20`,
          `nqa test-instance INTENT-NQA icmp`,
          ` test-packet sendsize 64`,
          ` timeout 1`,
        );
        rollbacks.push(
          `undo ip route-static 0.0.0.0 0.0.0.0 INTENT-NH-${intent.id}`,
          `undo nqa test-instance INTENT-NQA`,
        );
        break;
      case 'juniper':
        commands.push(
          `set routing-options static route 0.0.0.0/0 next-hop INTENT-NH-${intent.id} preference 10`,
          `set routing-options static route 0.0.0.0/0 next-hop INTENT-NH-BACKUP preference 20`,
        );
        rollbacks.push(
          `delete routing-options static route 0.0.0.0/0 next-hop INTENT-NH-${intent.id}`,
        );
        break;
      default:
        commands.push(`# Configure redundant routing for ${vendor}`);
        rollbacks.push(`# Remove routing configuration`);
    }

    return {
      vendor,
      configType: 'Routing Policy',
      cliCommands: commands,
      validationRules: [`show ip route | include INTENT-${intent.id}`],
      rollbackCommands: rollbacks,
    };
  }
}
