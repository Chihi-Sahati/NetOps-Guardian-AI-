import { NextResponse } from 'next/server';
import { PerformanceBenchmark } from '@/lib/benchmark/performance-tester';

export async function GET() {
  try {
    const result = await PerformanceBenchmark.runAll();
    const dualPathStatus = PerformanceBenchmark.getDualPathStatus();

    return NextResponse.json({
      success: true,
      timestamp: result.timestamp,
      metrics: result.metrics,
      dualPath: dualPathStatus,
      details: result.details,
    });
  } catch (error) {
    console.error('Benchmark error:', error);
    return NextResponse.json({ success: false, error: 'Benchmark failed' }, { status: 500 });
  }
}
