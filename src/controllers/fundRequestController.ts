import fundRequestService from "@services/fundRequestService";
import { PaginatedData } from "../types/BaseEntity";
import { sendError, sendResponse } from "@utils/apiResponse";
import { Request, Response } from "express";
import { sendGlobalEmail } from "@services/emailService";
import UserModel from "@models/user.model";
import FundRequestModel from "@models/fund-request.model";
import logger from "@config/logger";

class FundRequestController {
    async createRequest(req: Request, res: Response) {
        const { amount, description, deadline, recipients } = req.body
        try {
            if (!req.user) throw new Error("Utilisateur non authentifié");
            if (!amount || !description || !deadline || !recipients) {
                sendError(res, 401, 'Veuillez fournir tous les champs')
            }
            
            const newRequest = await fundRequestService.createFundRequest(
                req.user.id,
                {
                    amount,
                    description,
                    deadline: new Date(deadline),
                    recipients
                }
            );

            // Récupérer les emails des destinataires (supposons que chaque recipient contient un user avec un email)
            for (const recipient of newRequest.recipients) {
                // Il faut que recipient.user.email soit disponible, sinon il faut ajuster la récupération dans le service
                const email = recipient.recipient?.email;
                if (email) {
                    await sendGlobalEmail(
                        email,
                        "Nouvelle demande de fonds",
                        `<h3>Demande de fonds</h3>
                        <p>Vous avez reçu une demande de fonds : <b>${description}</b> de la part de ${req.user.firstname} ${req.user.lastname} 
                        d’un montant de <b>${amount} FCFA</b> à valider avant le <b>${deadline}</b>.</p>`,
                        "FUND_REQUEST"
                    );
                }
            }

            logger.info(`Nouvelle demande de fonds créée par l'utilisateur ${req.user.id}`);

            sendResponse(res, 201, "Demande créée avec succès", newRequest);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getMyRequests(req: Request, res: Response) {
        const { userId } = req.params
        try {
            if (!req.user) throw new Error("Utilisateur non authentifié");
            if (!userId || req.user.id !== parseInt(userId)) {
                throw new Error("Veuillez fournir l'id de l'utilisateur connecté")
            }
            
            const requests = await fundRequestService.getFundRequestsByUser(req.user.id);
            sendResponse(res, 200, "Demandes récupérées", requests);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async updateRequestStatus(req: Request, res: Response) {
        try {
            const { requestRecipientId } = req.params;
            const { status } = req.body;
            if (!requestRecipientId || !status) {
                sendError(res, 401, 'Veuillez fournir tous les champs')
            }

            const request = await fundRequestService.updateRecipientStatus(
                Number(requestRecipientId), 
                status
            );

            if (request?.recipient?.email) {
                await sendGlobalEmail(
                    request.recipient.email,
                    "Nouveau statut demande de fonds",
                    `<h3>Demande de fonds</h3>
                    <p>Bonjour ${request.recipient.firstname || ''},</p>
                    <p>Le statut de la demande de fonds qui vous concerne a été mis à jour à : <b>${status}</b>.</p>`
                );
            }

            logger.info(`Statut de la demande de fonds ${requestRecipientId} mis à jour à ${status} par l'utilisateur ${req.user?.id}`);

            sendResponse(res, 200, "Statut de la demande mis à jour");
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async updateFundRequestStatus(req: Request, res: Response) {
        const { fundRequestId } = req.params;
        const { status } = req.body;

        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            if (!fundRequestId || !status) {
                sendError(res, 401, 'Veuillez fournir tous les champs')
            }
            if (status === 'FULLY_FUNDED' || status === 'PARTIALLY_FUNDED') {
                sendError(res, 403, 'Vous ne pouvez pas attribuer ce status')
            }

            const fundRequest = await fundRequestService.updateFundRequestStatus(
                Number(fundRequestId), 
                status, 
                req.user.id
            );

            if (fundRequest?.recipients) {
                for (const recipient of fundRequest.recipients) {
                    const email = recipient.recipient?.email;
                    if (email && recipient.recipient) {
                        await sendGlobalEmail(
                            email,
                            "Nouveau statut demande de fonds",
                            `<p>Bonjour ${recipient.recipient.firstname || ''},</p>
                            <p>Le statut de la demande de fonds <b>${fundRequest.reference}</b> a été mis à jour à : <b>${status}</b>.</p>`
                        );
                    }
                }
            }

            logger.info(`Statut de la demande de fonds ${fundRequestId} mis à jour à ${status} par l'utilisateur ${req.user.id}`);

            sendResponse(res, 200, "Statut de la demande mis à jour");
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async makePayment(req: Request, res: Response) {
        const { requestRecipientId } = req.params;
        const { amount, description, fundRequestId } = req.body;
        try {
            if (!req.user) throw new Error("Utilisateur non authentifié");
            if (!requestRecipientId || !amount || !fundRequestId) {
                sendError(res, 401, 'Veuillez fournir tous les champs')
            }
            
            const payment = await fundRequestService.recordPayment(
                Number(req.params.requestRecipientId),
                req.user.id,
                {
                    amount: amount,
                    currency: 'XAF',
                    description
                }
            );

            // Récupérer l'initiateur de la demande de fonds
            const fundRequest = await FundRequestModel.findOne({
                where: { id: Number(fundRequestId) },
                include: [
                    {
                        model: UserModel,
                        as: 'requesterFund',
                        attributes: ['email', 'firstname', 'lastname']
                    }
                ]
            });

            if (fundRequest?.requesterFund?.email) {
                await sendGlobalEmail(
                    fundRequest.requesterFund.email,
                    "Nouveau paiement demande de fonds",
                    `<h3>Nouveau paiement</h3>
                    <p>Bonjour ${fundRequest.requesterFund.firstname || ''},</p>
                    <p>Un paiement de <b>${amount} XAF</b> a été effectué pour votre demande de fonds par ${req.user.firstname}.</p>
                    <p>Description : ${description || 'Aucune description'}</p>`
                );
            }

            logger.info(`Paiement de ${amount} XAF enregistré pour la demande de fonds ${fundRequestId} par l'utilisateur ${req.user.id}`);

            sendResponse(res, 201, "Paiement enregistré", payment);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getAllFundRequests(req: Request, res: Response) {
        const { page, limit, startIndex, startDate, endDate, status } = res.locals.pagination;
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            const fundRequests = await fundRequestService.fundRequestAllList(
                Number(limit), 
                Number(startIndex), 
                status as 'PENDING' | 'PARTIALLY_FUNDED' | 'FULLY_FUNDED' | 'CANCELLED',
                startDate as string, 
                endDate as string
            );
            const totalPages = Math.ceil(fundRequests.count / limit);
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: fundRequests.count,
                items: fundRequests.rows
            };

            sendResponse(res, 200, 'Demandes de fonds récupérées avec succès', responseData);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getFundRequestById(req: Request, res: Response) {
        const { fundRequestId } = req.params
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            const fundRequest = await fundRequestService.fundRequestById(parseInt(fundRequestId))
            if (!fundRequest) {
                sendError(res, 404, "Demande de fonds introuvable")
            }
            sendResponse(res, 200, "Demade de fonds récupérée", fundRequest)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getAllFundRequestsForUser(req: Request, res: Response) {
        const { page, limit, startIndex, status } = res.locals.pagination
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            const fundRequestsUser = await fundRequestService.getAllFundRequestsForUser(
                req.user.id,
                limit,
                startIndex,
                status
            )
            const totalPages = Math.ceil(fundRequestsUser.count / limit);
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: fundRequestsUser.count,
                items: fundRequestsUser.rows
            };
            sendResponse(res, 200, "Liste des demandes de fonds d'un utilisateur récupérées", responseData)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async deleteFundRequest(req: Request, res: Response) {
        const { fundRequestId } = req.params;
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            if (!fundRequestId) {
                return sendError(res, 403, 'Veuillez fournir l\'ID de la demande de fonds');
            }

            const deletedFundRequest = await fundRequestService.deleteFundRequest(
                parseInt(fundRequestId),
                req.user.id
            )
            if (!deletedFundRequest) {
                return sendError(res, 404, 'Demande de fonds non trouvée');
            }

            // Récupérer l'email de l'initiateur
            if (req.user.email) {
                await sendGlobalEmail(
                    req.user.email,
                    "Suppression de votre demande de fonds",
                    `<h3>Suppression demande de fonds</h3>
                    <p>Bonjour ${req.user.firstname || ''},</p>
                    <p>Votre demande de fonds a bien été supprimée avec succès.</p>`
                );
            }

            logger.info(`Demande de fonds ${fundRequestId} supprimée par l'utilisateur ${req.user.id}`);

            sendResponse(res, 200, 'Demande de fonds supprimée avec succès');
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async deleteAdminFundRequest(req: Request, res: Response) {
        const { fundRequestId } = req.params;
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            if (!fundRequestId) {
                return sendError(res, 403, 'Veuillez fournir l\'ID de la demande de fonds');
            }

            const fundRequest = await FundRequestModel.findByPk(Number(fundRequestId), {
                include: [{
                    model: UserModel,
                    as: 'requesterFund',
                    attributes: ['firstname', 'email']
                }]
            })
            // Récupérer l'email de l'initiateur
            if (fundRequest && fundRequest.requesterFund) {
                await sendGlobalEmail(
                    fundRequest.requesterFund.email,
                    "Suppression de votre demande de fonds",
                    `<h3>Suppression demande de fonds</h3>
                    <p>Bonjour ${fundRequest.requesterFund.firstname || ''},</p>
                    <p>Votre demande de fonds a bien été supprimée avec succès.</p>`
                );
            }

            const deletedFundRequest = await fundRequestService.deleteAdminFundRequest(
                parseInt(fundRequestId)
            )
            if (!deletedFundRequest) {
                return sendError(res, 404, 'Demande de fonds non trouvée');
            }

            logger.info(`Demande de fonds ${fundRequestId} supprimée par l'administrateur ${req.user.id}`);
            
            sendResponse(res, 200, 'Demande de fonds supprimée avec succès');
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }
}

export default new FundRequestController();