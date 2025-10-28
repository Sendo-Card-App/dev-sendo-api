import logger from "@config/logger";
import { sendGlobalEmail, successTransferFunds } from "@services/emailService";
import merchantService from "@services/merchantService";
import notificationService from "@services/notificationService";
import userService from "@services/userService";
import walletService from "@services/walletService";
import { PaginatedData } from "../types/BaseEntity";
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

    async rechargerWalletMerchant(req: Request, res: Response) {
        const { merchantCode, amount } = req.body
        try {
            if (!req.user) {
                sendError(res, 401, "Utilisateur non authentifié", {});
                return
            }
            if (!merchantCode || !amount) {
                sendError(res, 400, "Veuillez remplir tous les champs", {});
                return
            }

            const transaction = await merchantService.depositWalletMerchant(merchantCode, Number(amount))

            await sendGlobalEmail(
                transaction.merchant.user!.email,
                'Recharge',
                `<p>Sendo vient d'effectuer une recharge de ${amount} XAF sur votre compte</p>`
            )

            logger.info("Recharge portefeuille AGENT-SENDO", {
                admin: `${req.user?.firstname} ${req.user?.lastname}`,
                merchant: `MerchantCode : ${merchantCode}`,
                amount: parseFloat(amount)
            });

            sendResponse(res, 200, 'Recharge réussi !', transaction)
        } catch (error: any) {
            sendError(res, 500, "Erreur lors de la recharge", [error.message]);
        }
    }

    async rechargerWalletCustomer(req: Request, res: Response) {
        const { toWallet, amount } = req.body
        
        try {
            if (!req.user) {
                sendError(res, 401, "Utilisateur non authentifié", {});
                return
            }
            if (!toWallet || !amount) {
                sendError(res, 400, "Veuillez remplir tous les champs", {});
                return
            }

            const merchant = await userService.getMerchantByUserId(Number(req.user.id))
            if (!merchant) {
                sendError(res, 404, "Agent introuvable", {});
                return
            }
            if (Number(merchant?.balance) < Number(amount)) {
                sendError(res, 500, "Veuillez recharger votre portefeuille", {});
                return
            }

            const transfert = await walletService.transferFromAgentToCustomer(merchant.id, toWallet, Number(amount))

            // On notifie tout le monde
            const tokenReceiver = await notificationService.getTokenExpo(transfert.receiver!.id)
            await notificationService.save({
                type: 'SUCCESS_TRANSFER_FUNDS',
                userId: transfert.receiver!.id,
                content: `Vous avez reçu de ${req.user?.firstname} une somme de ${amount} XAF sur votre portefeuille Sendo`,
                title: 'Sendo',
                status: 'SENDED',
                token: tokenReceiver?.token ?? ''
            })

            await successTransferFunds(
                req.user, 
                transfert.receiver!.email, 
                parseFloat(amount)
            )

            logger.info("Transfert d'argent AGENT-SENDO", {
                sender: `${req.user?.firstname} ${req.user?.lastname}`,
                receiver: `${transfert.receiver!.firstname} ${transfert.receiver?.lastname}`,
                amount: parseFloat(amount)
            });

            sendResponse(res, 200, 'Transfert réussi !', {
                receiver: transfert.receiver,
                transaction: transfert.transaction
            })
        } catch (error: any) {
            sendError(res, 500, "Erreur lors du transfert", [error.message]);
        }
    }

    async getAllMerchantTransactions(req: Request, res: Response) {
        const { idMerchant } = req.params;
        const { page, limit, startIndex, status, startDate, endDate } = res.locals.pagination;

        try {
            if (!req.user) {
                sendError(res, 401, "Utilisateur non authentifié", {});
                return
            }
            if (!idMerchant) {
                sendError(res, 400, "Veuillez fournir l'ID du marchant", {});
                return
            }

            const transactions = await merchantService.getAllMerchantTransactions(
                Number(idMerchant),
                limit,
                startIndex,
                status,
                startDate,
                endDate
            )

            const totalPages = Math.ceil(transactions.count / limit);
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: transactions.count,
                items: transactions.rows
            };

            sendResponse(res, 200, 'Transactions récupérées', responseData);
        } catch (error: any) {
            sendError(res, 500, "Erreur serveur", [error.message]);
        }
    }

    async getMerchantTransactionById(req: Request, res: Response) {
        const { transactionId } = req.params;

        try {
            if (!req.user) {
                sendError(res, 401, "Utilisateur non authentifié", {});
                return
            }
            if (!transactionId) {
                sendError(res, 400, "Veuillez fournir l'ID de la transaction", {});
                return
            }

            const transaction = await merchantService.getMerchantTransactionById(Number(transactionId))

            sendResponse(res, 200, 'Transaction récupérée', transaction);
        } catch (error: any) {
            sendError(res, 500, "Erreur serveur", [error.message]);
        }
    }
}

export default new MerchantController();