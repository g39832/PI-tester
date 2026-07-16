import { Router } from 'express';
import { reportsService } from './reports.service.js';

export const reportRouter = Router();

reportRouter.get('/:deviceId', async (req, res, next) => {
  try {
    const pdf = await reportsService.generateDiagnosticReport(req.params.deviceId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="disposcan-report-${req.params.deviceId}.pdf"`);
    res.send(Buffer.from(pdf));
  } catch (err) {
    next(err);
  }
});
