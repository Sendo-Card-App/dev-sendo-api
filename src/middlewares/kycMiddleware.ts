import KycDocumentModel from '@models/kyc-document.model';
import MerchantModel from '@models/merchant.model';
import UserModel from '@models/user.model';
import { sendError, sendResponse } from '@utils/apiResponse';
import { Request, Response, NextFunction } from 'express';

export async function checkKYC(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return sendError(res, 401, 'Non authentifié');
    
    const user = await UserModel.findByPk(req.user.id, {
      include: [
        {
          model: KycDocumentModel,
          as: 'kycDocuments',
          where: { status: 'APPROVED' },
          required: false
        },
        {
          model: MerchantModel,
          as: 'merchant'
        }
    ]
    });

    if (!user) return sendError(res, 404, 'Utilisateur introuvable');

    const requiredDocsForIndividuals = user.country === "Cameroon" ? ['ID_PROOF', 'ID_PROOF', 'ADDRESS_PROOF', 'SELFIE'] : ['ID_PROOF', 'ID_PROOF', 'SELFIE'];
    const approvedDocs = user.kycDocuments || [];
    const hasValidID = approvedDocs.some((doc: { type: string; }) => doc.type === 'ID_PROOF');
    const hasValidSelfie = approvedDocs.some((doc: { type: string; }) => doc.type === 'SELFIE');

    if (!user.merchant) {
      const hasValidAddress = approvedDocs.some((doc: { type: string; }) => doc.type === 'ADDRESS_PROOF');
      const hasEnoughDocs = user.country === "Cameroon" ? approvedDocs.length >= 4 : approvedDocs.length === 3;
      const numberDocsRequired = user.country === "Cameroon" ? (4 - approvedDocs.length) : (3 - approvedDocs.length);
      const validAddressConditionsFalse = user.country === "Cameroon" ? !hasValidAddress : true;

      if (!hasValidID || !validAddressConditionsFalse || !hasValidSelfie || !hasEnoughDocs) {
        return sendError(res, 403, 'Documents KYC manquants', {
          required: {
            minimumDocuments: user.country === "Cameroon" ? 4 : 3,
            mandatoryTypes: requiredDocsForIndividuals
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
    } else {
      const approvedDocs = user.kycDocuments || [];
      const hasValidID = approvedDocs.some((doc: { type: string; }) => doc.type === 'ID_PROOF');
      const hasValidAddress = approvedDocs.some((doc: { type: string; }) => doc.type === 'ADDRESS_PROOF');
      const hasValidNIU = approvedDocs.some((doc: { type: string; }) => doc.type === 'NIU_PROOF');
      const hasValidRCCM = approvedDocs.some((doc: { type: string; }) => doc.type === 'RCCM');
      const hasValidArticles = approvedDocs.some((doc: { type: string; }) => doc.type === 'ARTICLES_ASSOCIATION_PROOF');
      const hasValidSelfie = approvedDocs.some((doc: { type: string; }) => doc.type === 'SELFIE');
      const hasEnoughDocs = approvedDocs.length >= 6;
      const numberDocsRequired = 6 - approvedDocs.length;

      if (
        !hasValidID ||
        !hasValidAddress || 
        !hasValidNIU || 
        !hasValidSelfie || 
        !hasValidRCCM || 
        !hasValidArticles || 
        !hasEnoughDocs
      ) {
        return sendError(res, 403, 'Documents KYC manquants', {
          required: {
            minimumDocuments: 6,
            mandatoryTypes: ['ID_PROOF', 'ADDRESS_PROOF', 'NIU_PROOF', 'SELFIE', 'RCCM', 'ARTICLES_ASSOCIATION_PROOF']
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
    }
    
    next();
  } catch (error) {
    console.error('Erreur KYC:', error);
    sendError(res, 500, 'Erreur vérification KYC');
  }
}

export async function fileCheck(req: Request, res: Response, next: NextFunction) {
  const files = req.files as Express.Multer.File[];
  const requiredDocsForIndividuals = req.user!.country === "Cameroon" ? ['ID_PROOF', 'ID_PROOF', 'ADDRESS_PROOF', 'SELFIE'] : ['ID_PROOF', 'ID_PROOF', 'SELFIE'];
  try {
    if (!files || !files.length) {
      return sendResponse(res, 400, 'Aucun fichier fourni', {
        required: {
          minimumDocuments: req.user!.country === "Cameroon" ? 4 : 3,
          mandatoryTypes: requiredDocsForIndividuals
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