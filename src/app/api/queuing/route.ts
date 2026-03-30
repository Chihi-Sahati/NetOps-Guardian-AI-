import { NextResponse } from 'next/server';
import { getDualPathMetrics, DEFAULT_QUEUING_PARAMS } from '@/lib/correlation/dual-path-engine';

export async function GET() {
  try {
    const metrics = getDualPathMetrics();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      parameters: DEFAULT_QUEUING_PARAMS,
      fastPath: {
        lambda_f: metrics.fast.lambda_f,
        mu_f: metrics.fast.mu_f,
        rho_f: Math.round(metrics.fast.rho_f * 10000) / 10000,
        P0: Math.round(metrics.fast.P0 * 10000) / 10000,
        L: Math.round(metrics.fast.L * 100) / 100,
        Lq: Math.round(metrics.fast.Lq * 100) / 100,
        E_T: Math.round(metrics.fast.W * 1000 * 100) / 100, // ms
        E_W: Math.round(metrics.fast.Wq * 1000 * 100) / 100, // ms
        isStable: metrics.fast.isStable,
      },
      slowPath: {
        lambda_s: metrics.slow.lambda_s,
        mu_s: metrics.slow.mu_s,
        c: metrics.slow.c,
        rho_s: Math.round(metrics.slow.rho_s * 10000) / 10000,
        P0: Math.round(metrics.slow.P0 * 10000) / 10000,
        C_Erlang: Math.round(metrics.slow.C * 10000) / 10000,
        L: Math.round(metrics.slow.L * 100) / 100,
        Lq: Math.round(metrics.slow.Lq * 100) / 100,
        E_W: Math.round(metrics.slow.Wq * 1000 * 100) / 100, // ms
        E_T: Math.round(metrics.slow.W * 1000 * 100) / 100, // ms
        isStable: metrics.slow.isStable,
      },
      combined: {
        p_esc: Math.round(metrics.p_esc * 10000) / 10000,
        E_epsilon: Math.round(metrics.E_epsilon * 1000000) / 1000000,
        Theta: Math.round(metrics.Theta * 100) / 100,
        totalCapacity: Math.round(metrics.totalCapacity * 100) / 100,
        isSystemStable: metrics.isSystemStable,
        E_T_fast: Math.round(metrics.E_T_fast * 1000 * 100) / 100,
        E_T_slow: Math.round(metrics.E_T_slow * 1000 * 100) / 100,
        E_T_total: Math.round(metrics.E_T_total * 1000 * 100) / 100,
      },
      equations: {
        eq6: 'P_0 = 1 - ρ_f',
        eq7: 'E[T_f] = 1 / (μ_f - λ_f)',
        eq8: 'ρ_s = λ_s / (c · μ_s)',
        eq9: 'P_0 = [Σ(n=0..c-1) a^n/n! + a^c/(c!·(1-ρ))]^-1',
        eq10: 'E[W_s] = C(c,a) / (c·μ_s - λ_s)',
        eq11: 'E[T_s] = E[W_s] + 1/μ_s + E[ε]',
        eq12: 'Θ = λ_f + λ_s ≤ μ_f + c·μ_s',
        eq13: 'E[T_total] = (1-p_esc)·E[T_f] + p_esc·(E[T_f] + E[T_s])',
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Queuing computation failed' }, { status: 500 });
  }
}
