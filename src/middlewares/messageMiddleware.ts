import { sendError } from "@utils/apiResponse";
import { NextFunction, Request, Response } from "express";

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
    if (
        !req.user ||
        !req.user.role ||
        (req.user.role.name === 'CUSTOMER')
    ) {
        sendError(res, 401, 'Accès refusé');
    }
    next();
};