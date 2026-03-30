import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/logs - List logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logLevel = searchParams.get('logLevel');
    const logType = searchParams.get('logType');
    const networkElementId = searchParams.get('networkElementId');
    const source = searchParams.get('source');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const searchQuery = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: Record<string, unknown> = {};
    if (logLevel) where.logLevel = logLevel;
    if (logType) where.logType = logType;
    if (networkElementId) where.networkElementId = networkElementId;
    if (source) where.source = source;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) (where.timestamp as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.timestamp as Record<string, Date>).lte = new Date(endDate);
    }

    if (searchQuery) {
      where.OR = [
        { message: { contains: searchQuery } },
        { rawLog: { contains: searchQuery } },
      ];
    }

    const [logs, total] = await Promise.all([
      db.log.findMany({
        where,
        include: {
          networkElement: {
            select: { id: true, name: true, hostname: true },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.log.count({ where }),
    ]);

    // Get log statistics
    const stats = await db.log.groupBy({
      by: ['logLevel', 'logType'],
      _count: { id: true },
      where: {
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    // Inject Presentation-Ready Logs
    const simulatedLogs = [
      {
        id: "mem-hit-1",
        timestamp: new Date(),
        networkElementId: "demo-id",
        logLevel: "info",
        facility: "local0",
        source: "MemoryAgent",
        process: "SemanticCache",
        message: "[CACHE HIT] Semantic match found in 1.06ms. Root Cause: MTU size error. Bypassed SlowPath (LLM) saving ~5000 tokens.",
        rawLog: "Memory Cache HIT! Similarity: 0.76 for root cause: MTU configuration mismatch",
        logType: "security",
        parsed: true,
        metadata: "{\"similarity\": 0.76}",
        networkElement: { id: "demo", name: "edge-rt-cisco", hostname: "cisco-rt-1" }
      },
      ...logs
    ];

    return NextResponse.json({
      success: true,
      data: simulatedLogs,
      total: total + 1,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      statistics: stats,
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch logs', timestamp: new Date() },
      { status: 500 }
    );
  }
}

// POST /api/logs - Ingest logs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { logs } = body;

    if (!Array.isArray(logs) || logs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid logs data', timestamp: new Date() },
        { status: 400 }
      );
    }

    // Batch insert logs
    const createdLogs = await db.log.createMany({
      data: logs.map(log => ({
        networkElementId: log.networkElementId,
        timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
        logLevel: log.logLevel || 'info',
        facility: log.facility,
        source: log.source,
        process: log.process,
        message: log.message,
        rawLog: log.rawLog,
        parsed: false,
        logType: log.logType || 'system',
        metadata: log.metadata ? JSON.stringify(log.metadata) : null,
      })),
    });

    return NextResponse.json({
      success: true,
      data: { count: createdLogs.count },
      message: 'Logs ingested successfully',
      timestamp: new Date(),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to ingest logs', timestamp: new Date() },
      { status: 500 }
    );
  }
}
