import { NextRequest, NextResponse } from 'next/server';
import { IntentEngine } from '@/lib/intent/intent-engine';

export async function GET() {
  try {
    const templates = IntentEngine.getAvailableTemplates();
    return NextResponse.json({
      success: true,
      templates,
      message: 'POST with {"intent": "template_name"} or {"intent": {...custom...}} to translate',
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to get templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const intentInput = body.intent;

    if (!intentInput) {
      return NextResponse.json({ success: false, error: 'Missing "intent" field' }, { status: 400 });
    }

    const result = IntentEngine.translate(intentInput);

    return NextResponse.json({
      success: true,
      accuracy: result.accuracy,
      intent: {
        id: result.intent.id,
        name: result.intent.name,
        type: result.intent.intentType,
        description: result.intent.description,
        priority: result.intent.priority,
        vendors: result.intent.vendorScope,
      },
      requirements: result.requirements.map(r => ({
        id: r.id,
        category: r.category,
        description: r.description,
        priority: r.priority,
      })),
      allocations: result.allocations.map(a => ({
        resourceType: a.resourceType,
        amount: a.amount,
        unit: a.unit,
        vendor: a.vendor,
        allocated: a.allocated,
      })),
      validation: result.validation,
      vendorConfigs: Object.fromEntries(
        Object.entries(result.vendorConfigs).map(([vendor, configs]) => [
          vendor,
          configs.map(c => ({
            type: c.configType,
            commands: c.cliCommands,
            validation: c.validationRules,
            rollback: c.rollbackCommands,
          })),
        ])
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Translation failed';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
