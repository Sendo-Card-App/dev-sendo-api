import { verifyToken } from "@config/jwt";
import { RoleModel, TokenModel, UserModel, WalletModel } from "@models/index.model";
import { sendError, sendResponse } from "@utils/apiResponse";
import { typesToken } from "@utils/constants";
import { Request, Response, NextFunction } from 'express';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return sendResponse(res, 401, 'Authentification requise');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token) as { id: number, deviceId: string };
    
    // Vérification du token en base avec jointure utilisateur
    const tokenEntry = await TokenModel.findOne({
      where: { 
        userId: decoded.id,
        deviceId: decoded.deviceId,
        tokenType: typesToken['0']
      },
      include: [{
        model: UserModel,
        as: 'user',
        include: [
          { 
            model: WalletModel, 
            as: 'wallet' 
          },
          {
            model: RoleModel,
            as: 'roles',
            attributes: ['id', 'name'],
            through: { attributes: [] }
          }
        ],
        required: true
      }]
    });

    // Vérifications combinées
    if (!tokenEntry?.user) {
      return sendResponse(res, 401, 'Session invalide');
    }

    // Vérification du statut du compte
    if (!tokenEntry.user.isVerifiedEmail) {
      return sendError(
        res, 
        403, 
        'Compte non vérifié. Veuillez vérifier votre email pour activer votre compte.'
      );
    }

    if (tokenEntry.user.status !== 'ACTIVE') {
      return sendError(res, 403, 'Compte suspendu ou bloqué');
    }
    
    // Attachement des informations à la requête
    req.user = tokenEntry.user;
    req.deviceId = decoded.deviceId;
    
    next();
  } catch (error: any) {
    sendError(res, 401, 'Token invalide', [error.message]);
  }
}