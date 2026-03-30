// ============================================
// NETOPS GUARDIAN AI - MAS Coordination Protocol
// Implements Multi-Agent System coordination with:
// - Message types: ALERT, INSIGHT, REQUEST, RESPONSE, COORDINATE
// - Priority-based task allocation
// - Weighted voting consensus
// - Inter-agent state sharing (S_shared per Equation 24)
// - Coordination latency measurement (target: L_coord <= 50ms)
// - Dead-letter queue for failed messages
// ============================================

export type MessageType = 'ALERT' | 'INSIGHT' | 'REQUEST' | 'RESPONSE' | 'COORDINATE';

export type AgentRole = 'alarm' | 'log' | 'provisioning' | 'security' | 'orchestrator';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface MASMessage {
  id: string;
  type: MessageType;
  sender: AgentRole;
  recipient: AgentRole | 'broadcast';
  priority: Priority;
  payload: Record<string, unknown>;
  timestamp: number;
  correlationId?: string;
  replyTo?: string;
  ttl: number; // Time-to-live in ms
}

export interface AgentState {
  role: AgentRole;
  status: 'idle' | 'running' | 'waiting' | 'error';
  currentTask: string | null;
  tasksProcessed: number;
  tasksPending: number;
  lastHeartbeat: number;
  capabilities: string[];
  loadFactor: number; // 0-1
}

export interface CoordinationMetrics {
  messagesProcessed: number;
  messagesFailed: number;
  deadLetters: number;
  avgCoordinationLatencyMs: number;
  maxCoordinationLatencyMs: number;
  lastCoordinationTime: number;
  consensusVotes: number;
  consensusConflicts: number;
}

// ============================================
// SHARED STATE (Equation 24: S_shared)
// ============================================

export interface SharedState {
  version: number;
  agents: Record<AgentRole, AgentState>;
  globalAlerts: Array<{ severity: string; description: string; timestamp: number }>;
  coordinationQueue: MASMessage[];
  consensusResults: ConsensusResult[];
  lastUpdated: number;
}

export interface ConsensusResult {
  topic: string;
  votes: Record<AgentRole, { vote: 'approve' | 'reject' | 'abstain'; confidence: number }>;
  outcome: 'approved' | 'rejected' | 'undecided';
  timestamp: number;
  weightedScore: number;
}

// ============================================
// MAS COORDINATOR
// ============================================

export class MASCoordinator {
  private sharedState: SharedState;
  private deadLetterQueue: MASMessage[] = [];
  private metrics: CoordinationMetrics;
  private latencyHistory: number[] = [];
  private agentHandlers: Map<AgentRole, (msg: MASMessage) => Promise<MASMessage | null>>;
  private isRunning: boolean = false;

  constructor() {
    this.sharedState = {
      version: 0,
      agents: {
        alarm: { role: 'alarm', status: 'idle', currentTask: null, tasksProcessed: 0, tasksPending: 0, lastHeartbeat: 0, capabilities: ['correlate', 'acknowledge', 'clear'], loadFactor: 0 },
        log: { role: 'log', status: 'idle', currentTask: null, tasksProcessed: 0, tasksPending: 0, lastHeartbeat: 0, capabilities: ['parse', 'analyze', 'classify'], loadFactor: 0 },
        provisioning: { role: 'provisioning', status: 'idle', currentTask: null, tasksProcessed: 0, tasksPending: 0, lastHeartbeat: 0, capabilities: ['push_config', 'backup', 'discover', 'firmware'], loadFactor: 0 },
        security: { role: 'security', status: 'idle', currentTask: null, tasksProcessed: 0, tasksPending: 0, lastHeartbeat: 0, capabilities: ['detect_threat', 'block_ip', 'audit', 'zero_trust'], loadFactor: 0 },
        orchestrator: { role: 'orchestrator', status: 'idle', currentTask: null, tasksProcessed: 0, tasksPending: 0, lastHeartbeat: 0, capabilities: ['coordinate', 'plan', 'allocate', 'monitor'], loadFactor: 0 },
      },
      globalAlerts: [],
      coordinationQueue: [],
      consensusResults: [],
      lastUpdated: Date.now(),
    };

    this.metrics = {
      messagesProcessed: 0,
      messagesFailed: 0,
      deadLetters: 0,
      avgCoordinationLatencyMs: 0,
      maxCoordinationLatencyMs: 0,
      lastCoordinationTime: 0,
      consensusVotes: 0,
      consensusConflicts: 0,
    };

    this.agentHandlers = new Map();
  }

  // ============================================
  // AGENT REGISTRATION
  // ============================================

  registerAgent(role: AgentRole, handler: (msg: MASMessage) => Promise<MASMessage | null>): void {
    this.agentHandlers.set(role, handler);
    this.sharedState.agents[role].lastHeartbeat = Date.now();
  }

  // ============================================
  // MESSAGE ROUTING
  // ============================================

  /**
   * Send a message through the coordination protocol.
   * Measures coordination latency (target: L_coord <= 50ms).
   */
  async sendMessage(msg: MASMessage): Promise<MASMessage | null> {
    const sendTime = performance.now();

    // Check TTL
    if (Date.now() - msg.timestamp > msg.ttl) {
      this.deadLetterQueue.push(msg);
      this.metrics.deadLetters++;
      this.metrics.messagesFailed++;
      return null;
    }

    try {
      let response: MASMessage | null = null;

      if (msg.recipient === 'broadcast') {
        // Broadcast to all agents
        const roles: AgentRole[] = ['alarm', 'log', 'provisioning', 'security'];
        const promises = roles.map(role => {
          const handler = this.agentHandlers.get(role);
          if (handler) return handler(msg);
          return Promise.resolve(null);
        });
        await Promise.allSettled(promises);
      } else {
        // Direct message
        const handler = this.agentHandlers.get(msg.recipient);
        if (handler) {
          response = await handler(msg);
        } else {
          this.deadLetterQueue.push(msg);
          this.metrics.deadLetters++;
          this.metrics.messagesFailed++;
          return null;
        }
      }

      // Update metrics
      const latency = performance.now() - sendTime;
      this.recordLatency(latency);
      this.metrics.messagesProcessed++;
      this.metrics.lastCoordinationTime = latency;

      return response;
    } catch (error) {
      this.metrics.messagesFailed++;
      this.deadLetterQueue.push(msg);
      return null;
    }
  }

  /**
   * Create and send a message
   */
  async send(
    type: MessageType,
    sender: AgentRole,
    recipient: AgentRole | 'broadcast',
    priority: Priority,
    payload: Record<string, unknown>,
    correlationId?: string,
    ttl: number = 30000
  ): Promise<MASMessage | null> {
    const msg: MASMessage = {
      id: `mas-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type,
      sender,
      recipient,
      priority,
      payload,
      timestamp: Date.now(),
      correlationId,
      ttl,
    };

    return this.sendMessage(msg);
  }

  // ============================================
  // SHARED STATE MANAGEMENT (Equation 24)
  // S_shared synchronization
  // ============================================

  updateAgentState(role: AgentRole, updates: Partial<AgentState>): void {
    const agent = this.sharedState.agents[role];
    if (agent) {
      Object.assign(agent, updates);
      agent.lastHeartbeat = Date.now();
      this.incrementVersion();
    }
  }

  getSharedState(): SharedState {
    return { ...this.sharedState };
  }

  addGlobalAlert(severity: string, description: string): void {
    this.sharedState.globalAlerts.push({ severity, description, timestamp: Date.now() });
    if (this.sharedState.globalAlerts.length > 50) {
      this.sharedState.globalAlerts = this.sharedState.globalAlerts.slice(-30);
    }
    this.incrementVersion();
  }

  private incrementVersion(): void {
    this.sharedState.version++;
    this.sharedState.lastUpdated = Date.now();
  }

  // ============================================
  // PRIORITY-BASED TASK ALLOCATION
  // ============================================

  /**
   * Allocate a task to the least-loaded capable agent.
   */
  allocateTask(requiredCapability: string, priority: Priority): AgentRole | null {
    const priorityWeight: Record<Priority, number> = { critical: 4, high: 3, medium: 2, low: 1 };

    let bestAgent: AgentRole | null = null;
    let bestScore = Infinity;

    for (const [role, state] of Object.entries(this.sharedState.agents)) {
      if (role === 'orchestrator') continue;
      if (!state.capabilities.includes(requiredCapability)) continue;
      if (state.status === 'error') continue;

      // Score: lower is better (load * priority factor)
      const score = state.loadFactor * (state.status === 'running' ? 1.5 : 1) / priorityWeight[priority];

      if (score < bestScore) {
        bestScore = score;
        bestAgent = role as AgentRole;
      }
    }

    return bestAgent;
  }

  // ============================================
  // WEIGHTED VOTING CONSENSUS
  // ============================================

  /**
   * Initiate a consensus vote among agents.
   * Uses weighted voting where agent weights are based on capability relevance.
   */
  async initiateConsensus(
    topic: string,
    voters: AgentRole[],
    proposer: AgentRole
  ): Promise<ConsensusResult> {
    const weights: Record<AgentRole, number> = {
      alarm: 0.25,
      log: 0.15,
      provisioning: 0.20,
      security: 0.25,
      orchestrator: 0.15,
    };

    // Collect votes
    const votes: ConsensusResult['votes'] = {};

    for (const role of voters) {
      const state = this.sharedState.agents[role];
      const confidence = 1 - state.loadFactor; // More loaded = less confident
      const weight = weights[role] || 0.2;

      // Default vote based on load (overloaded agents vote against new work)
      const vote: 'approve' | 'reject' | 'abstain' = state.loadFactor < 0.8 ? 'approve' : 'abstain';

      votes[role] = { vote, confidence };
      this.metrics.consensusVotes++;
    }

    // Compute weighted score
    let totalWeight = 0;
    let approveWeight = 0;
    let hasConflict = false;
    let lastVote: string | null = null;

    for (const [role, v] of Object.entries(votes)) {
      const w = weights[role as AgentRole] || 0.2;
      totalWeight += w * v.confidence;
      if (v.vote === 'approve') approveWeight += w * v.confidence;

      if (lastVote && v.vote !== lastVote) hasConflict = true;
      lastVote = v.vote;
    }

    if (hasConflict) this.metrics.consensusConflicts++;

    const weightedScore = totalWeight > 0 ? approveWeight / totalWeight : 0;
    const outcome: ConsensusResult['outcome'] = weightedScore >= 0.6 ? 'approved' : weightedScore >= 0.4 ? 'undecided' : 'rejected';

    const result: ConsensusResult = {
      topic,
      votes,
      outcome,
      timestamp: Date.now(),
      weightedScore,
    };

    this.sharedState.consensusResults.push(result);
    if (this.sharedState.consensusResults.length > 50) {
      this.sharedState.consensusResults = this.sharedState.consensusResults.slice(-30);
    }

    return result;
  }

  // ============================================
  // COORDINATION LATENCY MEASUREMENT
  // ============================================

  private recordLatency(latencyMs: number): void {
    this.latencyHistory.push(latencyMs);
    if (this.latencyHistory.length > 100) this.latencyHistory.shift();

    this.metrics.avgCoordinationLatencyMs = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
    this.metrics.maxCoordinationLatencyMs = Math.max(...this.latencyHistory);
  }

  isLatencyWithinTarget(targetMs: number = 50): boolean {
    return this.metrics.avgCoordinationLatencyMs <= targetMs;
  }

  // ============================================
  // DEAD LETTER QUEUE
  // ============================================

  getDeadLetters(): MASMessage[] {
    return [...this.deadLetterQueue];
  }

  clearDeadLetters(): number {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    return count;
  }

  retryDeadLetters(maxRetries: number = 3): Promise<number> {
    const toRetry = this.deadLetterQueue.slice(0, maxRetries);
    this.deadLetterQueue = this.deadLetterQueue.slice(maxRetries);

    return Promise.all(
      toRetry.map(msg => this.sendMessage({ ...msg, timestamp: Date.now() }))
    ).then(results => results.filter(r => r !== null).length);
  }

  // ============================================
  // METRICS
  // ============================================

  getMetrics(): CoordinationMetrics {
    return { ...this.metrics };
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[MAS] Coordinator started');
  }

  stop(): void {
    this.isRunning = false;
    console.log('[MAS] Coordinator stopped');
  }
}

// Singleton instance
export const masCoordinator = new MASCoordinator();
