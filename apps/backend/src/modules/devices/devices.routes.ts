import { Router } from 'express';
import { deviceController } from './devices.controller.js';

export const deviceRouter = Router();

deviceRouter.get('/', deviceController.list);
deviceRouter.get('/stats', deviceController.stats);
deviceRouter.get('/:id', deviceController.getById);
deviceRouter.post('/', deviceController.create);
deviceRouter.put('/:id', deviceController.update);
deviceRouter.delete('/:id', deviceController.delete);
deviceRouter.post('/:id/sku', deviceController.generateSku);
