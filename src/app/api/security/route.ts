import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuditLogger, RiskAssessmentEngine } from '@/lib/security/zero-trust';

// GET /api/security/audit - Get security audit logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const result = searchParams.get('result');
    const riskLevel = searchParams.get('riskLevel');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (result) where.result = result;
    if (riskLevel) where.riskLevel = riskLevel;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) (where.timestamp as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.timestamp as Record<string, Date>).lte = new Date(endDate);
    }

    const [audits, total] = await Promise.all([
      db.securityAudit.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.securityAudit.count({ where }),
    ]);

    // Calculate risk summary
    const riskSummary = await db.securityAudit.groupBy({
      by: ['riskLevel'],
      _count: { id: true },
      where: {
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: audits,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      riskSummary,
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch security audit logs',
      timestamp: new Date(),
    }, { status: 500 });
  }
}

// POST /api/security/audit - Create audit entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      action,
      resource,
      resourceType,
      result,
      ipAddress,
      userAgent,
      details,
    } = body;

    // Calculate risk level
    const riskLevel = RiskAssessmentEngine.calculateRiskScore({
      action,
      userId,
      ipAddress,
      resourceType,
      previousFailures: 0,
      timeOfDay: new Date(),
    });

    const audit = await db.securityAudit.create({
      data: {
        userId,
        action,
        resource,
        resourceType,
        result,
        ipAddress,
        userAgent,
        details: details ? JSON.stringify(details) : null,
        riskLevel,
      },
    });

    return NextResponse.json({
      success: true,
      data: audit,
      message: 'Audit entry created',
      timestamp: new Date(),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to create audit entry',
      timestamp: new Date(),
    }, { status: 500 });
  }
}

// GET /api/security/alerts - Get security alerts
export async function PATCH(request: NextRequest) {
  try {
    const alerts = await AuditLogger.getRecentAlerts(50);
    
    return NextResponse.json({
      success: true,
      data: alerts,
      message: 'Security alerts retrieved',
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch security alerts',
      timestamp: new Date(),
    }, { status: 500 });
  }
}
