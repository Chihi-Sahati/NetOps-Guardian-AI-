import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ZeroTrustMiddleware, AuditLogger } from '@/lib/security/zero-trust';

// GET /api/network-elements - List all network elements
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vendor = searchParams.get('vendor');
    const status = searchParams.get('status');
    const site = searchParams.get('site');
    const region = searchParams.get('region');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (vendor) where.vendor = vendor;
    if (status) where.status = status;
    if (site) where.site = site;
    if (region) where.region = region;

    const [elements, total] = await Promise.all([
      db.networkElement.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.networkElement.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: elements,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch network elements', timestamp: new Date() },
      { status: 500 }
    );
  }
}

// POST /api/network-elements - Create new network element
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, hostname, ipAddress, vendor, model, elementType, site, region, capabilities } = body;

    // Validate required fields
    if (!name || !hostname || !ipAddress || !vendor || !elementType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields', timestamp: new Date() },
        { status: 400 }
      );
    }

    // Check if hostname already exists
    const existing = await db.networkElement.findUnique({
      where: { hostname },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Hostname already exists', timestamp: new Date() },
        { status: 409 }
      );
    }

    const element = await db.networkElement.create({
      data: {
        name,
        hostname,
        ipAddress,
        vendor,
        model,
        elementType,
        site,
        region,
        capabilities: capabilities ? JSON.stringify(capabilities) : null,
        status: 'unknown',
      },
    });

    // Audit log
    await AuditLogger.log({
      action: 'config_change',
      resource: element.id,
      resourceType: 'network_element',
      result: 'success',
      details: { action: 'create', name, hostname, vendor },
    });

    return NextResponse.json({
      success: true,
      data: element,
      message: 'Network element created successfully',
      timestamp: new Date(),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create network element', timestamp: new Date() },
      { status: 500 }
    );
  }
}
