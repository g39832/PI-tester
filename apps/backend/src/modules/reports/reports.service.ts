import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getSqlite } from '@dds/database';

interface ReportInput {
  manufacturer: string;
  model: string;
  serialNumber?: string;
  healthScore?: number;
  overallStatus?: string;
  tests?: Array<{
    label: string;
    status: string;
    health: string;
    details?: string;
  }>;
}

async function buildPdf(input: ReportInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([612, 792]);
  let y = 750;

  const drawHeader = () => {
    page.drawText('DispoScan Diagnostic Report', {
      x: 50, y: 770, size: 20, font: boldFont, color: rgb(0, 0, 0),
    });
    page.drawText(`Device: ${input.manufacturer} ${input.model}`, {
      x: 50, y: 740, size: 12, font, color: rgb(0.2, 0.2, 0.2),
    });
    if (input.serialNumber) {
      page.drawText(`Serial: ${input.serialNumber}`, {
        x: 50, y: 725, size: 12, font, color: rgb(0.2, 0.2, 0.2),
      });
    }
    if (input.healthScore !== undefined) {
      const score = input.healthScore;
      page.drawText(`Health Score: ${score}/100 (${input.overallStatus || 'N/A'})`, {
        x: 50, y: 710, size: 14, font: boldFont,
        color: score >= 70 ? rgb(0, 0.5, 0) : rgb(0.7, 0, 0),
      });
    }
    y = 680;
  };

  drawHeader();

  if (input.tests) {
    for (const test of input.tests) {
      if (y < 60) {
        page = pdfDoc.addPage([612, 792]);
        drawHeader();
      }

      const statusColor = test.status === 'complete' || test.status === 'completed' ? rgb(0, 0.5, 0)
        : test.status === 'warning' ? rgb(0.7, 0.5, 0)
        : test.status === 'error' ? rgb(0.7, 0, 0)
        : test.status === 'critical' ? rgb(0.7, 0, 0)
        : rgb(0.5, 0.5, 0.5);

      page.drawText(test.label, { x: 50, y, size: 11, font: boldFont });
      page.drawText(`${test.status} — ${test.health}`, {
        x: 300, y, size: 10, font, color: statusColor,
      });
      y -= 15;

      if (test.details) {
        page.drawText(test.details, { x: 60, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
        y -= 14;
      }
      y -= 6;
    }
  }

  return pdfDoc.save();
}

export async function generatePdfReport(input: ReportInput): Promise<Uint8Array> {
  return buildPdf(input);
}

export const reportsService = {
  async generateDiagnosticReport(deviceId: string): Promise<Uint8Array> {
    const db = getSqlite();

    const deviceStmt = db.prepare('SELECT id, device_name, manufacturer, model, serial_number FROM devices WHERE id = ?');
    deviceStmt.bind([deviceId]);
    if (!deviceStmt.step()) {
      deviceStmt.free();
      throw new Error(`Device not found: ${deviceId}`);
    }
    const device = deviceStmt.getAsObject() as Record<string, unknown>;
    deviceStmt.free();

    const sessionStmt = db.prepare('SELECT health_score, overall_status FROM diagnostic_sessions WHERE device_id = ? ORDER BY created_at DESC LIMIT 1');
    sessionStmt.bind([deviceId]);
    const hasSession = sessionStmt.step();
    const session = hasSession ? sessionStmt.getAsObject() as Record<string, unknown> : null;
    sessionStmt.free();

    const testStmt = db.prepare(
      'SELECT tr.label, tr.status, tr.health, tr.data FROM test_results tr ' +
      'INNER JOIN diagnostic_sessions ds ON ds.id = tr.session_id ' +
      'WHERE ds.device_id = ? ORDER BY tr.id'
    );
    testStmt.bind([deviceId]);
    const tests: ReportInput['tests'] = [];
    while (testStmt.step()) {
      const row = testStmt.getAsObject() as Record<string, unknown>;
      tests.push({
        label: String(row.label || ''),
        status: String(row.status || ''),
        health: String(row.health || ''),
        details: row.data ? String(row.data) : undefined,
      });
    }
    testStmt.free();

    return buildPdf({
      manufacturer: String(device.manufacturer || ''),
      model: String(device.model || ''),
      serialNumber: device.serial_number ? String(device.serial_number) : undefined,
      healthScore: session ? Number(session.health_score) : undefined,
      overallStatus: session ? String(session.overall_status) : undefined,
      tests,
    });
  },
};
