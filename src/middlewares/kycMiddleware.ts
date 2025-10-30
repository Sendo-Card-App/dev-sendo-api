import KycDocumentModel from '@models/kyc-document.model';
import UserModel from '@models/user.model';
import { sendError, sendResponse } from '@utils/apiResponse';
import { Request, Response, NextFunction } from 'express';
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

export async function checkKYC(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, 401, 'Non authentifié');
    
    const cacheKey = `userKyc:${req.user.id}`;
    const cachedUser = await redisClient.get(cacheKey);
    let user;

    if (cachedUser) {
      user = JSON.parse(cachedUser);
    } else {
      user = await UserModel.findByPk(req.user.id, {
        include: [{
          model: KycDocumentModel,
          as: 'kycDocuments',
          where: { status: 'APPROVED' },
          required: false
        }]
      });

      if (user) {
        await redisClient.set(cacheKey, JSON.stringify(user), { EX: REDIS_TTL });
      }
    }

    if (!user) return sendError(res, 404, 'Utilisateur introuvable');

    const approvedDocs = user.kycDocuments || [];
    const hasValidID = approvedDocs.some((doc: { type: string; }) => doc.type === 'ID_PROOF');
    const hasValidAddress = approvedDocs.some((doc: { type: string; }) => doc.type === 'ADDRESS_PROOF');
    const hasValidNIU = approvedDocs.some((doc: { type: string; }) => doc.type === 'NIU_PROOF');
    const hasValidSelfie = approvedDocs.some((doc: { type: string; }) => doc.type === 'SELFIE');
    const hasEnoughDocs = approvedDocs.length === 5;
    const numberDocsRequired = 5 - approvedDocs.length;

    if (!hasValidID || !hasValidAddress || !hasValidNIU || !hasValidSelfie || !hasEnoughDocs) {
      return sendError(res, 403, 'Documents KYC manquants', {
        required: {
          minimumDocuments: 5,
          mandatoryTypes: ['ID_PROOF', 'ID_PROOF', 'ADDRESS_PROOF', 'NIU_PROOF', 'SELFIE']
        },
        currentStatus: {
          documents: approvedDocs.map((d: any) => d.type),
          isValid: false
        }
      });
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (files && (files.length !== numberDocsRequired)) {
      return sendError(res, 403, 'Des documents en plus veulent être envoyés', {
        required: {
          documents: numberDocsRequired
        },
        currentStatus: {
          documents: approvedDocs.map((d: any) => d.type),
          isValid: false
        }
      });
    }

    req.user.kycStatus = {
      verified: true,
      lastDocumentDate: approvedDocs[approvedDocs.length - 1]?.updatedAt
    };

    next();
  } catch (error) {
    console.error('Erreur KYC:', error);
    sendError(res, 500, 'Erreur vérification KYC');
  }
}

export async function fileCheck(req: Request, res: Response, next: NextFunction) {
  const files = req.files as Express.Multer.File[];
  try {
    if (!files || !files.length) {
      return sendResponse(res, 400, 'Aucun fichier fourni', {
        required: {
          minimumDocuments: 5,
          mandatoryTypes: ['ID_PROOF', 'ID_PROOF', 'ADDRESS_PROOF', 'NIU_PROOF', 'SELFIE']
        }
      });
    }
    next();
  } catch (error: any) {
    console.error('Erreur dans le middleware de vérification de fichier:', error);
    sendError(res, 500, 'Erreur serveur', [error.message]);
  }
};

export async function filePictureCheck(req: Request, res: Response, next: NextFunction) {
  const file = req.file as Express.Multer.File;
  try {
    if (!file) {
      return sendResponse(res, 400, 'Aucun fichier fourni');
    }
    next();
  } catch (error: any) {
    console.error('Erreur dans le middleware de vérification de fichier:', error);
    sendError(res, 500, 'Erreur serveur', [error.message]);
  }
};