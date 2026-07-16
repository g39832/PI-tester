import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { getSqlite } from '@dds/database';

interface ReportData {
  deviceId: string;
  deviceName: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  healthScore: number;
  overallStatus: string;
  tests: Array<{
    label: string;
    status: string;
    health: string;
    details: string;
  }>;
}

export const reportsService = {
  async generateDiagnosticReport(deviceId: string): Promise<Uint8Array> {
    const data = await loadReportData(deviceId);
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([612, 792]);
    let y = 750;

    const drawHeader = () => {
      page.drawText('DispoScan Diagnostic Report', {
        x: 50, y: 770, size: 20, font: boldFont, color: rgb(0, 0, 0),
      });
      page.drawText(`Device: ${data.manufacturer} ${data.model}`, {
        x: 50, y: 740, size: 12, font, color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText(`Serial: ${data.serialNumber}`, {
        x: 50, y: 725, size: 12, font, color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText(`Health Score: ${data.healthScore}/100 (${data.overallStatus})`, {
        x: 50, y: 710, size: 14, font: boldFont,
        color: data.healthScore >= 70 ? rgb(0, 0.5, 0) : rgb(0.7, 0, 0),
      });
      y = 680;
    };

    drawHeader();

    for (const test of data.tests) {
      if (y < 60) {
        page = pdfDoc.addPage([612, 792]);
        drawHeader();
      }

      const statusColor = test.status === 'completed' ? rgb(0, 0.5, 0)
        : test.status === 'warning' ? rgb(0.7, 0.5, 0)
        : test.status === 'error' ? rgb(0.7, 0, 0)
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

    return pdfDoc.save();
  },
};

async function loadReportData(deviceId: string): Promise<ReportData> {
  const db = getSqlite();
  const device = db.prepare('SELECT id, device_name, manufacturer, model, serial_number, health_score, overall_status FROM devices WHERE id = ?').get(deviceId) as any;
  if (!device) throw new Error(`Device not found: ${deviceId}`);

  const tests = db.prepare('SELECT label, status, health, details FROM test_results WHERE device_id = ? ORDER BY id').all(deviceId) as any[];

  return {
    deviceId: device.id,
    deviceName: device.device_name,
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: device.serial_number,
    healthScore: device.health_score,
    overallStatus: device.overall_status,
    tests: tests.map((t: any) => ({
      label: t.label,
      status: t.status,
      health: t.health,
      details: t.details || '',
    })),
  };
}
