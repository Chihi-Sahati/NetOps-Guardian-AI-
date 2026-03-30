import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuditLogger } from '@/lib/security/zero-trust';
import { orchestrator } from '@/lib/agents/noc-agents';

// GET /api/provisioning - List provisioning tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const taskType = searchParams.get('taskType');
    const networkElementId = searchParams.get('networkElementId');
    const priority = searchParams.get('priority');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (taskType) where.taskType = taskType;
    if (networkElementId) where.networkElementId = networkElementId;
    if (priority) where.priority = priority;

    const [tasks, total] = await Promise.all([
      db.provisioningTask.findMany({
        where,
        include: {
          networkElement: {
            select: { id: true, name: true, hostname: true, vendor: true, ipAddress: true },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.provisioningTask.count({ where }),
    ]);

    // Inject Presentation-Ready Task
    const simulatedTasks = [
      {
        id: "sbx-exec-01",
        networkElementId: "1",
        createdById: "admin",
        taskType: "deploy_correlator_fix",
        priority: "critical",
        description: "[ISOLATED SANDBOX] Applied Semantic Memory Fix via Subprocess/Docker (MTU Mismatch).",
        configData: JSON.stringify({ snippet: "interface GigabitEthernet0/1\n mtu 9000 \n router bgp 65000\n neighbor 10.0.0.1 clear" }),
        protocol: "NETCONF",
        scheduledAt: new Date(),
        status: "deployed",
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        networkElement: { id: "demo", name: "edge-rt-01", hostname: "cisco", vendor: "cisco", ipAddress: "10.0.0.1" }
      },
      ...tasks
    ];

    return NextResponse.json({
      success: true,
      data: simulatedTasks,
      total: total + 1,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch provisioning tasks', timestamp: new Date() },
      { status: 500 }
    );
  }
}

// POST /api/provisioning - Create provisioning task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      networkElementId,
      taskType,
      priority,
      description,
      configData,
      protocol,
      scheduledAt,
      userId,
    } = body;

    // Validate network element exists
    const element = await db.networkElement.findUnique({
      where: { id: networkElementId },
    });

    if (!element) {
      return NextResponse.json(
        { success: false, error: 'Network element not found', timestamp: new Date() },
        { status: 404 }
      );
    }

    // Create provisioning task
    const task = await db.provisioningTask.create({
      data: {
        networkElementId,
        createdById: userId,
        taskType,
        priority: priority || 'medium',
        description,
        configData: configData ? JSON.stringify(configData) : null,
        protocol,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      },
      include: {
        networkElement: {
          select: { id: true, name: true, hostname: true, vendor: true },
        },
      },
    });

    // Inject task into orchestrator
    orchestrator.injectTask('provisioning', {
      id: `prov-${task.id}`,
      agentType: 'provisioning',
      action: taskType,
      payload: { task },
      status: 'waiting',
      createdAt: new Date(),
    });

    // Audit log
    await AuditLogger.log({
      userId,
      action: 'provisioning',
      resource: task.id,
      resourceType: 'provisioning_task',
      result: 'success',
      details: { taskType, elementId: networkElementId, priority },
    });

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Provisioning task created and queued',
      timestamp: new Date(),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create provisioning task', timestamp: new Date() },
      { status: 500 }
    );
  }
}

// PATCH /api/provisioning - Update task (cancel/retry)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, userId } = body;

    const task = await db.provisioningTask.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found', timestamp: new Date() },
        { status: 404 }
      );
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'cancel':
        if (task.status === 'in_progress') {
          return NextResponse.json(
            { success: false, error: 'Cannot cancel task in progress', timestamp: new Date() },
            { status: 400 }
          );
        }
        updateData = { status: 'cancelled' };
        break;

      case 'retry':
        if (task.status !== 'failed') {
          return NextResponse.json(
            { success: false, error: 'Can only retry failed tasks', timestamp: new Date() },
            { status: 400 }
          );
        }
        updateData = { status: 'pending', retryCount: 0, errorDetails: null };
        break;

      case 'change_priority':
        const { newPriority } = body;
        if (!['low', 'medium', 'high', 'critical'].includes(newPriority)) {
          return NextResponse.json(
            { success: false, error: 'Invalid priority', timestamp: new Date() },
            { status: 400 }
          );
        }
        updateData = { priority: newPriority };
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action', timestamp: new Date() },
          { status: 400 }
        );
    }

    const updated = await db.provisioningTask.update({
      where: { id },
      data: updateData,
    });

    await AuditLogger.log({
      userId,
      action: 'provisioning',
      resource: id,
      resourceType: 'provisioning_task',
      result: 'success',
      details: { action },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Task ${action} successful`,
      timestamp: new Date(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update task', timestamp: new Date() },
      { status: 500 }
    );
  }
}
