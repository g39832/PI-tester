import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getSqlite } from '@dds/database';

interface DeviceInfo {
  id: string;
  device_name: string | null;
  manufacturer: string;
  model: string;
  serial_number: string | null;
}

interface SessionInfo {
  health_score: number | null;
  overall_status: string | null;
}

interface TestResultInfo {
  label: string;
  status: string;
  health: string;
  data: string | null;
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
    const device = deviceStmt.getAsObject() as unknown as DeviceInfo;
    deviceStmt.free();

    const sessionStmt = db.prepare('SELECT health_score, overall_status FROM diagnostic_sessions WHERE device_id = ? ORDER BY created_at DESC LIMIT 1');
    sessionStmt.bind([deviceId]);
    const session: SessionInfo = sessionStmt.step()
      ? sessionStmt.getAsObject() as unknown as SessionInfo
      : { health_score: null, overall_status: null };
    sessionStmt.free();

    const testStmt = db.prepare(
      'SELECT tr.label, tr.status, tr.health, tr.data FROM test_results tr ' +
      'INNER JOIN diagnostic_sessions ds ON ds.id = tr.session_id ' +
      'WHERE ds.device_id = ? ORDER BY tr.id'
    );
    testStmt.bind([deviceId]);
    const tests: TestResultInfo[] = [];
    while (testStmt.step()) {
      tests.push(testStmt.getAsObject() as unknown as TestResultInfo);
    }
    testStmt.free();

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([612, 792]);
    let y = 750;

    const drawHeader = () => {
      page.drawText('DispoScan Diagnostic Report', {
        x: 50, y: 770, size: 20, font: boldFont, color: rgb(0, 0, 0),
      });
      page.drawText(`Device: ${device.manufacturer} ${device.model}`, {
        x: 50, y: 740, size: 12, font, color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText(`Serial: ${device.serial_number || 'N/A'}`, {
        x: 50, y: 725, size: 12, font, color: rgb(0.2, 0.2, 0.2),
      });
      const score = session.health_score ?? 0;
      page.drawText(`Health Score: ${score}/100 (${session.overall_status || 'N/A'})`, {
        x: 50, y: 710, size: 14, font: boldFont,
        color: score >= 70 ? rgb(0, 0.5, 0) : rgb(0.7, 0, 0),
      });
      y = 680;
    };

    drawHeader();

    for (const test of tests) {
      if (y < 60) {
        page = pdfDoc.addPage([612, 792]);
        drawHeader();
      }

      const statusColor = test.status === 'complete' ? rgb(0, 0.5, 0)
        : test.status === 'warning' ? rgb(0.7, 0.5, 0)
        : test.status === 'error' ? rgb(0.7, 0, 0)
        : rgb(0.5, 0.5, 0.5);

      page.drawText(test.label, { x: 50, y, size: 11, font: boldFont });
      page.drawText(`${test.status} — ${test.health}`, {
        x: 300, y, size: 10, font, color: statusColor,
      });
      y -= 15;

      if (test.data) {
        page.drawText(test.data, { x: 60, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
        y -= 14;
      }
      y -= 6;
    }

    return pdfDoc.save();
  },
};
