import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { mapekLoop } = await import('@/lib/mapek/control-loop');
    const state = mapekLoop.getState();

    return NextResponse.json({
      success: true,
      state: {
        cycleCount: state.cycleCount,
        phase: state.phase,
        lastCycleTimeMs: state.lastCycleTime,
        pid: {
          Kp: state.pid.Kp,
          Ki: state.pid.Ki,
          Kd: state.pid.Kd,
          currentError: state.pid.lastError,
          integral: Math.round(state.pid.integral * 1000) / 1000,
        },
        healthHistory: state.healthHistory.slice(-20),
        anomalyHistory: state.anomalyHistory.slice(-20),
        analysis: state.lastAnalysis ? {
          healthScore: Math.round(state.lastAnalysis.healthScore * 1000) / 1000,
          anomalyScore: Math.round(state.lastAnalysis.anomalyScore * 1000) / 1000,
          correlatedIssues: state.lastAnalysis.correlatedIssues.length,
          performanceDegradation: state.lastAnalysis.performanceDegradation,
          securityThreats: state.lastAnalysis.securityThreats,
          pidError: Math.round(state.lastAnalysis.pidError * 1000) / 1000,
        } : null,
        plan: state.lastPlan ? {
          id: state.lastPlan.id,
          strategy: state.lastPlan.strategy,
          priority: state.lastPlan.priority,
          actions: state.lastPlan.actions.length,
          autoExecutable: state.lastPlan.autoExecutable,
          estimatedImpact: state.lastPlan.estimatedImpact,
        } : null,
        knowledgeBaseSize: state.knowledgeBase.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'MAPE-K not available' }, { status: 500 });
  }
}
