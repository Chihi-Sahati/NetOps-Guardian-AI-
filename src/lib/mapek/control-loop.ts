// ============================================
// NETOPS GUARDIAN AI - MAPE-K Control Loop
// Implements the autonomic control loop from the manuscript
// Equations 17-19: PID Controller Model
// ============================================

import { db } from '@/lib/db';

// ============================================
// MAPE-K PHASE INTERFACES
// ============================================

export interface MonitoredData {
  timestamp: number;
  alarms: { active: number; critical: number; newInWindow: number };
  logs: { total: number; errorCount: number; unprocessed: number };
  tasks: { pending: number; inProgress: number; completed: number; failed: number };
  security: { recentHighRisk: number; denied: number; bruteForce: number };
  services: Record<string, { status: string; score: number; kpisOk: number; kpisTotal: number }>;
  network: { elementsTotal: number; elementsDown: number; avgLatency: number };
}

export interface AnalysisResult {
  anomalyScore: number;       // 0-1: how anomalous the current state is
  healthScore: number;        // 0-1: overall system health
  correlatedIssues: CorrelatedIssue[];
  performanceDegradation: string[];
  capacityAlerts: string[];
  securityThreats: string[];
  pidError: number;           // e(t) = target - actual (Equation 17)
  pidIntegral: number;        // Accumulated error for I term
  pidDerivative: number;      // Rate of change for D term
}

export interface CorrelatedIssue {
  type: 'alarm_burst' | 'service_degradation' | 'capacity_exhaustion' | 'security_incident' | 'cascade_failure';
  severity: 'critical' | 'high' | 'medium' | 'low';
  elements: string[];
  description: string;
  confidence: number;
}

export interface RemediationPlan {
  id: string;
  strategy: string;
  actions: RemediationAction[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedImpact: string;
  autoExecutable: boolean;
}

export interface RemediationAction {
  type: 'scale_up' | 'load_balance' | 'failover' | 'config_change' | 'alert' | 'investigate';
  target: string;
  description: string;
  agent: 'alarm' | 'provisioning' | 'security' | 'orchestrator';
}

export interface KnowledgeEntry {
  pattern: string;
  response: string;
  effectiveness: number;
  timestamp: number;
  context: Record<string, unknown>;
}

export interface MAPEKState {
  cycleCount: number;
  lastCycleTime: number;
  phase: 'monitor' | 'analyze' | 'plan' | 'execute' | 'knowledge' | 'idle';
  healthHistory: number[];
  anomalyHistory: number[];
  knowledgeBase: KnowledgeEntry[];
  pid: { Kp: number; Ki: number; Kd: number; lastError: number; integral: number; lastTime: number };
  lastAnalysis: AnalysisResult | null;
  lastPlan: RemediationPlan | null;
}

// ============================================
// MAPE-K CONTROL LOOP
// ============================================

export class MAPEKControlLoop {
  private state: MAPEKState;
  private intervalId: NodeJS.Timeout | null = null;
  private cycleIntervalMs: number;
  private onStateChange?: (state: MAPEKState) => void;

  constructor(cycleIntervalMs: number = 10000) {
    this.cycleIntervalMs = cycleIntervalMs;
    this.state = {
      cycleCount: 0,
      lastCycleTime: 0,
      phase: 'idle',
      healthHistory: [],
      anomalyHistory: [],
      knowledgeBase: [],
      pid: {
        Kp: 0.5,    // Proportional gain
        Ki: 0.1,    // Integral gain
        Kd: 0.05,   // Derivative gain
        lastError: 0,
        integral: 0,
        lastTime: Date.now(),
      },
      lastAnalysis: null,
      lastPlan: null,
    };
  }

  start(onStateChange?: (state: MAPEKState) => void): void {
    if (this.intervalId) return;
    this.onStateChange = onStateChange;
    this.intervalId = setInterval(() => this.runCycle(), this.cycleIntervalMs);
    console.log('[MAPE-K] Control loop started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.state.phase = 'idle';
    console.log('[MAPE-K] Control loop stopped');
  }

  getState(): MAPEKState {
    return { ...this.state };
  }

  // ============================================
  // MONITOR PHASE (Equation 17)
  // Collects telemetry from all subsystems
  // ============================================

  private async monitor(): Promise<MonitoredData> {
    this.state.phase = 'monitor';

    const [
      activeAlarms, criticalAlarms, totalLogs, errorLogs, unprocessedLogs,
      pendingTasks, inProgressTasks, completedTasks, failedTasks,
      recentHighRisk, deniedAttempts,
      totalElements, inactiveElements,
    ] = await Promise.all([
      db.alarm.count({ where: { status: 'active' } }),
      db.alarm.count({ where: { severity: 'critical', status: 'active' } }),
      db.log.count(),
      db.log.count({ where: { logLevel: 'error' } }),
      db.log.count({ where: { parsed: false } }),
      db.provisioningTask.count({ where: { status: 'pending' } }),
      db.provisioningTask.count({ where: { status: 'in_progress' } }),
      db.provisioningTask.count({ where: { status: 'completed' } }),
      db.provisioningTask.count({ where: { status: 'failed' } }),
      db.securityAudit.count({ where: { riskLevel: 'high' } }),
      db.securityAudit.count({ where: { action: 'access_denied' } }),
      db.networkElement.count(),
      db.networkElement.count({ where: { status: { in: ['inactive', 'maintenance'] } } }),
    ]);

    // Alarms in last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const newAlarms = await db.alarm.count({ where: { firstSeen: { gte: fiveMinAgo } } });

    // Security: brute force detection (5+ denied in 5 min)
    const bruteForce = await db.securityAudit.count({
      where: {
        action: 'access_denied',
        timestamp: { gte: fiveMinAgo },
      },
    });

    return {
      timestamp: Date.now(),
      alarms: { active: activeAlarms, critical: criticalAlarms, newInWindow: newAlarms },
      logs: { total: totalLogs, errorCount: errorLogs, unprocessed: unprocessedLogs },
      tasks: { pending: pendingTasks, inProgress: inProgressTasks, completed: completedTasks, failed: failedTasks },
      security: { recentHighRisk, denied: deniedAttempts, bruteForce },
      services: {}, // Populated by telecom service integration
      network: { elementsTotal: totalElements, elementsDown: inactiveElements, avgLatency: 0 },
    };
  }

  // ============================================
  // ANALYZE PHASE (Equation 17)
  // PID Controller: u(t) = Kp*e(t) + Ki*∫e(t)dt + Kd*de(t)/dt
  // Where e(t) = healthTarget - healthActual
  // ============================================

  private analyze(data: MonitoredData): AnalysisResult {
    this.state.phase = 'analyze';

    // Target: health score = 1.0
    const healthTarget = 0.95;
    const actualHealth = this.computeHealthScore(data);
    const pidError = healthTarget - actualHealth; // Equation 17

    // PID computation
    const now = Date.now();
    const dt = (now - this.state.pid.lastTime) / 1000;
    this.state.pid.integral += pidError * dt;
    // Anti-windup
    this.state.pid.integral = Math.max(-10, Math.min(10, this.state.pid.integral));
    const pidDerivative = dt > 0 ? (pidError - this.state.pid.lastError) / dt : 0;

    // Control signal
    const controlSignal = this.state.pid.Kp * pidError + this.state.pid.Ki * this.state.pid.integral + this.state.pid.Kd * pidDerivative;

    // Update PID state
    this.state.pid.lastError = pidError;
    this.state.pid.lastTime = now;

    // Track history
    this.state.healthHistory.push(actualHealth);
    if (this.state.healthHistory.length > 60) this.state.healthHistory.shift();

    // Anomaly detection
    const anomalyScore = this.computeAnomalyScore(data);

    this.state.anomalyHistory.push(anomalyScore);
    if (this.state.anomalyHistory.length > 60) this.state.anomalyHistory.shift();

    // Correlate issues
    const correlatedIssues = this.correlateIssues(data);

    // Performance degradation detection
    const performanceDegradation: string[] = [];
    if (data.alarms.active > 50) performanceDegradation.push(`High alarm volume: ${data.alarms.active} active alarms`);
    if (data.tasks.failed > data.tasks.completed * 0.1) performanceDegradation.push(`Task failure rate elevated: ${data.tasks.failed} failed`);
    if (data.logs.unprocessed > 1000) performanceDegradation.push(`Log backlog: ${data.logs.unprocessed} unprocessed logs`);
    if (data.security.bruteForce > 5) performanceDegradation.push(`Brute force attack detected: ${data.security.bruteForce} attempts in 5min`);

    // Capacity alerts
    const capacityAlerts: string[] = [];
    if (data.alarms.critical > 10) capacityAlerts.push(`${data.alarms.critical} critical alarms - capacity strain`);
    if (data.tasks.pending > 100) capacityAlerts.push(`${data.tasks.pending} pending tasks - queue saturation`);

    // Security threats
    const securityThreats: string[] = [];
    if (data.security.bruteForce > 5) securityThreats.push(`Brute force: ${data.security.bruteForce} denied logins in 5min`);
    if (data.security.recentHighRisk > 10) securityThreats.push(`${data.security.recentHighRisk} high-risk security events`);
    if (data.security.denied > 20) securityThreats.push(`${data.security.denied} access denials`);

    const result: AnalysisResult = {
      anomalyScore,
      healthScore: actualHealth,
      correlatedIssues,
      performanceDegradation,
      capacityAlerts,
      securityThreats,
      pidError,
      pidIntegral: this.state.pid.integral,
      pidDerivative,
    };

    this.state.lastAnalysis = result;
    return result;
  }

  // ============================================
  // PLAN PHASE (Equation 18)
  // Generates remediation strategies based on analysis
  // ============================================

  private plan(data: MonitoredData, analysis: AnalysisResult): RemediationPlan | null {
    this.state.phase = 'plan';

    if (analysis.healthScore > 0.85 && analysis.anomalyScore < 0.3) {
      return null; // No action needed
    }

    const actions: RemediationAction[] = [];

    // Alarm management actions
    if (data.alarms.critical > 5) {
      actions.push({
        type: 'alert',
        target: 'noc-operators',
        description: `Escalate ${data.alarms.critical} critical alarms to NOC team`,
        agent: 'alarm',
      });
      actions.push({
        type: 'investigate',
        target: 'alarm-correlator',
        description: 'Run deep correlation analysis on critical alarm burst',
        agent: 'alarm',
      });
    }

    // Task management
    if (data.tasks.pending > 50) {
      actions.push({
        type: 'scale_up',
        target: 'provisioning-pool',
        description: 'Increase provisioning agent concurrency',
        agent: 'provisioning',
      });
    }

    // Security actions
    if (analysis.securityThreats.length > 0) {
      if (data.security.bruteForce > 5) {
        actions.push({
          type: 'config_change',
          target: 'firewall',
          description: 'Block source IPs with >5 failed auth attempts',
          agent: 'security',
        });
      }
      actions.push({
        type: 'alert',
        target: 'security-team',
        description: `Security alert: ${analysis.securityThreats.join('; ')}`,
        agent: 'security',
      });
    }

    // Load balancing
    if (analysis.performanceDegradation.length > 2) {
      actions.push({
        type: 'load_balance',
        target: 'service-pool',
        description: 'Redistribute load across available service instances',
        agent: 'orchestrator',
      });
    }

    if (actions.length === 0) return null;

    // Determine priority
    let priority: RemediationPlan['priority'] = 'low';
    if (analysis.securityThreats.length > 0 || data.alarms.critical > 10) priority = 'critical';
    else if (analysis.performanceDegradation.length > 2 || data.alarms.critical > 5) priority = 'high';
    else if (analysis.anomalyScore > 0.5) priority = 'medium';

    const plan: RemediationPlan = {
      id: `mapek-${Date.now()}`,
      strategy: priority === 'critical' ? 'emergency_response' : priority === 'high' ? 'rapid_response' : 'standard',
      actions,
      priority,
      estimatedImpact: `Expected to improve health score by ${Math.round((1 - analysis.healthScore) * 40)}%`,
      autoExecutable: priority !== 'critical',
    };

    this.state.lastPlan = plan;
    return plan;
  }

  // ============================================
  // EXECUTE PHASE (Equation 19)
  // Deploys remediation through appropriate agents
  // ============================================

  private async execute(plan: RemediationPlan): Promise<{ executed: number; skipped: number }> {
    this.state.phase = 'execute';

    let executed = 0;
    let skipped = 0;

    for (const action of plan.actions) {
      try {
        if (action.autoExecutable === false && plan.priority === 'critical') {
          // Log for human review
          await db.securityAudit.create({
            data: {
              action: 'access_granted',
              resource: action.target,
              resourceType: 'mapek_plan',
              result: 'success',
              details: JSON.stringify({ action: action.description, requiresHumanApproval: true }),
              riskLevel: 'high',
            },
          });
          skipped++;
          continue;
        }

        // Execute based on action type
        switch (action.type) {
          case 'alert':
            // Store alert for dashboard display
            console.log(`[MAPE-K EXEC] Alert: ${action.description}`);
            executed++;
            break;
          case 'investigate':
            console.log(`[MAPE-K EXEC] Investigation: ${action.description}`);
            executed++;
            break;
          case 'scale_up':
            console.log(`[MAPE-K EXEC] Scale: ${action.description}`);
            executed++;
            break;
          case 'load_balance':
            console.log(`[MAPE-K EXEC] Load Balance: ${action.description}`);
            executed++;
            break;
          case 'config_change':
            console.log(`[MAPE-K EXEC] Config Change: ${action.description}`);
            executed++;
            break;
          default:
            skipped++;
        }
      } catch (error) {
        console.error(`[MAPE-K EXEC] Failed: ${action.description}`, error);
        skipped++;
      }
    }

    return { executed, skipped };
  }

  // ============================================
  // KNOWLEDGE PHASE
  // Updates baselines and stores patterns
  // ============================================

  private updateKnowledge(data: MonitoredData, analysis: AnalysisResult, plan: RemediationPlan | null): void {
    this.state.phase = 'knowledge';

    // Store pattern if anomaly detected
    if (analysis.anomalyScore > 0.5) {
      this.state.knowledgeBase.push({
        pattern: `anomaly_${Date.now()}`,
        response: plan ? `plan_${plan.strategy}` : 'monitor',
        effectiveness: 1 - analysis.anomalyScore,
        timestamp: Date.now(),
        context: {
          alarmCount: data.alarms.active,
          criticalAlarms: data.alarms.critical,
          healthScore: analysis.healthScore,
        },
      });

      // Keep knowledge base bounded
      if (this.state.knowledgeBase.length > 100) {
        this.state.knowledgeBase = this.state.knowledgeBase.slice(-80);
      }
    }
  }

  // ============================================
  // MAIN CYCLE
  // ============================================

  private async runCycle(): Promise<void> {
    const cycleStart = Date.now();
    this.state.cycleCount++;

    try {
      // M: Monitor
      const data = await this.monitor();

      // A: Analyze
      const analysis = this.analyze(data);

      // P: Plan
      const plan = this.plan(data, analysis);

      // E: Execute (if plan exists)
      if (plan) {
        await this.execute(plan);
      }

      // K: Knowledge
      this.updateKnowledge(data, analysis, plan);

      this.state.phase = 'idle';
      this.state.lastCycleTime = Date.now() - cycleStart;

      if (this.onStateChange) {
        this.onStateChange(this.state);
      }
    } catch (error) {
      console.error('[MAPE-K] Cycle error:', error);
      this.state.phase = 'idle';
    }
  }

  // ============================================
  // COMPUTATION HELPERS
  // ============================================

  private computeHealthScore(data: MonitoredData): number {
    // Multi-factor health score
    const alarmHealth = 1 - Math.min(1, data.alarms.critical / 50) * 0.4 - Math.min(1, data.alarms.active / 200) * 0.2;
    const taskHealth = 1 - Math.min(1, data.tasks.failed / Math.max(1, data.tasks.completed + data.tasks.failed)) * 0.3;
    const logHealth = data.logs.unprocessed < 500 ? 1 : 1 - Math.min(0.5, (data.logs.unprocessed - 500) / 5000);
    const securityHealth = data.security.bruteForce < 3 ? 1 : 1 - Math.min(0.3, (data.security.bruteForce - 3) / 10);

    return (alarmHealth * 0.35 + taskHealth * 0.25 + logHealth * 0.2 + securityHealth * 0.2);
  }

  private computeAnomalyScore(data: MonitoredData): number {
    let score = 0;

    // Burst detection for new alarms
    if (data.alarms.newInWindow > 20) score += 0.3;
    else if (data.alarms.newInWindow > 10) score += 0.15;

    // Error spike in logs
    const errorRate = data.logs.total > 0 ? data.logs.errorCount / data.logs.total : 0;
    if (errorRate > 0.1) score += 0.3;
    else if (errorRate > 0.05) score += 0.15;

    // Security anomaly
    if (data.security.bruteForce > 10) score += 0.3;
    else if (data.security.bruteForce > 5) score += 0.15;

    // Task failure spike
    const taskFailRate = (data.tasks.completed + data.tasks.failed) > 0 ? data.tasks.failed / (data.tasks.completed + data.tasks.failed) : 0;
    if (taskFailRate > 0.2) score += 0.2;
    else if (taskFailRate > 0.1) score += 0.1;

    return Math.min(1, score);
  }

  private correlateIssues(data: MonitoredData): CorrelatedIssue[] {
    const issues: CorrelatedIssue[] = [];

    // Alarm burst + security events = possible attack
    if (data.alarms.newInWindow > 15 && data.security.bruteForce > 3) {
      issues.push({
        type: 'security_incident',
        severity: 'critical',
        elements: [],
        description: `Correlated alarm burst (${data.alarms.newInWindow}) with security events (${data.security.bruteForce} denied) - possible coordinated attack`,
        confidence: 0.85,
      });
    }

    // Critical alarms + task failures = infrastructure problem
    if (data.alarms.critical > 10 && data.tasks.failed > 5) {
      issues.push({
        type: 'cascade_failure',
        severity: 'critical',
        elements: [],
        description: `Cascade pattern: ${data.alarms.critical} critical alarms with ${data.tasks.failed} task failures`,
        confidence: 0.75,
      });
    }

    // Many pending tasks = capacity exhaustion
    if (data.tasks.pending > 100) {
      issues.push({
        type: 'capacity_exhaustion',
        severity: data.tasks.pending > 200 ? 'high' : 'medium',
        elements: [],
        description: `Task queue saturation: ${data.tasks.pending} pending tasks`,
        confidence: 0.9,
      });
    }

    // Service degradation pattern
    if (data.alarms.active > 50 && data.alarms.critical < 5) {
      issues.push({
        type: 'service_degradation',
        severity: 'medium',
        elements: [],
        description: `Sustained elevated alarm count: ${data.alarms.active} active alarms`,
        confidence: 0.7,
      });
    }

    return issues;
  }
}

// Singleton instance
export const mapekLoop = new MAPEKControlLoop(10000);
