import logger from "@config/logger";
import merchantService from "@services/merchantService";
import { sendError, sendResponse } from "@utils/apiResponse";
import { Request, Response } from "express";


class MerchantController {
    async createCommission(req: Request, res: Response) {
        const { typeCommission, montantCommission, description } = req.body;
        try {
            if (!typeCommission || !montantCommission) {
                return sendError(res, 400, "Type de commission et montant de commission sont requis");
            }
            if (!req.user) {
                return sendError(res, 401, "Veuillez vous connecter pour créer une commission");
            }

            const commission = await merchantService.createCommission(
                { typeCommission, montantCommission, description }
            )

            logger.info(`Commission créée avec succès`, {
                commission: `Commission ID : ${commission.id} - Type : ${commission.typeCommission} - Montant : ${commission.montantCommission}`,
                admin: `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`
            });
            
            sendResponse(res, 201, "Commission créée avec succès", commission);
        } catch (error: any) {
            sendError(res, 500, "Erreur serveur", [error.message]);
        }
    }

    async updateCommission(req: Request, res: Response) {
        const commissionId = parseInt(req.params.id, 10);
        const { typeCommission, montantCommission, description } = req.body;
        try {
            if (!req.user) {
                return sendError(res, 401, "Veuillez vous connecter pour mettre à jour une commission");
            }
            const commission = await merchantService.updateCommission(commissionId,
                { typeCommission, montantCommission, description }
            )
            logger.info(`Commission mise à jour avec succès`, {
                commission: `Commission ID : ${commission.id} - Type : ${commission.typeCommission} - Montant : ${commission.montantCommission}`,
                admin: `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`
            });
            sendResponse(res, 200, "Commission mise à jour avec succès", commission);
        } catch (error: any) {
            sendError(res, 500, "Erreur serveur", [error.message]);
        }
    }

    async getCommission(req: Request, res: Response) {
        const commissionId = parseInt(req.params.id, 10);
        try {
            if (!commissionId) {
                sendError(res, 404, 'ID de la commission manquante')
            }
            const commission = await merchantService.findCommissionById(commissionId)

            sendResponse(res, 200, 'Commission trouvee', commission)
        } catch (error: any) {
            sendError(res, 500, "Erreur serveur", [error.message]);
        }
    }

    async getAllCommissions(req: Request, res: Response) {
        try {
            const commissions = await merchantService.getAllCommissions()
            sendResponse(res, 200, 'Commissions retournees', commissions)
        } catch (error: any) {
            sendError(res, 500, "Erreur serveur", [error.message]);
        }
    }

    async createPalier(req: Request, res: Response) {
        const { montantMin, montantMax, commissionId, description } = req.body;
        try {
            if (!montantMin || !montantMax || !commissionId) {
                return sendError(res, 400, "Montant min, montant max et commissionId sont requis");
            }
            if (!req.user) {
                return sendError(res, 401, "Veuillez vous connecter pour créer un palier");
            }
            const palier = await merchantService.createPalier(
                { montantMin, montantMax, commissionId, description }
            )
            logger.info(`Palier créé avec succès`, {
                palier: `Palier ID : ${palier.id} - Montant Min : ${palier.montantMin} - Montant Max : ${palier.montantMax} - Commission ID : ${palier.commissionId}`,
                admin: `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`
            });
            sendResponse(res, 201, "Palier créé avec succès", palier);
        } catch (error: any) {
            sendError(res, 500, "Erreur serveur", [error.message]);
        }
    }

    async updatePalier(req: Request, res: Response) {
        const palierId = parseInt(req.params.id, 10);
        const { montantMin, montantMax, commissionId, description } = req.body;
        try {
            if (!req.user) {
                return sendError(res, 401, "Veuillez vous connecter pour mettre à jour une commission");
            }
            const palier = await merchantService.updatePalier(
                palierId,
                { montantMin, montantMax, commissionId, description }
            )

            logger.info(`Palier mis a jour avec succès`, {
                palier: `Palier ID : ${palier.id} - Montant Min : ${palier.montantMin} - Montant Max : ${palier.montantMax} - Commission ID : ${palier.commissionId}`,
                admin: `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`
            });
            sendResponse(res, 200, "Palier mis à jour avec succès", palier);
        } catch (error: any) {
            sendError(res, 500, "Erreur serveur", [error.message]);
        }
    }

    async getPalier(req: Request, res: Response) {
        const palierId = parseInt(req.params.id, 10);
        try {
            if (!palierId) {
                sendError(res, 404, 'ID du palier manquant')
            }

            const palier = await merchantService.findPalierById(palierId)
            sendResponse(res, 200, 'Palier trouve', palier)
        } catch (error: any) {
            sendError(res, 500, "Erreur serveur", [error.message]);
        }
    }

    async getAllPaliers(req: Request, res: Response) {
        try {
            const paliers = await merchantService.getAllPaliers()
            sendResponse(res, 200, 'Paliers retournes', paliers)
        } catch (error: any) {
            sendError(res, 500, "Erreur serveur", [error.message]);
        }
    }
}

export default new MerchantController();