import { NextRequest, NextResponse } from 'next/server';

// ============================================
// SERVER-SENT EVENTS (SSE) STREAMING ENDPOINT
// Replaces 30-second polling with real-time updates
// ============================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Connected clients
const clients = new Set<ReadableStreamDefaultController>();

// Cache for latest data
const BROADCAST_INTERVAL = 5000; // 5 seconds

async function generateDataSnapshot() {
  const { db } = await import('@/lib/db');

  const [
    activeAlarms, criticalAlarms, totalLogs, errorLogs,
    pendingTasks, completedTasks, totalSecurityEvents, recentHighRisk,
  ] = await Promise.all([
    db.alarm.count({ where: { status: 'active' } }),
    db.alarm.count({ where: { severity: 'critical', status: 'active' } }),
    db.log.count(),
    db.log.count({ where: { logLevel: 'error' } }),
    db.provisioningTask.count({ where: { status: 'pending' } }),
    db.provisioningTask.count({ where: { status: 'completed' } }),
    db.securityAudit.count(),
    db.securityAudit.count({ where: { riskLevel: { in: ['high', 'critical'] }, timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) } } }),
  ]);

  // Recent alarms for streaming
  const recentAlarms = await db.alarm.findMany({
    orderBy: { firstSeen: 'desc' },
    take: 5,
    include: { networkElement: { select: { name: true, hostname: true } } },
  });

  // Dual-path queuing metrics
  let dualPathData = null;
  try {
    const { getDualPathMetrics } = await import('@/lib/correlation/dual-path-engine');
    const dualPath = getDualPathMetrics();
    dualPathData = {
      fastPathUtilization: Math.round(dualPath.fast.rho_f * 10000) / 100,
      avgResponseTimeMs: Math.round(dualPath.E_T_total * 1000 * 100) / 100,
      systemStable: dualPath.isSystemStable,
    };
  } catch { /* module not available */ }

  // MAPE-K state
  let mapekData = null;
  try {
    const { mapekLoop } = await import('@/lib/mapek/control-loop');
    const mapekState = mapekLoop.getState();
    mapekData = {
      cycleCount: mapekState.cycleCount,
      phase: mapekState.phase,
      lastCycleTimeMs: mapekState.lastCycleTime,
      healthScore: mapekState.lastAnalysis?.healthScore ?? null,
    };
  } catch { /* MAPE-K not started */ }

  return {
    type: 'snapshot',
    timestamp: new Date().toISOString(),
    data: {
      alarms: { active: activeAlarms, critical: criticalAlarms },
      logs: { total: totalLogs, errors: errorLogs },
      tasks: { pending: pendingTasks, completed: completedTasks },
      security: { totalEvents: totalSecurityEvents, recentHighRisk },
      recentAlarms: recentAlarms.map(a => ({
        id: a.id,
        severity: a.severity,
        name: a.alarmName,
        element: a.networkElement?.name || 'Unknown',
        timestamp: a.firstSeen.toISOString(),
      })),
      dualPath: dualPathData,
      mapek: mapekData,
    },
  };
}

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function sendEvent(data: unknown, event?: string) {
        try {
          const eventData = `event: ${event || 'message'}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(eventData));
        } catch {
          /* stream closed */
        }
      }

      // Send initial connection confirmation
      sendEvent({ type: 'connected', timestamp: new Date().toISOString() }, 'connected');

      // Periodic data push
      const interval = setInterval(async () => {
        try {
          const snapshot = await generateDataSnapshot();
          sendEvent(snapshot, 'snapshot');
        } catch (error) {
          console.error('[SSE] Error generating snapshot:', error);
        }
      }, BROADCAST_INTERVAL);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clients.delete(controller);
        try { controller.close(); } catch { /* already closed */ }
      });

      clients.add(controller);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
