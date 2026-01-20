import { Request, Response } from "express";
import { tankSizeService } from "../services/tankSize";
import { ApiError } from "../utils/ApiError";

export const tankSizeController = {
  async getAllTankSizes(req: Request, res: Response) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const tankSizes = await tankSizeService.getAllTankSizes(includeInactive);
      res.json(tankSizes);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async createTankSize(req: Request, res: Response) {
    try {
      const tankSize = await tankSizeService.createTankSize(req.body);
      res.status(201).json(tankSize);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async updateTankSize(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tankSize = await tankSizeService.updateTankSize(id, req.body);
      res.json(tankSize);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  async deleteTankSize(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await tankSizeService.deleteTankSize(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
}; 