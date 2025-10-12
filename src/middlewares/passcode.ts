import UserModel from "@models/user.model";
import { sendError, sendResponse } from "@utils/apiResponse";
import { NextFunction, Request, Response } from "express";


export const verifyPasscode = async (req: Request, res: Response, next: NextFunction) => {
    const passcode = req.header('X-Passcode');
    
    if (!passcode || !/^\d{4,6}$/.test(passcode)) {
        return sendResponse(res, 401, 'Erreur sur le passcode', {
            details: [
                'Passcode invalide',
                'Le passcode doit contenir 4 à 6 chiffres'
            ]
        })
    }
    
    try {

        const user = await UserModel.findByPk(req.user?.id)
        if (!user) {
            return sendResponse(res, 401, 'Utilisateur non connecté')
        }

        if (passcode !== user.passcode) {
            return sendResponse(res, 401, 'Passcode invalide');
        }

        next();
    } catch (error: any) {
        sendError(res, 401, 'Erreur de vérification du passcode', [error.message]);
    }
};

export const checkNumberConnexionFailure = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const user = await UserModel.findByPk(req.user?.id)
        if (!user) {
            return sendResponse(res, 401, 'Utilisateur non connecté')
        }

        if (user.numberFailureConnection === 3) {
            return sendResponse(res, 401, 'Compte bloqué, veuillez contacter le service client');
        }

        next();
    } catch (error: any) {
        sendError(res, 401, 'Erreur de vérification du passcode', [error.message]);
    }
};
  