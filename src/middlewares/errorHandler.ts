import { Request, Response, NextFunction } from 'express';
import { sendError } from '@utils/apiResponse';

export default (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err.name === 'ValidationError') {
    return sendError(res, 400, 'Erreur de validation', [err.message]);
  }
  if (err.name === 'UnauthorizedError') {
    return sendError(res, 401, 'Non autorisé', [err.message]);
  }
  if (err.name === 'NotFoundError') {
    return sendError(res, 404, 'Non trouvé', [err.message]);
  }
  if (err.name === 'ForbiddenError') {
    return sendError(res, 403, 'Interdit', [err.message]);
  }  
  
  sendError(res, 500, 'Erreur serveur', [err.message]);
};
