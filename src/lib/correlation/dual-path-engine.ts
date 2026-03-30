// ============================================
// NETOPS GUARDIAN AI - Dual-Path Correlation Engine
// Real M/M/1 (Fast Path) and M/M/c (Slow Path) Queuing Theory
// Implements Equations 6-13 from the manuscript
// ============================================

// Factorial helper using iterative approach
function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

// Power helper
function power(base: number, exp: number): number {
  return Math.pow(base, exp);
}

// ============================================
// M/M/1 QUEUING MODEL (Fast Path)
// Equations 6-7
// ============================================

export interface MM1Result {
  // Model parameters
  lambda_f: number; // Arrival rate (requests/s)
  mu_f: number;     // Service rate (requests/s)
  rho_f: number;    // Utilization factor

  // Steady-state probabilities
  P0: number;       // Probability system is empty (Eq. 6)
  Pn: (n: number) => number; // P(system has n customers)
  L: number;        // Average number in system
  Lq: number;       // Average number in queue
  W: number;        // Average time in system = E[T_f] (Eq. 7)
  Wq: number;       // Average time in queue

  // Stability
  isStable: boolean; // rho < 1
}

/**
 * Compute M/M/1 queuing metrics for the Fast Path.
 * Equation 6: P_0 = 1 - rho_f, where rho_f = lambda_f / mu_f
 * Equation 7: E[T_f] = 1 / (mu_f - lambda_f)
 */
export function computeMM1(lambda_f: number, mu_f: number): MM1Result {
  const rho_f = lambda_f / mu_f;
  const isStable = rho_f < 1;

  // Equation 6: P_0 = 1 - rho_f
  const P0 = isStable ? 1 - rho_f : 0;

  // P_n = (1 - rho) * rho^n
  const Pn = (n: number): number => {
    if (!isStable) return 0;
    return P0 * power(rho_f, n);
  };

  // L = rho / (1 - rho)
  const L = isStable ? rho_f / (1 - rho_f) : Infinity;

  // Lq = rho^2 / (1 - rho)
  const Lq = isStable ? power(rho_f, 2) / (1 - rho_f) : Infinity;

  // Equation 7: E[T_f] = 1 / (mu_f - lambda_f)
  const W = isStable ? 1 / (mu_f - lambda_f) : Infinity;

  // Wq = rho / (mu_f - lambda_f)
  const Wq = isStable ? rho_f / (mu_f - lambda_f) : Infinity;

  return { lambda_f, mu_f, rho_f, P0, Pn, L, Lq, W, Wq, isStable };
}

// ============================================
// M/M/c QUEUING MODEL (Slow Path)
// Equations 8-10
// ============================================

export interface MMcResult {
  // Model parameters
  lambda_s: number; // Arrival rate (requests/s)
  mu_s: number;     // Service rate per server (requests/s)
  c: number;        // Number of servers
  rho_s: number;    // Server utilization

  // Steady-state probabilities
  P0: number;       // Probability system is empty (Eq. 9)
  Pn: (n: number) => number;
  C: number;        // Erlang-C probability (prob. of waiting)

  // Performance metrics
  L: number;        // Average number in system
  Lq: number;       // Average number in queue
  W: number;        // Average time in system = E[W_s] + 1/mu_s
  Wq: number;       // Average wait time E[W_s] (Eq. 10)

  // Stability
  isStable: boolean; // rho < 1
}

/**
 * Compute M/M/c queuing metrics for the Slow Path.
 * Equation 8: rho_s = lambda_s / (c * mu_s)
 * Equation 9: P_0 = [Sum(n=0..c-1, (rho*c)^n/n!) + (rho*c)^c / (c! * (1-rho))]^-1
 * Equation 10: E[W_s] = [P_0 * (rho*c)^c * rho] / [c! * mu_s * (1-rho)^2]
 */
export function computeMMc(lambda_s: number, mu_s: number, c: number): MMcResult {
  const rho_s = lambda_s / (c * mu_s);
  const isStable = rho_s < 1;

  if (!isStable) {
    return {
      lambda_s, mu_s, c, rho_s,
      P0: 0, Pn: () => 0, C: 1,
      L: Infinity, Lq: Infinity, W: Infinity, Wq: Infinity,
      isStable: false,
    };
  }

  const a = lambda_s / mu_s; // Offered load

  // Equation 9: Compute P_0
  // P_0 = [sum_{n=0}^{c-1} a^n/n! + a^c / (c! * (1 - rho_s))]^-1
  let sumN = 0;
  for (let n = 0; n < c; n++) {
    sumN += power(a, n) / factorial(n);
  }
  const lastTerm = power(a, c) / (factorial(c) * (1 - rho_s));
  const P0 = 1 / (sumN + lastTerm);

  // P_n for n < c: P_n = P_0 * a^n / n!
  // P_n for n >= c: P_n = P_0 * a^n / (c! * c^(n-c))
  const Pn = (n: number): number => {
    if (n < c) {
      return P0 * power(a, n) / factorial(n);
    }
    return P0 * power(a, n) / (factorial(c) * power(c, n - c));
  };

  // Erlang-C: C(c, a) = [a^c / (c! * (1-rho))] * P_0
  const C_c = (power(a, c) / factorial(c)) * (rho_s / (1 - rho_s)) * P0;

  // Equation 10: E[W_s] = C(c,a) / (c * mu_s - lambda_s)
  const Wq = C_c / (c * mu_s - lambda_s);

  // Lq = lambda_s * Wq (Little's Law)
  const Lq = lambda_s * Wq;

  // W = Wq + 1/mu_s
  const W = Wq + 1 / mu_s;

  // L = lambda_s * W
  const L = lambda_s * W;

  return { lambda_s, mu_s, c, rho_s, P0, Pn, C: C_c, L, Lq, W, Wq, isStable };
}

// ============================================
// DUAL-PATH COMBINED MODEL
// Equations 11-13
// ============================================

export interface DualPathResult {
  // Fast path (M/M/1)
  fast: MM1Result;
  // Slow path (M/M/c)
  slow: MMcResult;
  // Escape probability
  p_esc: number;
  // Slow path overhead (analysis/deep inspection)
  E_epsilon: number; // E[ε]
  // Combined metrics
  // Equation 12: Theta = lambda_f + lambda_s <= mu_f + c*mu_s
  Theta: number;
  totalCapacity: number;
  isSystemStable: boolean;
  // Equation 13: E[T_total] = (1-p_esc)*E[T_f] + p_esc*(E[T_f] + E[T_s])
  E_T_fast: number;
  E_T_slow: number;
  E_T_total: number;
  // Equation 11: E[T_s] = E[W_s] + 1/mu_s + E[ε]
}

/**
 * Compute the complete dual-path correlation model.
 * Equation 11: E[T_s] = E[W_s] + 1/mu_s + E[ε]
 * Equation 12: Θ = λ_f + λ_s ≤ μ_f + c·μ_s
 * Equation 13: E[T_total] = (1-p_esc)·E[T_f] + p_esc·(E[T_f] + E[T_s])
 *
 * @param lambda_f Fast path arrival rate (alarms/s)
 * @param mu_f Fast path service rate (alarms/s)
 * @param lambda_s Slow path arrival rate (alarms/s)
 * @param mu_s Slow path service rate per server
 * @param c Number of slow path analysis servers
 * @param p_esc Escape probability (alarms that need deep analysis)
 * @param E_epsilon Average overhead time for slow path analysis (s)
 */
export function computeDualPath(
  lambda_f: number,
  mu_f: number,
  lambda_s: number,
  mu_s: number,
  c: number,
  p_esc: number = 0.15,
  E_epsilon: number = 0.002
): DualPathResult {
  const fast = computeMM1(lambda_f, mu_f);
  const slow = computeMMc(lambda_s, mu_s, c);

  // Equation 12: Total arrival rate
  const Theta = lambda_f + lambda_s;
  const totalCapacity = mu_f + c * mu_s;
  const isSystemStable = Theta < totalCapacity;

  // Equation 11: E[T_s] = E[W_s] + 1/mu_s + E[ε]
  const E_T_slow = (slow.isStable ? slow.Wq : 0) + 1 / mu_s + E_epsilon;

  // Equation 13: E[T_total]
  const E_T_fast = fast.isStable ? fast.W : 1 / mu_f; // fallback
  const E_T_total = (1 - p_esc) * E_T_fast + p_esc * (E_T_fast + E_T_slow);

  return {
    fast,
    slow,
    p_esc,
    E_epsilon,
    Theta,
    totalCapacity,
    isSystemStable,
    E_T_fast,
    E_T_slow,
    E_T_total,
  };
}

// ============================================
// DEFAULT PARAMETERS (based on manuscript)
// ============================================

export const DEFAULT_QUEUING_PARAMS = {
  // Fast path: high-speed pattern matching for simple alarms
  lambda_f: 45,    // 45 alarms/second arrival rate
  mu_f: 120,       // 120 alarms/second service rate (pattern matching ~8ms)
  // Slow path: deep AI analysis for complex correlations
  lambda_s: 8,     // 8 alarms/second escaping to slow path
  mu_s: 15,        // 15 alarms/second per analysis server
  c: 3,            // 3 parallel analysis servers
  p_esc: 0.15,     // 15% of alarms need deep analysis
  E_epsilon: 0.003, // 3ms average additional overhead
};

// ============================================
// RUN DUAL-PATH COMPUTATION WITH REAL-TIME PARAMS
// ============================================

export function getDualPathMetrics(customParams?: Partial<typeof DEFAULT_QUEUING_PARAMS>): DualPathResult {
  const params = { ...DEFAULT_QUEUING_PARAMS, ...customParams };
  return computeDualPath(
    params.lambda_f,
    params.mu_f,
    params.lambda_s,
    params.mu_s,
    params.c,
    params.p_esc,
    params.E_epsilon
  );
}

/**
 * Determine which path an alarm should take based on complexity scoring.
 * Returns true if alarm should go to slow path.
 */
export function shouldEscapeToSlowPath(alarm: {
  severity: string;
  alarmCode: string;
  count: number;
  hasCorrelation: boolean;
}): boolean {
  let score = 0;

  // Severity weighting
  if (alarm.severity === 'critical') score += 40;
  else if (alarm.severity === 'major') score += 25;
  else if (alarm.severity === 'minor') score += 10;

  // Repetition (burst detection)
  if (alarm.count > 10) score += 30;
  else if (alarm.count > 5) score += 15;

  // Known correlation patterns
  if (alarm.hasCorrelation) score += 35;

  // Unknown alarm codes get flagged
  if (alarm.alarmCode.startsWith('UNKNOWN')) score += 20;

  return score >= 50; // Threshold for slow path
}
