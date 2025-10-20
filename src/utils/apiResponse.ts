import logger from '@config/logger';
import { Response } from 'express';
import { getSmobilpayErrorMessage } from './smobilpayErrors';

interface ApiResponse {
  status: number;
  message: string;
  data?: Record<string, unknown>;
}

interface ErrorResponse extends ApiResponse {
  data?: {
    errors?: string[];
    details?: Record<string, unknown>;
  };
}

export const sendResponse = (
  res: Response,
  status: number,
  message: string,
  data: any | null = null
): void => {
  const response: ApiResponse = { status, message };
  if (data !== null) response.data = data;
  res.status(status).json(response);
};

export const sendError = (
  res: Response,
  status: number,
  message: string,
  errors: string[] | Record<string, unknown> = []
): void => {
  const response: ErrorResponse = { status, message };
  
  // Cas tableau de strings
  if (Array.isArray(errors)) {
    logger.error(message, { errors });
    if (errors.length > 0) {
      response.data = { errors };
    }
  } else {
    logger.error(message, { details: errors });
    response.data = { details: errors };
  }

  res.status(status).json(response);
};

// Gestion des erreurs API Smobilpay
export interface ApiErrorResponse {
  devMsg: string;
  usrMsg: string;
  respCode: number;
  link: string;
}

export const sendApiErrorSmobilpay = (
  res: Response,
  httpStatus: number,
  error: ApiErrorResponse
): void => {
  logger.error(`[API ERROR] Code: ${error.respCode} - DevMsg: ${error.devMsg}`);
  res.status(httpStatus).json(error);
};

// Gestion des erreurs paiement Smobilpay
export interface PaymentErrorResponse {
  timestamp: string;
  trid: string;
  errorCode: string | number;
  status: 'ERRORED' | 'SUCCESS' | string;
  [key: string]: any; // autres données possibles
}

export const handlePaymentResponse = (
  res: Response,
  paymentResp: PaymentErrorResponse
): void => {
  if (paymentResp.status === 'ERRORED') {
    const message = getSmobilpayErrorMessage(paymentResp.errorCode);
    logger.error(`[PAYMENT ERROR] TransactionID: ${paymentResp.trid} - Code: ${paymentResp.errorCode} - Timestamp: ${paymentResp.timestamp}`);

    res.status(409).json({
      code: paymentResp.errorCode,
      message,
      transactionId: paymentResp.trid,
      timestamp: paymentResp.timestamp,
    });
  } else {
    // Succès : on utilise sendResponse en envoyant directement l'objet data reçu
    // Ici on suppose que paymentResp contient les données utiles à retourner
    sendResponse(res, 200, 'Transaction réussie', paymentResp);
  }
}

export interface NeeroApiError {
  code: string;
  title: string;
  detail: any;
  fieldErrors: any;
}