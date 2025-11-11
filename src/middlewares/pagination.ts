import { Request, Response, NextFunction } from 'express';

export const paginationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  let page = parseInt(req.query.page as string, 10);
  let limit = parseInt(req.query.limit as string, 10);

  // Validation stricte des valeurs numériques
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;

  const startIndex = (page - 1) * limit;

  // Validation simple des dates (optionnelle, selon besoin)
  const startDateRaw = req.query.startDate as string;
  const endDateRaw = req.query.endDate as string;
  const startDate = startDateRaw && !isNaN(Date.parse(startDateRaw)) ? startDateRaw : undefined;
  const endDate = endDateRaw && !isNaN(Date.parse(endDateRaw)) ? endDateRaw : undefined;

  // Autres paramètres (type, status, method) laissés tels quels, mais vous pouvez aussi valider
  const type = req.query.type as string | undefined;
  const typeAccount = req.query.typeAccount as 'MERCHANT' | 'CUSTOMER' | undefined;
  const status = req.query.status as string | undefined;
  const method = req.query.method as string | undefined;
  const search = req.query.search as string | undefined;
  const code = req.query.code as string | undefined;

  const country = req.query.country as string | undefined;
  const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;
  const idCard = req.query.idCard ? parseInt(req.query.idCard as string, 10) : undefined;
  const idMerchant = req.query.idMerchant ? parseInt(req.query.idMerchant as string, 10) : undefined;

  res.locals.pagination = { 
    page, 
    limit, 
    startIndex, 
    type, 
    typeAccount,
    status,
    method,
    startDate,
    endDate,
    userId,
    idCard,
    country,
    search,
    code,
    idMerchant
  };

  next();
};