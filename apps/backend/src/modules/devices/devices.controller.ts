import { Request, Response, NextFunction } from 'express';
import { CreateDeviceSchema, UpdateDeviceSchema, DeviceSearchSchema } from '@dds/shared';
import { deviceService } from './devices.service.js';
import { sendSuccess } from '../../shared/response.js';
import { calculatePaginationMeta } from '../../shared/pagination.js';

export const deviceController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = DeviceSearchSchema.parse(req.query);
      const result = await deviceService.list(query);
      sendSuccess(res, result.devices, calculatePaginationMeta(result.total, query.page, query.limit));
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const device = await deviceService.getById(req.params.id);
      sendSuccess(res, device);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = CreateDeviceSchema.parse(req.body);
      const device = await deviceService.create(input);
      sendSuccess(res, device, undefined, 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = UpdateDeviceSchema.parse(req.body);
      const device = await deviceService.update(req.params.id, input);
      sendSuccess(res, device);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await deviceService.delete(req.params.id);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },

  async generateSku(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sku = await deviceService.generateSku(req.params.id);
      sendSuccess(res, { companySku: sku });
    } catch (err) {
      next(err);
    }
  },

  async stats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await deviceService.getStats();
      sendSuccess(res, stats);
    } catch (err) {
      next(err);
    }
  },
};
