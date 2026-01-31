import requestService, { RequestCreate, UpdateStatusRequest } from "@services/requestService";
import { PaginatedData } from "../types/BaseEntity";
import { sendError, sendResponse } from "@utils/apiResponse";
import { typesConfig, typesCurrency, typesDemande, TypesDemande, typesMethodTransaction, TypesStatusDemande, typesStatusDemande, typesStatusTransaction, typesTransaction } from "@utils/constants";
import { Request, Response } from "express";
import transactionService from "@services/transactionService";
import { TransactionCreate } from "../types/Transaction";
import configService from "@services/configService";
import { getLibelleRequest, getLibelleStatutRequest } from "@utils/functions";
import { sendEmailWithAttachments, sendGlobalEmail } from "@services/emailService";
import logger from "@config/logger";
import mobileMoneyService from "@services/mobileMoneyService";


class RequestController {
    async askRequest(req: Request, res: Response) {
        const { type, description } = req.body
        
        try {
            if (!req.user) throw new Error('Utilisateur non authentifié');
            if (!type) sendError(res, 400, "Veuillez fournir le type de demande");

            const file = req.file as Express.Multer.File;
            if (!file) throw new Error('Aucun document fourni');

            const config = await configService.getConfigByName('NIU_REQUEST_FEES')
            if (!config) throw new Error('Configuration introuvable');

            let totalAmount: number | null = null;
            if (req.user.country === "Cameroon") {
                totalAmount = Number(config.value);
            } else {
                const currencyConfig = await configService.getConfigByName('CAD_SENDO_VALUE');
                if (!currencyConfig) throw new Error('Configuration de devise introuvable');
                totalAmount = Number(config.value) / Number(currencyConfig.value);
            }

            const body: RequestCreate = {
                type: type as TypesDemande,
                userId: req.user.id,
                description,
                status: typesStatusDemande['1'],
                url: file.path
            }
            const request = await requestService.askRequest(body, totalAmount)

            if (request.type === typesDemande['0']) {  
                const transaction: TransactionCreate = {
                    userId: req.user!.id,
                    type: typesTransaction['3'],
                    amount: 0,
                    status: typesStatusTransaction['1'],
                    currency: req.user.country === "Cameroon" ? 'XAF' : 'CAD',
                    totalAmount,
                    description: "Demande de NIU",
                    receiverId: req.user!.id,
                    receiverType: 'User',
                    method: typesMethodTransaction['3'],
                    provider: typesMethodTransaction['3'],
                    sendoFees: Number(config.value)
                }
                await transactionService.createTransaction(transaction)

                // On envoie le gain si nécessaire
                await mobileMoneyService.sendGiftForReferralCode(req.user)
            }

            logger.info("Demande créée", {
                request: `${getLibelleRequest(request.type)} - ${getLibelleStatutRequest(request.type, request.status)}`,
                user: `${request.user?.firstname} ${request.user?.lastname}`
            });

            sendResponse(res, 201, 'Demande enregistrée avec succès', request)
        } catch (error: any) {
            sendError(res, 500, "Erreur lors de l'envoi de la demande", [error.message]);
        }
    }

    async listRequests(req: Request, res: Response) {
        const { page, limit, startIndex, status, type } = res.locals.pagination;
        try {
            const requests = await requestService.listRequest(
                limit, startIndex, status, type
            )
            const totalPages = Math.ceil(requests.count / limit);
                  
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: requests.count,
                items: requests.rows,
            };
    
            sendResponse(res, 200, 'Demandes récupérées', responseData);
        } catch (error: any) {
            sendError(res, 500, "Erreur lors de la récupération des demandes", [error.message]);
        }
    }

    async updateStatusRequest(req: Request, res: Response) {
        const { id } = req.params
        const { status, reason } = req.body
        try {
            //const file = req.file as Express.Multer.File;
            //if (!id || !status) throw new Error('Veuillez fournir tous les paramètres')
            if (!req.user) throw new Error('Utilisateur non authentifié');

            const update: UpdateStatusRequest = {
                status: status as TypesStatusDemande,
                reviewedById: req.user.id
            }
            /*if (update.status === typesStatusDemande['0']) {
                if (!file) throw new Error('Aucun document fourni');
            }*/

            const request = await requestService.updateStatusRequest(
                parseInt(id), 
                update,
                undefined,
                reason ? reason : undefined
            )
            
            logger.info("Status de la demande mis à jour", {
                request: `${getLibelleRequest(request.type)} - ${getLibelleStatutRequest(request.type, request.status)}`,
                user: `${request.user?.firstname} ${request.user?.lastname}`
            });

            if (request && request.user) {
                await sendGlobalEmail(
                    request.user.email,
                    'Réponse à votre demande de NIU',
                    `<h4>Voici le nouveau status de votre demande :</h4>
                    <p>Demande :</p> <b>${getLibelleRequest(request.type)}</b>
                    <p>Status :</p> <b>${getLibelleStatutRequest(request.type, request.status)}</b>
                    <p>Raison :</p> <b>${request.reason ? request.reason : 'Aucune raison fournie'}</b>`
                )

                if (request.type === typesDemande['0'] && request.status === typesStatusDemande['0']) {
                    //if (!request.url) throw new Error('URL du fichier manquante');

                    // Envoyer l'email avec la pièce jointe locale
                    await sendEmailWithAttachments(
                        request.user.email,
                        'Réponse à la demande',
                        `<h4>Votre demande a été traitée avec succès. Voici les détails :</h4>
                        <p>Demande :</p> <b>${getLibelleRequest(request.type)}</b>
                        <p>Status :</p> <b>${getLibelleStatutRequest(request.type, request.status)}</b>`,
                    );
                }
            }

            sendResponse(res, 200, 'Status de la demande mis à jour', true)
        } catch (error: any) {
            sendError(res, 500, "Erreur lors de la traitement de la requête", [error.message]);
        }
    }

    async listRequestUser(req: Request, res: Response) {
        const { page, limit, startIndex, status, type } = res.locals.pagination;
        const { id } = req.params
        try {
            if (!id) throw new Error('Veuillez fournir l\'identifiant de l\'utilisateur');
            const requests = await requestService.listRequestUser(
                limit,
                startIndex,
                status,
                type,
                parseInt(id)
            )

            const totalPages = Math.ceil(requests.count / limit);
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: requests.count,
                items: requests.rows
            };

            sendResponse(res, 200, 'Demandes retournées avec succès', responseData)
        } catch (error: any) {
            sendError(res, 500, "Erreur lors de la récupération des demandes", [error.message]);
        }
    }
}

export default new RequestController();