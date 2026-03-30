// ============================================
// NET'S AI SECURITY AGENT - AI Engine
// Intelligent Network Analysis & Decision Making
// Developed under supervision of Dr. Houda Chihi
// ============================================

import type { Alarm, LogEntry, NetworkElement } from '@/lib/types';

// Analysis Result Types
export interface AnalysisResult {
  id: string;
  type: 'alarm' | 'log' | 'security' | 'performance' | 'provisioning';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: number;
  summary: string;
  details: Record<string, unknown>;
  recommendations: Recommendation[];
  timestamp: Date;
}

export interface Recommendation {
  id: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  action: string;
  description: string;
  automated: boolean;
  script?: string;
  parameters?: Record<string, unknown>;
}

export interface PatternMatch {
  pattern: string;
  category: string;
  confidence: number;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
}

// ============================================
// AI ANALYSIS ENGINE
// ============================================
export class AIAnalysisEngine {
  private static instance: AIAnalysisEngine;
  private knowledgeBase: Map<string, unknown> = new Map();
  private patternCache: Map<string, PatternMatch[]> = new Map();

  private constructor() {}

  static getInstance(): AIAnalysisEngine {
    if (!AIAnalysisEngine.instance) {
      AIAnalysisEngine.instance = new AIAnalysisEngine();
    }
    return AIAnalysisEngine.instance;
  }

  // ============================================
  // ALARM ANALYSIS
  // ============================================
  async analyzeAlarm(alarm: Alarm): Promise<AnalysisResult> {
    const patterns = await this.detectAlarmPatterns(alarm);
    const rootCause = await this.identifyRootCause(alarm, patterns);
    const recommendations = await this.generateAlarmRecommendations(alarm, rootCause);

    return {
      id: `alarm-analysis-${alarm.id}`,
      type: 'alarm',
      severity: this.mapSeverity(alarm.severity),
      confidence: this.calculateConfidence(patterns, rootCause),
      summary: this.generateAlarmSummary(alarm, rootCause),
      details: {
        alarmCode: alarm.alarmCode,
        alarmName: alarm.alarmName,
        networkElement: alarm.networkElement?.name,
        rootCause,
        patterns: patterns.map(p => p.pattern),
        occurrenceCount: alarm.count,
      },
      recommendations,
      timestamp: new Date(),
    };
  }

  private async detectAlarmPatterns(alarm: Alarm): Promise<PatternMatch[]> {
    const patterns: PatternMatch[] = [];
    const knownPatterns = [
      { pattern: 'interface_down', keywords: ['down', 'interface', 'link'], category: 'connectivity' },
      { pattern: 'high_cpu', keywords: ['cpu', 'utilization', 'high'], category: 'performance' },
      { pattern: 'memory_exhaustion', keywords: ['memory', 'allocation', 'failed'], category: 'performance' },
      { pattern: 'authentication_failure', keywords: ['auth', 'login', 'failed', 'denied'], category: 'security' },
      { pattern: 'config_mismatch', keywords: ['config', 'mismatch', 'inconsistency'], category: 'configuration' },
      { pattern: 'bgp_peer_down', keywords: ['bgp', 'peer', 'down', 'session'], category: 'routing' },
      { pattern: 'optical_degradation', keywords: ['optical', 'signal', 'degradation', 'loss'], category: 'hardware' },
      { pattern: 'power_supply', keywords: ['power', 'supply', 'failure', 'voltage'], category: 'hardware' },
    ];

    const alarmText = `${alarm.alarmName} ${alarm.description || ''}`.toLowerCase();
    for (const known of knownPatterns) {
      const matchCount = known.keywords.filter(kw => alarmText.includes(kw)).length;
      if (matchCount >= 2) {
        patterns.push({
          pattern: known.pattern,
          category: known.category,
          confidence: matchCount / known.keywords.length,
          occurrences: alarm.count,
          firstSeen: alarm.firstSeen,
          lastSeen: alarm.lastSeen,
        });
      }
    }
    return patterns;
  }

  private async identifyRootCause(alarm: Alarm, patterns: PatternMatch[]): Promise<string> {
    if (patterns.length === 0) return 'Unknown - insufficient pattern data for root cause analysis';
    const topPattern = patterns.sort((a, b) => b.confidence - a.confidence)[0];
    const rootCauseMap: Record<string, string> = {
      interface_down: 'Physical layer issue - check cable, transceiver, or port status',
      high_cpu: 'Resource exhaustion - identify CPU-intensive processes',
      memory_exhaustion: 'Memory leak or insufficient resources - review process memory usage',
      authentication_failure: 'Security incident - verify credentials and access policies',
      config_mismatch: 'Configuration drift - compare running vs intended configuration',
      bgp_peer_down: 'Routing issue - verify BGP configuration and peer reachability',
      optical_degradation: 'Hardware degradation - schedule fiber inspection',
      power_supply: 'Power infrastructure issue - verify power supply and UPS status',
    };
    return rootCauseMap[topPattern.pattern] || 'Pattern identified but root cause mapping not available';
  }

  private async generateAlarmRecommendations(alarm: Alarm, rootCause: string): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    if (alarm.severity === 'critical') {
      recommendations.push({
        id: `rec-immediate-${alarm.id}`,
        priority: 'immediate',
        action: 'Acknowledge and investigate immediately',
        description: `Critical alarm requires immediate attention. ${rootCause}`,
        automated: false,
      });
    }
    if (alarm.networkElement) {
      const vendor = (alarm.networkElement as NetworkElement).vendor;
      recommendations.push(...this.getVendorSpecificRecommendations(alarm, vendor));
    }
    return recommendations;
  }

  private getVendorSpecificRecommendations(alarm: Alarm, vendor: string): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const vendorScripts: Record<string, { script: string; desc: string }> = {
      cisco: { script: 'show diagnostic result module all detail', desc: 'Cisco diagnostics' },
      huawei: { script: 'display device health', desc: 'Huawei health status' },
      nokia: { script: 'show log system', desc: 'Nokia system logs' },
      juniper: { script: 'show system statistics', desc: 'Juniper statistics' },
      ericsson: { script: 'show running-config', desc: 'Ericsson configuration' },
    };
    const vendorCmd = vendorScripts[vendor];
    if (vendorCmd) {
      recommendations.push({
        id: `rec-${vendor}-${alarm.id}`,
        priority: 'medium',
        action: `Check ${vendorCmd.desc}`,
        description: `Run vendor-specific diagnostic command`,
        automated: true,
        script: vendorCmd.script,
      });
    }
    return recommendations;
  }

  // ============================================
  // LOG ANALYSIS
  // ============================================
  async analyzeLog(log: LogEntry): Promise<AnalysisResult> {
    const anomalies = await this.detectLogAnomalies(log);
    const threatIndicators = await this.detectThreatIndicators(log);
    const recommendations = await this.generateLogRecommendations(log, anomalies, threatIndicators);
    return {
      id: `log-analysis-${log.id}`,
      type: 'log',
      severity: this.determineLogSeverity(log, anomalies, threatIndicators),
      confidence: anomalies.length > 0 ? 0.9 : 0.7,
      summary: this.generateLogSummary(log, anomalies, threatIndicators),
      details: {
        logLevel: log.logLevel,
        source: log.source,
        logType: log.logType,
        anomalies: anomalies.map(a => a.description),
        threatIndicators: threatIndicators.map(t => t.type),
      },
      recommendations,
      timestamp: new Date(),
    };
  }

  private async detectLogAnomalies(log: LogEntry): Promise<{ type: string; description: string }[]> {
    const anomalies: { type: string; description: string }[] = [];
    const message = log.message.toLowerCase();
    const anomalyPatterns = [
      { type: 'brute_force', patterns: ['failed login', 'authentication failed', 'invalid credentials'] },
      { type: 'dos_attempt', patterns: ['rate limit', 'flood', 'excessive requests'] },
      { type: 'privilege_escalation', patterns: ['sudo', 'privilege', 'permission denied'] },
      { type: 'data_exfiltration', patterns: ['large transfer', 'unusual outbound', 'bulk export'] },
      { type: 'malware_signature', patterns: ['malware', 'virus', 'trojan', 'ransomware'] },
    ];
    for (const anomaly of anomalyPatterns) {
      const matches = anomaly.patterns.filter(p => message.includes(p));
      if (matches.length >= 1) {
        anomalies.push({
          type: anomaly.type,
          description: `Detected potential ${anomaly.type.replace('_', ' ')}: ${matches.join(', ')}`,
        });
      }
    }
    return anomalies;
  }

  private async detectThreatIndicators(log: LogEntry): Promise<{ type: string; confidence: number }[]> {
    const indicators: { type: string; confidence: number }[] = [];
    const message = log.message.toLowerCase();
    if (log.logType === 'security' || log.logLevel === 'error' || log.logLevel === 'critical') {
      if (message.includes('unauthorized') || message.includes('forbidden')) {
        indicators.push({ type: 'unauthorized_access', confidence: 0.9 });
      }
      if (message.includes('injection') || message.includes('xss') || message.includes('sqli')) {
        indicators.push({ type: 'injection_attack', confidence: 0.95 });
      }
    }
    return indicators;
  }

  private async generateLogRecommendations(
    log: LogEntry,
    anomalies: { type: string; description: string }[],
    threatIndicators: { type: string; confidence: number }[]
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    if (threatIndicators.length > 0) {
      recommendations.push({
        id: `rec-security-${log.id}`,
        priority: 'immediate',
        action: 'Investigate security threat',
        description: `Potential security threat detected: ${threatIndicators.map(t => t.type).join(', ')}`,
        automated: false,
      });
    }
    if (anomalies.some(a => a.type === 'brute_force')) {
      recommendations.push({
        id: `rec-block-${log.id}`,
        priority: 'high',
        action: 'Consider IP blocking',
        description: 'Multiple failed login attempts detected',
        automated: true,
        script: 'block_ip',
        parameters: { source: log.source },
      });
    }
    return recommendations;
  }

  // ============================================
  // NETWORK ELEMENT ANALYSIS
  // ============================================
  async analyzeNetworkElement(element: NetworkElement): Promise<AnalysisResult> {
    const healthScore = await this.calculateHealthScore(element);
    const risks = await this.identifyRisks(element);
    const recommendations = await this.generateElementRecommendations(element, healthScore, risks);
    return {
      id: `element-analysis-${element.id}`,
      type: 'performance',
      severity: healthScore < 50 ? 'critical' : healthScore < 70 ? 'high' : healthScore < 85 ? 'medium' : 'low',
      confidence: 0.85,
      summary: `Network element ${element.name} health score: ${healthScore}/100`,
      details: {
        name: element.name,
        hostname: element.hostname,
        vendor: element.vendor,
        status: element.status,
        healthScore,
        risks: risks.map(r => r.description),
      },
      recommendations,
      timestamp: new Date(),
    };
  }

  private async calculateHealthScore(element: NetworkElement): Promise<number> {
    let score = 100;
    if (element.status === 'inactive') score -= 50;
    if (element.status === 'maintenance') score -= 20;
    if (element.status === 'unknown') score -= 30;
    return Math.max(0, Math.min(100, score));
  }

  private async identifyRisks(element: NetworkElement): Promise<{ type: string; description: string; severity: string }[]> {
    const risks: { type: string; description: string; severity: string }[] = [];
    if (element.status === 'inactive') {
      risks.push({ type: 'availability', description: 'Element is currently inactive', severity: 'critical' });
    }
    return risks;
  }

  private async generateElementRecommendations(
    element: NetworkElement,
    healthScore: number,
    risks: { type: string; description: string; severity: string }[]
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    if (healthScore < 70) {
      recommendations.push({
        id: `rec-health-${element.id}`,
        priority: 'high',
        action: 'Review element health',
        description: `Element health score is low (${healthScore}/100)`,
        automated: false,
      });
    }
    for (const risk of risks) {
      recommendations.push({
        id: `rec-risk-${element.id}-${risk.type}`,
        priority: risk.severity === 'critical' ? 'immediate' : 'high',
        action: `Address ${risk.type} risk`,
        description: risk.description,
        automated: false,
      });
    }
    return recommendations;
  }

  // ============================================
  // HELPER METHODS
  // ============================================
  private mapSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    const severityMap: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
      critical: 'critical', major: 'high', minor: 'medium', warning: 'low', info: 'info',
    };
    return severityMap[severity] || 'medium';
  }

  private calculateConfidence(patterns: PatternMatch[], rootCause: string): number {
    if (patterns.length === 0) return 0.5;
    const avgPatternConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
    return Math.min(0.95, avgPatternConfidence * (patterns.length > 2 ? 1.2 : 1));
  }

  private generateAlarmSummary(alarm: Alarm, rootCause: string): string {
    return `Alarm "${alarm.alarmName}" on ${alarm.networkElement?.name || 'unknown element'}. Root cause: ${rootCause.substring(0, 100)}...`;
  }

  private determineLogSeverity(
    log: LogEntry,
    anomalies: { type: string; description: string }[],
    threatIndicators: { type: string; confidence: number }[]
  ): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    if (threatIndicators.length > 0) return 'critical';
    if (anomalies.length > 2) return 'high';
    if (anomalies.length > 0) return 'medium';
    if (log.logLevel === 'error' || log.logLevel === 'critical') return 'high';
    if (log.logLevel === 'warning') return 'medium';
    return 'info';
  }

  private generateLogSummary(
    log: LogEntry,
    anomalies: { type: string; description: string }[],
    threatIndicators: { type: string; confidence: number }[]
  ): string {
    if (threatIndicators.length > 0) return `Security threat detected: ${threatIndicators.map(t => t.type).join(', ')}`;
    if (anomalies.length > 0) return `Anomaly detected: ${anomalies[0].description}`;
    return `Log analysis completed for ${log.logLevel} level event`;
  }
}

export const aiEngine = AIAnalysisEngine.getInstance();
