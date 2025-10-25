import debtService from "@services/debtService";
import { PaginatedData } from "../types/BaseEntity";
import { sendError, sendResponse } from "@utils/apiResponse";
import { Request, Response } from "express";
import neeroService, { CashInPayload } from "@services/neeroService";
import cardService from "@services/cardService";
import { mapNeeroStatusToSendo, roundToNextMultipleOfFive } from "@utils/functions";
import { wait } from "./mobileMoneyController";
import notificationService from "@services/notificationService";
import logger from "@config/logger";
import transactionService from "@services/transactionService";
import { typesCurrency, typesMethodTransaction, typesStatusTransaction, typesTransaction } from "@utils/constants";
import { TransactionCreate } from "../types/Transaction";
import walletService from "@services/walletService";
import sequelize from "@config/db";


class DebtController {
    async getAllDebts(req: Request, res: Response) {
        const { limit, startIndex, page } = res.locals.pagination
        try {
            const debts = await debtService.getAllDebts(limit, startIndex)

            const totalPages = Math.ceil(debts.count / limit);
                                          
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: debts.count,
                items: debts.rows
            };

            sendResponse(res, 200, 'Dettes récupérées avec succès', responseData)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async getAllDebtsForUser(req: Request, res: Response) {
        const { userId } = req.params;
        try {
            if (!userId) {
                throw new Error("Veuillez fournir le userId");
            }
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const debtsUser = await debtService.getAllDebtsUser(Number(userId))

            sendResponse(res, 200, 'Dettes récupérées avec succès', debtsUser)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async payDebtsFromCard(req: Request, res: Response) {
        const { idCard } = req.params;
        try {
            if (!idCard) {
                throw new Error("Veuillez fournir l'ID de la carte");
            }
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const debts = await debtService.getAllDebtsCard(Number(idCard))
            if (debts.length === 0) {
                throw new Error("Cette carte n'a aucune dette enregistree")
            }

            const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
            if (!paymentMethodMerchant) {
                throw new Error("Erreur lors de la récupération de la source")
            }
            
            const virtualCard = await cardService.getPaymentMethodCard(Number(idCard))
            if (!virtualCard) {
                throw new Error("Erreur de récupération de la méthode de paiement de la carte")
            }

            for (let index = 0; index < debts.length; index++) {
                const balanceObject = await cardService.getBalance(virtualCard.paymentMethod!.paymentMethodId);
                if (Number(balanceObject.balance) < Number(debts[index].amount)) {
                    sendError(res, 400, `Solde insuffisant pour payer la dette #${debts[index].intitule}`);
                    return;
                }

                const payload: CashInPayload = {
                    amount: roundToNextMultipleOfFive(Number(debts[index].amount)),
                    currencyCode: 'XAF',
                    confirm: true,
                    paymentType: 'NEERO_CARD_CASHOUT',
                    sourcePaymentMethodId: virtualCard.paymentMethod!.paymentMethodId,
                    destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
                };

                const cashin = await neeroService.createCashInPayment(payload)
                
                const neeroTransaction = await neeroService.getTransactionIntentById(cashin.id)
    
                await wait(5000)
    
                const checkTransaction = await neeroService.getTransactionIntentById(neeroTransaction.id)

                if (
                    checkTransaction.statusUpdates.some((update: any) => update.status === "SUCCESSFUL")
                ) {
                    await debts[index].destroy();
                    
                    // Envoyer une notification
                    const token = await notificationService.getTokenExpo(debts[index].user!.id)
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Paiement par Sendo de la dette #${debts[index].intitule} d'un montant de ${checkTransaction.amount} XAF`,
                        userId: debts[index].user!.id,
                        status: 'SENDED',
                        token: token?.token ?? '',
                        type: 'SUCCESS_WITHDRAWAL_CARD'
                    })
                }

                const transactionToCreate: TransactionCreate = {
                    amount: 0,
                    type: typesTransaction['1'],
                    status: mapNeeroStatusToSendo(checkTransaction.status),
                    userId: debts[index].user!.id,
                    currency: typesCurrency['0'],
                    totalAmount: debts[index].amount,
                    method: typesMethodTransaction['2'],
                    transactionReference: cashin.id,
                    sendoFees: debts[index].amount,
                    virtualCardId: virtualCard.id,
                    description: `Paiement par Sendo de la dette #${debts[index].intitule}`,
                    receiverId: debts[index].user!.id,
                    receiverType: 'User'
                }
                await transactionService.createTransaction(transactionToCreate)
    
                logger.info("Paiement dette par Sendo", {
                    amount: debts[index].amount,
                    index: index,
                    status: mapNeeroStatusToSendo(checkTransaction.status),
                    card: `${virtualCard.cardName} - ${virtualCard.cardId}`,
                    user: `Admin ID : ${req.user!.id} - ${req.user!.firstname} ${req.user!.lastname}`
                });
            }
            
            sendResponse(res, 200, 'La requête a été initiée avec succès', {})
              
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async payOneDebtFromCard(req: Request, res: Response) {
        const { idCard, idDebt } = req.params;
        try {
            if (!idDebt) {
                throw new Error("Veuillez fournir l'ID de la dette");
            }
            if (!idCard) {
                throw new Error("Veuillez fournir l'ID de la carte");
            }
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const debt = await debtService.getOneDebtCard(Number(idDebt), Number(idCard))
            if (!debt) {
                throw new Error("Dette introuvable")
            }

            const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
            if (!paymentMethodMerchant) {
                throw new Error("Erreur lors de la récupération de la source")
            }
            
            const virtualCard = await cardService.getPaymentMethodCard(Number(idCard))
            if (!virtualCard) {
                throw new Error("Erreur de récupération de la méthode de paiement de la carte")
            }

            
            const balanceObject = await cardService.getBalance(virtualCard.paymentMethod!.paymentMethodId);
            if (Number(balanceObject.balance) < Number(debt.amount)) {
                sendError(res, 400, `Solde insuffisant pour payer la dette #${debt.intitule}`);
                return;
            }

            const payload: CashInPayload = {
                amount: roundToNextMultipleOfFive(Number(debt.amount)),
                currencyCode: 'XAF',
                confirm: true,
                paymentType: 'NEERO_CARD_CASHOUT',
                sourcePaymentMethodId: virtualCard.paymentMethod!.paymentMethodId,
                destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
            };

            const cashin = await neeroService.createCashInPayment(payload)
            
            const neeroTransaction = await neeroService.getTransactionIntentById(cashin.id)

            await wait(5000)

            const checkTransaction = await neeroService.getTransactionIntentById(neeroTransaction.id)

            if (
                checkTransaction.statusUpdates.some((update: any) => update.status === "SUCCESSFUL")
            ) {
                await debt.destroy();
                
                // Envoyer une notification
                const token = await notificationService.getTokenExpo(debt.user!.id)
                await notificationService.save({
                    title: 'Sendo',
                    content: `Paiement par Sendo de la dette #${debt.intitule} d'un montant de ${checkTransaction.amount} XAF`,
                    userId: debt.user!.id,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'SUCCESS_WITHDRAWAL_CARD'
                })
            }

            const transactionToCreate: TransactionCreate = {
                amount: 0,
                type: typesTransaction['1'],
                status: mapNeeroStatusToSendo(checkTransaction.status),
                userId: debt.user!.id,
                currency: typesCurrency['0'],
                totalAmount: debt.amount,
                method: typesMethodTransaction['2'],
                transactionReference: cashin.id,
                sendoFees: debt.amount,
                virtualCardId: virtualCard.id,
                description: `Paiement par Sendo de la dette #${debt.intitule}`,
                receiverId: debt.user!.id,
                receiverType: 'User'
            }
            await transactionService.createTransaction(transactionToCreate)
    
            logger.info("Paiement dette par Sendo", {
                amount: debt.amount,
                status: mapNeeroStatusToSendo(checkTransaction.status),
                card: `${virtualCard.cardName} - ${virtualCard.cardId}`,
                user: `Admin ID : ${req.user!.id} - ${req.user!.firstname} ${req.user!.lastname}`
            });
            
            sendResponse(res, 200, 'La requête a été initiée avec succès', {})
              
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async payDebtsFromWallet(req: Request, res: Response) {
        const { userId } = req.params;
        try {
            if (!userId) {
                throw new Error("Veuillez fournir l'ID de l'utilisateur");
            }
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const debts = await debtService.getAllDebtsUser(Number(userId))
            if (debts.length === 0) {
                throw new Error("Cette carte n'a aucune dette enregistree")
            }

            for (let index = 0; index < debts.length; index++) {
                await walletService.debitWallet(
                    debts[index].user!.wallet!.matricule,
                    debts[index].amount
                )
                
                await debts[index].destroy();
                
                // Envoyer une notification
                const token = await notificationService.getTokenExpo(debts[index].user!.id)
                await notificationService.save({
                    title: 'Sendo',
                    content: `Paiement par Sendo de la dette #${debts[index].intitule} d'un montant de ${debts[index].amount} XAF`,
                    userId: debts[index].user!.id,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'SUCCESS_WITHDRAWAL_CARD'
                })

                const transactionToCreate: TransactionCreate = {
                    amount: 0,
                    type: typesTransaction['1'],
                    status: 'COMPLETED',
                    userId: debts[index].user!.id,
                    currency: typesCurrency['0'],
                    totalAmount: debts[index].amount,
                    method: typesMethodTransaction['3'],
                    transactionReference: debts[index].intitule,
                    sendoFees: debts[index].amount,
                    virtualCardId: debts[index].card!.id,
                    description: `Paiement par Sendo de la dette #${debts[index].intitule}`,
                    receiverId: debts[index].user!.id,
                    receiverType: 'User'
                }
                await transactionService.createTransaction(transactionToCreate)
    
                logger.info("Paiement dette par Sendo", {
                    amount: debts[index].amount,
                    index: index,
                    status: typesStatusTransaction['1'],
                    card: `${debts[index].card!.cardName} - ${debts[index].card!.cardId}`,
                    user: `Admin ID : ${req.user!.id} - ${req.user!.firstname} ${req.user!.lastname}`
                });
            }
            
            sendResponse(res, 200, 'La requête a été initiée avec succès', {})
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async payOneDebtFromWallet(req: Request, res: Response) {
        const { userId, idDebt } = req.params;
        try {
            if (!idDebt) {
                throw new Error("Veuillez fournir l'ID de la dette");
            }
            if (!userId) {
                throw new Error("Veuillez fournir l'ID de l'utilisateur");
            }
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const debt = await debtService.getOneDebtUser(Number(idDebt), Number(userId))
            if (!debt) {
                throw new Error("Dette introuvable")
            }
            
            await walletService.debitWallet(
                debt.user!.wallet!.matricule,
                debt.amount
            )
            
            await debt.destroy();
            
            // Envoyer une notification
            const token = await notificationService.getTokenExpo(debt.user!.id)
            await notificationService.save({
                title: 'Sendo',
                content: `Paiement par Sendo de la dette #${debt.intitule} d'un montant de ${debt.amount} XAF`,
                userId: debt.user!.id,
                status: 'SENDED',
                token: token?.token ?? '',
                type: 'SUCCESS_WITHDRAWAL_CARD'
            })  

            const transactionToCreate: TransactionCreate = {
                amount: 0,
                type: typesTransaction['1'],
                status: 'COMPLETED',
                userId: debt.user!.id,
                currency: typesCurrency['0'],
                totalAmount: debt.amount,
                method: typesMethodTransaction['3'],
                transactionReference: debt.intitule,
                sendoFees: debt.amount,
                virtualCardId: debt.card!.id,
                description: `Paiement par Sendo de la dette #${debt.intitule}`,
                receiverId: debt.user!.id,
                receiverType: 'User'
            }
            await transactionService.createTransaction(transactionToCreate)
    
            logger.info("Paiement dette par Sendo", {
                amount: debt.amount,
                status: typesStatusTransaction['1'],
                card: `${debt.card!.cardName} - ${debt.card!.cardId}`,
                user: `Admin ID : ${req.user!.id} - ${req.user!.firstname} ${req.user!.lastname}`
            });
            
            sendResponse(res, 200, 'La requête a été initiée avec succès', {})
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    // Débit partiel depuis wallet
    async debitPartialFromWallet(req: Request, res: Response) {
        const { partialAmount, userId } = req.body;
        const { idDebt } = req.params;

        if (!idDebt || !partialAmount || !userId) {
            sendError(res, 400, "Veuillez fournir tous les paramètres");
            return;
        }
        if (!req.user) {
            sendError(res, 403, "Utilisateur non authentifié");
            return;
        }

        try {
            const result = await sequelize.transaction(async (t) => {
                const debt = await debtService.getOneDebtUser(Number(idDebt), Number(userId));
                if (!debt) throw new Error("Dette non trouvée");

                // Débit wallet et mise à jour dette
                await walletService.debitWallet(
                    debt.user!.wallet!.matricule, 
                    Number(partialAmount)
                );

                debt.amount -= Number(partialAmount);
                if (debt.amount <= 0) {
                    await debt.destroy({ transaction: t });
                } else {
                    await debt.save({ transaction: t });
                }

                return debt;
            });

            const transactionToCreate: TransactionCreate = {
                amount: 0,
                type: typesTransaction['1'],
                status: 'COMPLETED',
                userId: result.user!.id,
                currency: typesCurrency['0'],
                totalAmount: Number(partialAmount),
                method: typesMethodTransaction['3'],
                transactionReference: result.intitule,
                sendoFees: Number(partialAmount),
                virtualCardId: result.card!.id,
                description: `Paiement partiel par Sendo de la dette #${result.intitule}`,
                receiverId: result.user!.id,
                receiverType: 'User'
            }
            await transactionService.createTransaction(transactionToCreate)
    
            logger.info("Paiement partiel dette par Sendo", {
                amount: Number(partialAmount),
                status: typesStatusTransaction['1'],
                card: `${result.card!.cardName} - ${result.card!.cardId}`,
                user: `Admin ID : ${req.user!.id} - ${req.user!.firstname} ${req.user!.lastname}`
            });

            // Notification
            const token = await notificationService.getTokenExpo(req.user.id);
            await notificationService.save({
                title: 'Sendo',
                content: `Paiement partiel par Sendo de ${Number(partialAmount)} XAF de la dette #${result.intitule} XAF effectué avec succès`,
                userId: result.user!.id,
                status: 'SENDED',
                token: token?.token ?? '',
                type: 'SUCCESS_WITHDRAWAL_WALLET'
            });

            sendResponse(res, 200, "Paiement partiel effectué avec succès", {});

        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async debitPartialDebtFromCard(req: Request, res: Response) {
        const { idCard, partialAmount } = req.body;
        const { idDebt } = req.params;

        try {
            if (!idDebt || !partialAmount || !idCard) {
                sendError(res, 400, "Veuillez fournir tous les paramètres");
                return;
            }
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const debt = await debtService.getOneDebtCard(Number(idDebt), Number(idCard))
            if (!debt) {
                throw new Error("Dette introuvable")
            }

            const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
            if (!paymentMethodMerchant) {
                throw new Error("Erreur lors de la récupération de la source")
            }
            
            const virtualCard = await cardService.getPaymentMethodCard(Number(idCard))
            if (!virtualCard) {
                throw new Error("Erreur de récupération de la méthode de paiement de la carte")
            }

            const amountNum = Number(partialAmount)
            const balanceObject = await cardService.getBalance(virtualCard.paymentMethod!.paymentMethodId);
            if (Number(balanceObject.balance) < amountNum) {
                sendError(res, 400, `Solde insuffisant pour payer le montant partiel de ${amountNum} XAF`);
                return;
            }

            const payload: CashInPayload = {
                amount: roundToNextMultipleOfFive(amountNum),
                currencyCode: 'XAF',
                confirm: true,
                paymentType: 'NEERO_CARD_CASHOUT',
                sourcePaymentMethodId: virtualCard.paymentMethod!.paymentMethodId,
                destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
            };

            const cashin = await neeroService.createCashInPayment(payload)
            
            const neeroTransaction = await neeroService.getTransactionIntentById(cashin.id)

            await wait(5000)

            const checkTransaction = await neeroService.getTransactionIntentById(neeroTransaction.id)

            if (
                checkTransaction.statusUpdates.some((update: any) => update.status === "SUCCESSFUL")
            ) {
                debt.amount = debt.amount - amountNum;
                await debt.save();
                
                // Envoyer une notification
                const token = await notificationService.getTokenExpo(debt.user!.id)
                await notificationService.save({
                    title: 'Sendo',
                    content: `Paiement partiel par Sendo de la dette #${debt.intitule} d'un montant de ${amountNum} XAF`,
                    userId: debt.user!.id,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'SUCCESS_WITHDRAWAL_CARD'
                })
            }

            const transactionToCreate: TransactionCreate = {
                amount: 0,
                type: typesTransaction['1'],
                status: mapNeeroStatusToSendo(checkTransaction.status),
                userId: debt.user!.id,
                currency: typesCurrency['0'],
                totalAmount: amountNum,
                method: typesMethodTransaction['2'],
                transactionReference: cashin.id,
                sendoFees: amountNum,
                virtualCardId: virtualCard.id,
                description: `Paiement partiel par Sendo de la dette #${debt.intitule}`,
                receiverId: debt.user!.id,
                receiverType: 'User'
            }
            await transactionService.createTransaction(transactionToCreate)
    
            logger.info("Paiement dette par Sendo", {
                amount: debt.amount,
                status: mapNeeroStatusToSendo(checkTransaction.status),
                card: `${virtualCard.cardName} - ${virtualCard.cardId}`,
                user: `Admin ID : ${req.user!.id} - ${req.user!.firstname} ${req.user!.lastname}`
            });
            
            sendResponse(res, 200, 'La requête a été initiée avec succès', {})
              
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async deleteDebt(req: Request, res: Response) {
        const { idDebt } = req.params
        try {
            if (!idDebt) {
                sendError(res, 400, "Veuillez fournir l'ID de la dette");
                return;
            }
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const debt = await debtService.getDebtById(Number(idDebt))
            if (!debt) {
                sendError(res, 404, "Dette introuvable");
                return;
            }

            logger.info("Dette supprimée dette par Sendo", {
                ID: debt.id,
                amount: debt.amount,
                user: `Admin ID : ${req.user!.id} - ${req.user!.firstname} ${req.user!.lastname}`
            });
            
            await debt.destroy();

            sendResponse(res, 204, 'Dette supprimée avec succès', {})
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }
}

export default new DebtController()