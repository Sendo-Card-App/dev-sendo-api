import fundSubscriptionService from "@services/fundSubscriptionService";
import { PaginatedData } from "../types/BaseEntity";
import { Request, Response } from 'express'
import { sendError, sendResponse } from "@utils/apiResponse";

export default class FundSubscriptionController {
    static async listFundSubscriptions(req: Request, res: Response) {
        const { limit, startIndex, page } = res.locals.pagination;
        try {
            const funds = await fundSubscriptionService.getAllFunds(limit, startIndex);

            const totalPages = Math.ceil(funds.count / limit);
                              
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: funds.count,
                items: funds.rows
            };

            sendResponse(res, 200, "Fonds de souscription retournés", responseData)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    static async subscribe(req: Request, res: Response) {
        const { fundId, currency } = req.body;
        try {
            if (!req.user || !req.user.id) {
                sendError(res, 401, 'Veuillez vous connecter');
                return;
            }
            const userId = req.user.id;

            const subscription = await fundSubscriptionService.subscribe(
                userId,
                fundId,
                currency
            );

            sendResponse(res, 200, "Souscription réussie", subscription)
        } catch (error: any) {
            sendError(res, 500, 'Erreur de souscription', [error.message])
        }
    }

    static async filteredSubscriptions(req: Request, res: Response) {
        const { limit, startIndex, page, status, currency, userId } = res.locals.pagination;
        try {
            if (!req.user || !req.user.id) {
                sendError(res, 401, 'Veuillez vous connecter');
                return;
            }

            const data = await fundSubscriptionService.getAllSubscriptions(
                limit, 
                startIndex,
                status,
                userId,
                currency
            );

            const totalPages = Math.ceil(data.count / limit);
                              
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: data.count,
                items: data.rows
            };

            sendResponse(res, 200, "Souscriptions récupérées", responseData)
        } catch (error: any) {
            sendError(res, 500, 'Erreur de récupération', [error.message])
        }
    }

    static async request(req: Request, res: Response) {
        const { subscriptionId, type } = req.body;
        try {
            if (!req.user || !req.user.id) {
                sendError(res, 401, 'Veuillez vous connecter');
                return;
            }
            const userId = req.user.id;

            const request = await fundSubscriptionService.requestWithdrawal(
                userId,
                subscriptionId,
                type
            );

            sendResponse(res, 201, "Demande envoyée", request)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    static async filteredRequestsWithdrawal(req: Request, res: Response) {
        const { limit, startIndex, page, status, userId } = res.locals.pagination;
        try {
            if (!req.user || !req.user.id) {
                sendError(res, 401, 'Veuillez vous connecter');
                return;
            }

            const data = await fundSubscriptionService.listRequestWithdrawal(
                limit, 
                startIndex,
                status,
                userId
            );

            const totalPages = Math.ceil(data.count / limit);
                              
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: data.count,
                items: data.rows
            };

            sendResponse(res, 200, "Demandes de retrait récupérées", responseData)
        } catch (error: any) {
            sendError(res, 500, 'Erreur de récupération', [error.message])
        }
    }

    static async process(req: Request, res: Response) {
        const { requestId, action } = req.body;

        try {
            if (!req.user || !req.user.id) {
                sendError(res, 401, 'Veuillez vous connecter');
                return;
            }
            const adminId = req.user.id;

            const result = await fundSubscriptionService.processRequest(
                requestId,
                action,
                adminId
            );

            sendResponse(res, 200, "Traitement effectué", result)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }
}