import { Router } from 'express';
import multer from 'multer';
import { attachmentService } from './attachments.service.js';
import { sendSuccess } from '../../shared/response.js';
import { NotFoundError } from '../../shared/errors.js';

export const attachmentRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Upload attachment for a device
attachmentRouter.post('/device/:deviceId', upload.single('file'), (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const sessionId = (req.query.sessionId as string) ?? null;
    const description = (req.body.description as string) ?? null;

    if (!req.file) {
      res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } });
      return;
    }

    const attachment = attachmentService.upload(
      deviceId,
      sessionId,
      req.file.originalname,
      req.file.mimetype,
      req.file.buffer,
      description,
    );

    sendSuccess(res, attachment, undefined, 201);
  } catch (err) {
    next(err);
  }
});

// List attachments for a device
attachmentRouter.get('/device/:deviceId', (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const attachments = attachmentService.listByDevice(deviceId);
    sendSuccess(res, attachments);
  } catch (err) {
    next(err);
  }
});

// Download attachment
attachmentRouter.get('/:id/download', (req, res, next) => {
  try {
    const attachment = attachmentService.findById(req.params.id);
    if (!attachment) throw new NotFoundError('Attachment', req.params.id);

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    res.setHeader('Content-Length', attachment.sizeBytes);
    res.sendFile(attachment.storagePath);
  } catch (err) {
    next(err);
  }
});

// Delete attachment
attachmentRouter.delete('/:id', (req, res, next) => {
  try {
    const deleted = attachmentService.delete(req.params.id);
    if (!deleted) throw new NotFoundError('Attachment', req.params.id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});
