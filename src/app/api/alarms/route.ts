import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuditLogger } from '@/lib/security/zero-trust';

// GET /api/alarms - List alarms
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const networkElementId = searchParams.get('networkElementId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (category) where.category = category;
    if (networkElementId) where.networkElementId = networkElementId;
    if (startDate || endDate) {
      where.firstSeen = {};
      if (startDate) (where.firstSeen as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.firstSeen as Record<string, Date>).lte = new Date(endDate);
    }

    const [alarms, total] = await Promise.all([
      db.alarm.findMany({
        where,
        include: {
          networkElement: {
            select: { id: true, name: true, hostname: true, ipAddress: true, vendor: true },
          },
        },
        orderBy: [{ severity: 'asc' }, { firstSeen: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.alarm.count({ where }),
    ]);

    // Calculate statistics
    const stats = await db.alarm.groupBy({
      by: ['severity', 'status'],
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      data: alarms,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      statistics: stats,
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch alarms', timestamp: new Date() },
      { status: 500 }
    );
  }
}

// POST /api/alarms - Create alarm (for testing/ingestion)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      networkElementId,
      severity,
      alarmCode,
      alarmName,
      description,
      source,
      category,
      rawMessage,
      metadata,
    } = body;

    // Check for existing alarm (deduplication)
    const existingAlarm = await db.alarm.findFirst({
      where: {
        networkElementId,
        alarmCode,
        status: 'active',
      },
    });

    if (existingAlarm) {
      // Update existing alarm (increment count and update lastSeen)
      const updated = await db.alarm.update({
        where: { id: existingAlarm.id },
        data: {
          lastSeen: new Date(),
          count: { increment: 1 },
        },
      });
      return NextResponse.json({ success: true, data: updated, timestamp: new Date() });
    }

    // Create new alarm
    const alarm = await db.alarm.create({
      data: {
        networkElementId,
        severity: severity || 'warning',
        alarmCode,
        alarmName,
        description,
        source,
        category,
        rawMessage,
        metadata: metadata ? JSON.stringify(metadata) : null,
        status: 'active',
      },
    });

    return NextResponse.json({
      success: true,
      data: alarm,
      message: 'Alarm created',
      timestamp: new Date(),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create alarm', timestamp: new Date() },
      { status: 500 }
    );
  }
}

// PATCH /api/alarms - Update alarm (acknowledge/clear)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, acknowledgedBy } = body;

    const alarm = await db.alarm.findUnique({ where: { id } });
    if (!alarm) {
      return NextResponse.json(
        { success: false, error: 'Alarm not found', timestamp: new Date() },
        { status: 404 }
      );
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'acknowledge':
        updateData = {
          status: 'acknowledged',
          acknowledgedBy,
          acknowledgedAt: new Date(),
        };
        break;
      case 'clear':
        updateData = {
          status: 'cleared',
          clearedAt: new Date(),
        };
        break;
      case 'unacknowledge':
        updateData = {
          status: 'active',
          acknowledgedBy: null,
          acknowledgedAt: null,
        };
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action', timestamp: new Date() },
          { status: 400 }
        );
    }

    const updated = await db.alarm.update({
      where: { id },
      data: updateData,
    });

    await AuditLogger.log({
      userId: acknowledgedBy,
      action: 'alarm_ack',
      resource: id,
      resourceType: 'alarm',
      result: 'success',
      details: { action, alarmCode: alarm.alarmCode },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Alarm ${action}d successfully`,
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update alarm', timestamp: new Date() },
      { status: 500 }
    );
  }
}
