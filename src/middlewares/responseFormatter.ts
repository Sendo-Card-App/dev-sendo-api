import { Request, Response, NextFunction } from 'express';

const responseFormatter = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.json;
  
  res.json = function(body) {
    const formattedBody = {
      status: res.statusCode,
      message: body.message || 'Success',
      data: body.data || body
    };
    return originalSend.call(this, formattedBody);
  };
  
  next();
};

export default responseFormatter;
