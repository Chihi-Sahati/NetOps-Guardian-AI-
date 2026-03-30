// ============================================
// NETOPS GUARDIAN AI - Zero Trust Policy Enforcement Point
// Implements Trust Score: T(e,t) = w_h·H(e,t) + w_b·B(e,t) + w_a·A(e,t) + w_n·N(e,t)
// Equation 14 from the manuscript
// ============================================

import { db } from '@/lib/db';
import type { RiskLevel, AuditAction, UserRole } from '@/lib/types';

// ============================================
// TRUST SCORE COMPUTATION (Equation 14)
// T(e,t) = w_h * H(e,t) + w_b * B(e,t) + w_a * A(e,t) + w_n * N(e,t)
// Where sum(w_i) = 1
// ============================================

export interface TrustWeights {
  w_h: number; // Historical trust weight
  w_b: number; // Behavioral anomaly weight
  w_a: number; // Authentication confidence weight
  w_n: number; // Network context weight
}

export const DEFAULT_TRUST_WEIGHTS: TrustWeights = {
  w_h: 0.35,
  w_b: 0.25,
  w_a: 0.25,
  w_n: 0.15,
};

// Validate weights sum to 1
function validateWeights(w: TrustWeights): void {
  const sum = w.w_h + w.w_b + w.w_a + w.w_n;
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error(`Trust weights must sum to 1.0, got ${sum}`);
  }
}

// ============================================
// HISTORICAL TRUST: Exponential Moving Average (Equation 15)
// H(e,t) = alpha * H(e,t-1) + (1 - alpha) * s(e,t)
// alpha = smoothing factor (0.7 for weekly pattern, higher = slower decay)
// s(e,t) = current session score (0 to 1)
// ============================================

export interface HistoricalTrustState {
  H: number;       // Current historical trust value
  alpha: number;   // Smoothing factor
  lastUpdate: number; // Timestamp of last update
}

// In-memory store for historical trust (per entity)
const historicalTrustStore: Map<string, HistoricalTrustState> = new Map();

const DEFAULT_ALPHA = 0.7; // EMA smoothing factor
const TRUST_DECAY_TAU = 0.05; // Time decay per hour without activity

/**
 * Update historical trust using EMA (Equation 15)
 */
export function updateHistoricalTrust(
  entityId: string,
  currentScore: number,
  alpha: number = DEFAULT_ALPHA
): number {
  const now = Date.now();
  const existing = historicalTrustStore.get(entityId);

  let H: number;

  if (existing) {
    // Apply time decay if entity has been inactive
    const hoursSinceLastUpdate = (now - existing.lastUpdate) / (1000 * 60 * 60);
    const decayFactor = Math.max(0.5, 1 - TRUST_DECAY_TAU * hoursSinceLastUpdate);
    const decayedH = existing.H * decayFactor;

    // Equation 15: H(e,t) = alpha * H(e,t-1) + (1-alpha) * s(e,t)
    H = alpha * decayedH + (1 - alpha) * currentScore;
  } else {
    // First time: initialize with current score
    H = currentScore;
  }

  H = Math.max(0, Math.min(1, H)); // Clamp to [0, 1]

  historicalTrustStore.set(entityId, { H, alpha, lastUpdate: now });
  return H;
}

/**
 * Get current historical trust for an entity
 */
export function getHistoricalTrust(entityId: string): number {
  return historicalTrustStore.get(entityId)?.H ?? 0.5; // Default to neutral
}

// ============================================
// BEHAVIORAL ANOMALY SCORE: B(e,t)
// Detects deviations from established behavioral patterns
// ============================================

export interface BehavioralParams {
  failedAttempts: number;       // Recent failed auth attempts
  unusualResourceAccess: boolean; // Accessing resources not normally used
  offHoursAccess: boolean;       // Access outside normal hours
  rapidActionSequence: boolean;  // Unusually fast sequence of actions
  isNewDevice: boolean;          // Login from new device/IP
  geolocationAnomaly: boolean;   // Impossible travel / unexpected location
}

export function computeBehavioralScore(params: BehavioralParams): number {
  let score = 1.0; // Start with perfect score (1.0 = no anomaly)

  // Failed attempts penalty (exponential decay)
  score -= Math.min(0.4, params.failedAttempts * 0.08);

  // Off-hours access
  if (params.offHoursAccess) score -= 0.15;

  // Unusual resource access
  if (params.unusualResourceAccess) score -= 0.15;

  // Rapid action sequence
  if (params.rapidActionSequence) score -= 0.1;

  // New device
  if (params.isNewDevice) score -= 0.1;

  // Geolocation anomaly
  if (params.geolocationAnomaly) score -= 0.2;

  return Math.max(0, Math.min(1, score));
}

// ============================================
// AUTHENTICATION CONFIDENCE: A(e,t)
// Measures strength of current authentication
// ============================================

export interface AuthParams {
  hasMFA: boolean;
  sessionAge: number;          // Session age in hours
  passwordStrength: number;    // 0-1 normalized password strength
  certBased: boolean;          // Certificate-based auth
  ssoUsed: boolean;            // SSO used
  recentPasswordChange: boolean;
}

export function computeAuthConfidence(params: AuthParams): number {
  let score = 0;

  // MFA provides strongest confidence
  if (params.hasMFA) score += 0.35;
  else score += 0.10;

  // Certificate-based auth
  if (params.certBased) score += 0.20;
  else score += 0.05;

  // SSO
  if (params.ssoUsed) score += 0.10;

  // Password strength
  score += params.passwordStrength * 0.15;

  // Recent password change
  if (params.recentPasswordChange) score += 0.10;
  else score += 0.05;

  // Session age penalty
  if (params.sessionAge > 8) score -= 0.10;
  else if (params.sessionAge > 4) score -= 0.05;

  return Math.max(0, Math.min(1, score));
}

// ============================================
// NETWORK CONTEXT SCORE: N(e,t)
// Evaluates the network environment of the request
// ============================================

export interface NetworkContextParams {
  isInternalIP: boolean;
  isVPN: boolean;
  isKnownSubnet: boolean;
  tlsVersion: string;
  hasForwardSecrecy: boolean;
  reputationScore: number; // 0-1 from threat intelligence
  connectionLatency: number; // ms
}

export function computeNetworkContextScore(params: NetworkContextParams): number {
  let score = 0;

  // Internal network
  if (params.isInternalIP) score += 0.30;
  else if (params.isVPN) score += 0.20;
  else score += 0.05;

  // Known subnet bonus
  if (params.isKnownSubnet) score += 0.15;

  // TLS version
  if (params.tlsVersion === '1.3') score += 0.15;
  else if (params.tlsVersion === '1.2') score += 0.10;
  else score += 0.0;

  // Forward secrecy
  if (params.hasForwardSecrecy) score += 0.15;

  // Reputation
  score += params.reputationScore * 0.15;

  // Connection latency anomaly detection
  if (params.connectionLatency > 500) score -= 0.05;

  return Math.max(0, Math.min(1, score));
}

// ============================================
// COMBINED TRUST SCORE (Equation 14)
// T(e,t) = w_h·H(e,t) + w_b·B(e,t) + w_a·A(e,t) + w_n·N(e,t)
// ============================================

export interface TrustScoreResult {
  T: number;          // Overall trust score [0, 1]
  H: number;          // Historical trust
  B: number;          // Behavioral score
  A: number;          // Authentication confidence
  N: number;          // Network context score
  weights: TrustWeights;
  authorized: boolean; // Auth(e,t) = 1 if T >= tau (Eq. 16)
  threshold: number;   // tau threshold
  riskLevel: RiskLevel;
}

// Dynamic threshold: tau(t) can vary based on threat level
const BASE_THRESHOLD = 0.6;

function getAdaptiveThreshold(): number {
  const hour = new Date().getHours();
  // Higher threshold during off-hours
  if (hour >= 22 || hour < 6) return 0.70;
  return BASE_THRESHOLD;
}

/**
 * Compute the complete trust score for an entity.
 * T(e,t) = w_h * H + w_b * B + w_a * A + w_n * N (Equation 14)
 * Auth(e,t) = 1 if T(e,t) >= tau(t), 0 otherwise (Equation 16)
 */
export function computeTrustScore(
  entityId: string,
  behavioral: BehavioralParams,
  auth: AuthParams,
  network: NetworkContextParams,
  weights: TrustWeights = DEFAULT_TRUST_WEIGHTS,
  sessionScore?: number
): TrustScoreResult {
  validateWeights(weights);

  // Compute each component
  const s = sessionScore ?? (behavioral.failedAttempts === 0 ? 0.9 : 0.5);
  const H = updateHistoricalTrust(entityId, s);
  const B = computeBehavioralScore(behavioral);
  const A = computeAuthConfidence(auth);
  const N = computeNetworkContextScore(network);

  // Equation 14: T(e,t) = w_h * H + w_b * B + w_a * A + w_n * N
  const T = weights.w_h * H + weights.w_b * B + weights.w_a * A + weights.w_n * N;

  // Equation 16: Authorization decision
  const threshold = getAdaptiveThreshold();
  const authorized = T >= threshold;

  // Risk level classification
  let riskLevel: RiskLevel;
  if (T >= 0.8) riskLevel = 'low';
  else if (T >= 0.6) riskLevel = 'medium';
  else if (T >= 0.4) riskLevel = 'high';
  else riskLevel = 'critical';

  return { T, H, B, A, N, weights, authorized, threshold, riskLevel };
}

// ============================================
// ZERO TRUST PEP (Policy Enforcement Point)
// ============================================

export class ZeroTrustPEP {
  private static authAttempts: Map<string, { count: number; windowStart: number; blocked: boolean }> = new Map();
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly WINDOW_MS = 15 * 60 * 1000; // 15 min

  static isInternalIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }

  /**
   * Evaluate a request through the Zero Trust pipeline.
   * Returns trust score and authorization decision.
   */
  static evaluate(params: {
    userId: string;
    action: AuditAction;
    resource: string;
    ipAddress: string;
    userAgent: string;
    tlsVersion?: string;
    hasMFA?: boolean;
    sessionId?: string;
  }): TrustScoreResult & { evaluationTimeMs: number } {
    const startTime = performance.now();

    const hour = new Date().getHours();
    const isOffHours = hour < 6 || hour > 22;
    const isInternal = this.isInternalIP(params.ipAddress);

    // Get failed attempts
    const attemptRecord = this.authAttempts.get(params.userId + ':' + params.ipAddress);
    const failedAttempts = attemptRecord?.count ?? 0;

    // Compute all trust components
    const behavioral: BehavioralParams = {
      failedAttempts,
      unusualResourceAccess: params.action === 'config_change' || params.action === 'provisioning',
      offHoursAccess: isOffHours,
      rapidActionSequence: false,
      isNewDevice: !isInternal,
      geolocationAnomaly: false,
    };

    const auth: AuthParams = {
      hasMFA: params.hasMFA ?? true,
      sessionAge: 1,
      passwordStrength: 0.8,
      certBased: false,
      ssoUsed: true,
      recentPasswordChange: false,
    };

    const network: NetworkContextParams = {
      isInternalIP: isInternal,
      isVPN: !isInternal,
      isKnownSubnet: isInternal,
      tlsVersion: params.tlsVersion ?? '1.3',
      hasForwardSecrecy: true,
      reputationScore: isInternal ? 0.95 : 0.7,
      connectionLatency: isInternal ? 5 : 50,
    };

    const result = computeTrustScore(params.userId, behavioral, auth, network);

    const evaluationTimeMs = performance.now() - startTime;

    // Record attempt
    if (!result.authorized) {
      const now = Date.now();
      const record = this.authAttempts.get(params.userId + ':' + params.ipAddress);
      if (record && now - record.windowStart < this.WINDOW_MS) {
        record.count++;
        if (record.count >= this.MAX_ATTEMPTS) record.blocked = true;
      } else {
        this.authAttempts.set(params.userId + ':' + params.ipAddress, { count: 1, windowStart: now, blocked: false });
      }
    } else {
      this.authAttempts.delete(params.userId + ':' + params.ipAddress);
    }

    return { ...result, evaluationTimeMs };
  }
}

// ============================================
// LEGACY COMPATIBILITY: Risk Assessment Engine
// (Kept for backward compatibility with existing code)
// ============================================

export class RiskAssessmentEngine {
  static calculateRiskScore(params: {
    action: AuditAction;
    userId?: string;
    ipAddress?: string;
    resourceType?: string;
    previousFailures?: number;
    timeOfDay?: Date;
  }): RiskLevel {
    const pepResult = ZeroTrustPEP.evaluate({
      userId: params.userId ?? 'anonymous',
      action: params.action,
      resource: params.resourceType ?? 'unknown',
      ipAddress: params.ipAddress ?? '0.0.0.0',
      userAgent: 'system',
    });
    return pepResult.riskLevel;
  }

  static isInternalIP(ip: string): boolean {
    return ZeroTrustPEP.isInternalIP(ip);
  }

  static scoreToRiskLevel(score: number): RiskLevel {
    if (score >= 0.8) return 'low';
    if (score >= 0.6) return 'medium';
    if (score >= 0.4) return 'high';
    return 'critical';
  }
}

// ============================================
// AUTH MANAGER, AUDIT LOGGER, RATE LIMITER
// (Kept for backward compatibility)
// ============================================

export class AuthManager {
  static async validateSession(token: string): Promise<{ valid: boolean; userId?: string; role?: UserRole; error?: string }> {
    try {
      const session = await db.session.findUnique({ where: { token }, include: { user: true } });
      if (!session) return { valid: false, error: 'Session not found' };
      if (session.expiresAt < new Date()) { await db.session.delete({ where: { id: session.id } }); return { valid: false, error: 'Session expired' }; }
      if (!session.user.isActive) return { valid: false, error: 'User is inactive' };
      return { valid: true, userId: session.userId, role: session.user.role as UserRole };
    } catch { return { valid: false, error: 'Session validation failed' }; }
  }

  static async checkPermission(userId: string, resource: string, action: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) return { allowed: false, reason: 'User not found or inactive' };
      const permissions: Record<UserRole, string[]> = { admin: ['*'], operator: ['read', 'write', 'acknowledge', 'provision'], viewer: ['read', 'acknowledge'] };
      const userPermissions = permissions[user.role as UserRole] || [];
      if (userPermissions.includes('*') || userPermissions.includes(action)) return { allowed: true };
      return { allowed: false, reason: 'Insufficient permissions' };
    } catch { return { allowed: false, reason: 'Permission check failed' }; }
  }

  static async createSession(userId: string, ipAddress: string, deviceInfo: string): Promise<string> {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await db.session.create({ data: { userId, token, ipAddress, deviceInfo, expiresAt } });
    return token;
  }

  static async revokeSession(token: string): Promise<void> { await db.session.deleteMany({ where: { token } }); }
  static async revokeAllUserSessions(userId: string): Promise<void> { await db.session.deleteMany({ where: { userId } }); }
}

export class AuditLogger {
  static async log(params: { userId?: string; action: AuditAction; resource?: string; resourceType?: string; result: 'success' | 'failure' | 'denied'; ipAddress?: string; userAgent?: string; details?: Record<string, unknown>; riskLevel?: RiskLevel }) {
    const riskLevel = params.riskLevel || RiskAssessmentEngine.calculateRiskScore({ action: params.action, userId: params.userId, ipAddress: params.ipAddress, resourceType: params.resourceType });
    return db.securityAudit.create({ data: { userId: params.userId, action: params.action, resource: params.resource, resourceType: params.resourceType, result: params.result, ipAddress: params.ipAddress, userAgent: params.userAgent, details: params.details ? JSON.stringify(params.details) : null, riskLevel } });
  }
  static async getRecentAlerts(limit = 50) { return db.securityAudit.findMany({ where: { riskLevel: { in: ['high', 'critical'] } }, orderBy: { timestamp: 'desc' }, take: limit }); }
  static async getUserActivity(userId: string, limit = 100) { return db.securityAudit.findMany({ where: { userId }, orderBy: { timestamp: 'desc' }, take: limit }); }
}

export class RateLimiter {
  private static attempts: Map<string, { count: number; lastAttempt: Date }> = new Map();
  static checkRateLimit(identifier: string, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    const now = new Date(); const record = this.attempts.get(identifier);
    if (record) { const elapsed = now.getTime() - record.lastAttempt.getTime(); if (elapsed > windowMs) { this.attempts.delete(identifier); return { allowed: true, remainingAttempts: maxAttempts }; } if (record.count >= maxAttempts) { return { allowed: false, remainingAttempts: 0, lockoutRemaining: windowMs - elapsed }; } return { allowed: true, remainingAttempts: maxAttempts - record.count }; }
    return { allowed: true, remainingAttempts: maxAttempts };
  }
  static recordAttempt(identifier: string) { const now = new Date(); const record = this.attempts.get(identifier); if (record) { record.count++; record.lastAttempt = now; } else { this.attempts.set(identifier, { count: 1, lastAttempt: now }); } }
  static clearAttempts(identifier: string) { this.attempts.delete(identifier); }
}

export class ZeroTrustMiddleware {
  static async verify(params: { token: string; resource: string; action: string; ipAddress: string; userAgent: string }) {
    const sessionResult = await AuthManager.validateSession(params.token);
    if (!sessionResult.valid) { await AuditLogger.log({ action: 'access_denied', resource: params.resource, result: 'denied', ipAddress: params.ipAddress, userAgent: params.userAgent, details: { reason: sessionResult.error } }); return { allowed: false, error: sessionResult.error }; }
    const permissionResult = await AuthManager.checkPermission(sessionResult.userId!, params.resource, params.action);
    if (!permissionResult.allowed) { await AuditLogger.log({ userId: sessionResult.userId, action: 'access_denied', resource: params.resource, result: 'denied', ipAddress: params.ipAddress, userAgent: params.userAgent, details: { reason: permissionResult.reason, action: params.action } }); return { allowed: false, error: permissionResult.reason }; }
    const pepResult = ZeroTrustPEP.evaluate({ userId: sessionResult.userId!, action: params.action as AuditAction, resource: params.resource, ipAddress: params.ipAddress, userAgent: params.userAgent });
    if (!pepResult.authorized) { await AuditLogger.log({ userId: sessionResult.userId, action: 'access_denied', resource: params.resource, result: 'denied', ipAddress: params.ipAddress, userAgent: params.userAgent, details: { reason: 'Trust score below threshold', trustScore: pepResult.T, threshold: pepResult.threshold }, riskLevel: pepResult.riskLevel }); return { allowed: false, error: 'Trust score below threshold', trustScore: pepResult.T, riskLevel: pepResult.riskLevel }; }
    await AuditLogger.log({ userId: sessionResult.userId, action: 'access_granted', resource: params.resource, result: 'success', ipAddress: params.ipAddress, userAgent: params.userAgent, details: { action: params.action, trustScore: pepResult.T }, riskLevel: pepResult.riskLevel });
    return { allowed: true, userId: sessionResult.userId, role: sessionResult.role, riskLevel: pepResult.riskLevel, trustScore: pepResult.T };
  }
}
