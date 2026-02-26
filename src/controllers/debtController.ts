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
import { Result } from "express-validator";
import { notifyDeletingDebtUser, notifyRegularisationDebtUser } from "@services/emailService";
import configService from "@services/configService";


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

            const rejectFeesCard = await configService.getConfigByName('SENDO_TRANSACTION_CARD_REJECT_FEES')
            if (!rejectFeesCard) throw new Error("Config introuvable");

            for (let index = 0; index < debts.length; index++) {
                const balanceObject = await cardService.getBalance(virtualCard.paymentMethod!.paymentMethodId);
                if (Number(balanceObject.balance) < Number(debts[index].amount)) {
                    sendError(res, 400, `Solde insuffisant pour payer la dette #${debts[index].intitule}`);
                    return;
                }

                const debt = debts[index];

                const transactionToCreate: TransactionCreate = {
                    amount: 0,
                    type: typesTransaction['1'],
                    status: 'PENDING',
                    userId: debts[index].user!.id,
                    currency: typesCurrency['0'],
                    totalAmount: debts[index].amount,
                    method: typesMethodTransaction['2'],
                    sendoFees: Number(debt.amount) >= Number(rejectFeesCard!.value) ? (Number(debt.amount) - 335) : Number(debt.amount),
                    partnerFees: Number(debt.amount) >= Number(rejectFeesCard!.value) ? 335 : 0,
                    virtualCardId: virtualCard.id,
                    description: `Paiement par Sendo de la dette #${debts[index].intitule}`,
                    receiverId: debts[index].user!.id,
                    receiverType: 'User'
                }
                const transaction = await transactionService.createTransaction(transactionToCreate)

                const payload: CashInPayload = {
                    amount: roundToNextMultipleOfFive(Number(debts[index].amount)),
                    currencyCode: 'XAF',
                    confirm: true,
                    paymentType: 'NEERO_CARD_CASHOUT',
                    sourcePaymentMethodId: virtualCard.paymentMethod!.paymentMethodId,
                    destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
                };

                const cashin = await neeroService.createCashInPayment(payload)
                
                transaction.transactionReference = cashin.id;
                const new2Transaction = await transaction.save()

                const checkTransaction = await neeroService.getTransactionIntentById(cashin.id)

                if (
                    checkTransaction.status === "SUCCESSFUL" &&
                    new2Transaction.status === 'PENDING'
                ) {
                    new2Transaction.status = "COMPLETED";
                    await new2Transaction.save()

                    // Envoyer un mail
                    await notifyRegularisationDebtUser(debt, false, debt.amount);
                    
                    await debt.destroy();
                    
                    // Envoyer une notification
                    const token = await notificationService.getTokenExpo(debts[index].user!.id)
                    if (token) {
                        await notificationService.save({
                            title: 'Sendo',
                            content: `Paiement par Sendo de la dette #${debts[index].intitule} d'un montant de ${debt.amount} XAF`,
                            userId: debts[index].user!.id,
                            status: 'SENDED',
                            token: token?.token ?? '',
                            type: 'SUCCESS_WITHDRAWAL_CARD'
                        })
                    }
                }
    
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
            if (Number(balanceObject.balance) < roundToNextMultipleOfFive(debt.amount)) {
                sendError(res, 400, `Solde insuffisant pour payer la dette #${debt.intitule}`);
                return;
            }

            const rejectFeesCard = await configService.getConfigByName('SENDO_TRANSACTION_CARD_REJECT_FEES')
            if (!rejectFeesCard) throw new Error("Config introuvable");
            
            const transactionToCreate: TransactionCreate = {
                amount: 0,
                type: typesTransaction['1'],
                status: 'PENDING',
                userId: debt.user!.id,
                currency: typesCurrency['0'],
                totalAmount: debt.amount,
                method: typesMethodTransaction['2'],
                sendoFees: Number(debt.amount) >= Number(rejectFeesCard!.value) ? (Number(debt.amount) - 335) : Number(debt.amount),
                partnerFees: Number(debt.amount) >= Number(rejectFeesCard!.value) ? 335 : 0,
                virtualCardId: virtualCard.id,
                description: `Paiement par Sendo de la dette #${debt.intitule}`,
                receiverId: debt.user!.id,
                receiverType: 'User'
            }
            const transaction = await transactionService.createTransaction(transactionToCreate)

            const payload: CashInPayload = {
                amount: roundToNextMultipleOfFive(Number(debt.amount)),
                currencyCode: 'XAF',
                confirm: true,
                paymentType: 'NEERO_CARD_CASHOUT',
                sourcePaymentMethodId: virtualCard.paymentMethod!.paymentMethodId,
                destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
            };

            const cashin = await neeroService.createCashInPayment(payload)

            transaction.transactionReference = cashin.id;
            const new2Transaction = await transaction.save()

            const checkTransaction = await neeroService.getTransactionIntentById(cashin.id)

            if (
                checkTransaction.status === "SUCCESSFUL" &&
                new2Transaction.status === 'PENDING'
            ) {
                new2Transaction.status = "COMPLETED"
                await new2Transaction.save()

                // Envoyer un mail
                await notifyRegularisationDebtUser(debt, false, debt.amount);
                
                await debt.destroy();
                
                // Envoyer une notification
                const token = await notificationService.getTokenExpo(debt.user!.id)
                if (token) {
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Paiement par Sendo de la dette #${debt.intitule} d'un montant de ${checkTransaction.amount} XAF`,
                        userId: debt.user!.id,
                        status: 'SENDED',
                        token: token.token,
                        type: 'SUCCESS_WITHDRAWAL_CARD'
                    })
                }
            }
    
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

            const rejectFeesCard = await configService.getConfigByName('SENDO_TRANSACTION_CARD_REJECT_FEES')
            if (!rejectFeesCard) throw new Error("Config introuvable");

            for (let index = 0; index < debts.length; index++) {
                const debt = debts[index]
                const transactionToCreate: TransactionCreate = {
                    amount: 0,
                    type: typesTransaction['1'],
                    status: 'PENDING',
                    userId: debts[index].user!.id,
                    currency: typesCurrency['0'],
                    totalAmount: debts[index].amount,
                    method: typesMethodTransaction['3'],
                    transactionReference: `ID Dette : #${debts[index].id}`,
                    sendoFees: Number(debt.amount) >= Number(rejectFeesCard!.value) ? (Number(debt.amount) - 335) : Number(debt.amount),
                    partnerFees: Number(debt.amount) >= Number(rejectFeesCard!.value) ? 335 : 0,
                    virtualCardId: debts[index].card!.id,
                    description: `Paiement par Sendo de la dette #${debts[index].intitule}`,
                    receiverId: debts[index].user!.id,
                    receiverType: 'User'
                }
                const transaction = await transactionService.createTransaction(transactionToCreate)

                await walletService.debitWallet(
                    debts[index].user!.wallet!.matricule,
                    debts[index].amount,
                    "Payer dette wallet par admin",
                    req.user.id,
                    transaction.id
                )

                transaction.status = 'COMPLETED';
                await transaction.save()

                // Envoyer un mail
                await notifyRegularisationDebtUser(debts[index], false, debts[index].amount);
                
                await debts[index].destroy();
                
                // Envoyer une notification
                const token = await notificationService.getTokenExpo(debts[index].user!.id)
                if (token) {
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Paiement par Sendo de la dette #${debts[index].intitule} d'un montant de ${debts[index].amount} XAF`,
                        userId: debts[index].user!.id,
                        status: 'SENDED',
                        token: token.token,
                        type: 'SUCCESS_WITHDRAWAL_CARD'
                    })
                }
    
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
        const result = await sequelize.transaction()
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

            const rejectFeesCard = await configService.getConfigByName('SENDO_TRANSACTION_CARD_REJECT_FEES')
            if (!rejectFeesCard) throw new Error("Config introuvable");
            
            const transactionToCreate: TransactionCreate = {
                amount: 0,
                type: typesTransaction['1'],
                status: 'PENDING',
                userId: debt.user!.id,
                currency: typesCurrency['0'],
                totalAmount: Number(debt.amount),
                method: typesMethodTransaction['3'],
                transactionReference: `ID Dette : #${debt.id}`,
                sendoFees: Number(debt.amount) >= Number(rejectFeesCard!.value) ? (Number(debt.amount) - 335) : Number(debt.amount),
                partnerFees: Number(debt.amount) >= Number(rejectFeesCard!.value) ? 335 : 0,
                virtualCardId: debt.card!.id,
                description: `Paiement par Sendo de la dette #${debt.intitule}`,
                receiverId: debt.user!.id,
                receiverType: 'User',
                provider: 'WALLET'
            }
            const transaction = await transactionService.createTransaction(transactionToCreate, { transaction: result })
            
            await walletService.debitWallet(
                debt.user!.wallet!.matricule,
                debt.amount,
                "Payer dette wallet par admin",
                req.user.id,
                transaction.id
            )

            transaction.status = 'COMPLETED';
            await transaction.save({ transaction: result });

            // Envoyer un mail
            await notifyRegularisationDebtUser(debt, false, debt.amount);
            
            await debt.destroy({ transaction: result });
            
            // Envoyer une notification
            const token = await notificationService.getTokenExpo(debt.user!.id)
            if (token) {
                await notificationService.save({
                    title: 'Sendo',
                    content: `Paiement par Sendo de la dette #${debt.intitule} d'un montant de ${debt.amount} XAF`,
                    userId: debt.user!.id,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'SUCCESS_WITHDRAWAL_CARD'
                })
            }  

            await result.commit();
    
            logger.info("Paiement dette par Sendo", {
                amount: debt.amount,
                status: typesStatusTransaction['1'],
                card: `${debt.card!.cardName} - ${debt.card!.cardId}`,
                user: `Admin ID : ${req.user!.id} - ${req.user!.firstname} ${req.user!.lastname}`
            });
            
            sendResponse(res, 200, 'La requête a été initiée avec succès', {})
        } catch (error: any) {
            await result.rollback();
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

        const result = await sequelize.transaction()
        try {

            const debt = await debtService.getOneDebtUser(Number(idDebt), Number(userId));
            if (!debt) throw new Error("Dette non trouvée");

            const transactionToCreate: TransactionCreate = {
                amount: 0,
                type: typesTransaction['1'],
                status: 'PENDING',
                userId: debt.user!.id,
                currency: typesCurrency['0'],
                totalAmount: Number(partialAmount),
                method: typesMethodTransaction['3'],
                transactionReference: `ID Dette : #${debt.id}`,
                sendoFees: Number(debt.amount) >= 335 ? Number(partialAmount) : 0,
                partnerFees: Number(debt.amount) <= 335 ? Number(partialAmount) : 0,
                virtualCardId: debt.card!.id,
                description: `Paiement partiel par Sendo de la dette #${debt.intitule}`,
                receiverId: debt.user!.id,
                receiverType: 'User'
            }
            const transaction = await transactionService.createTransaction(transactionToCreate, { transaction: result })

            // Débit wallet et mise à jour dette
            await walletService.debitWallet(
                debt.user!.wallet!.matricule, 
                Number(partialAmount),
                "Payer dette partielle par admin",
                req.user!.id,
                transaction.id
            );

            transaction.status = 'COMPLETED';
            await transaction.save({ transaction: result });

            const newAmount = debt.amount - Number(partialAmount);
            if (newAmount <= 0) {
                await debt.destroy({ transaction: result });
            } else {
                debt.amount = newAmount;
                await debt.save({ transaction: result });
            }
            
            await result.commit();

            // Envoyer un mail
            await notifyRegularisationDebtUser(debt, true, Number(partialAmount));
    
            logger.info("Paiement partiel dette par Sendo", {
                amount: Number(partialAmount),
                status: typesStatusTransaction['1'],
                card: `${debt.card!.cardName} - ${debt.card!.cardId}`,
                user: `Admin ID : ${req.user!.id} - ${req.user!.firstname} ${req.user!.lastname}`
            });

            // Notification
            const token = await notificationService.getTokenExpo(req.user.id);
            if (token) {
                await notificationService.save({
                    title: 'Sendo',
                    content: `Paiement partiel par Sendo de ${Number(partialAmount)} XAF de la dette #${debt.intitule} XAF effectué avec succès`,
                    userId: debt.user!.id,
                    status: 'SENDED',
                    token: token.token,
                    type: 'SUCCESS_WITHDRAWAL_WALLET'
                });
            }

            sendResponse(res, 200, "Paiement partiel effectué avec succès", {});

        } catch (error: any) {
            await result.rollback();
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
            if (Number(balanceObject.balance) < roundToNextMultipleOfFive(amountNum)) {
                sendError(res, 400, `Solde insuffisant pour payer le montant partiel de ${amountNum} XAF`);
                return;
            }

            const transactionToCreate: TransactionCreate = {
                amount: 0,
                type: typesTransaction['1'],
                status: 'PENDING',
                userId: debt.user!.id,
                currency: typesCurrency['0'],
                totalAmount: amountNum,
                method: typesMethodTransaction['2'],
                sendoFees: Number(debt.amount) >= 335 ? Number(partialAmount) : 0,
                partnerFees: Number(debt.amount) <= 335 ? Number(partialAmount) : 0,
                virtualCardId: virtualCard.id,
                description: `Paiement partiel par Sendo de la dette #${debt.intitule}`,
                receiverId: debt.user!.id,
                receiverType: 'User'
            }
            const transaction = await transactionService.createTransaction(transactionToCreate)

            const payload: CashInPayload = {
                amount: roundToNextMultipleOfFive(amountNum),
                currencyCode: 'XAF',
                confirm: true,
                paymentType: 'NEERO_CARD_CASHOUT',
                sourcePaymentMethodId: virtualCard.paymentMethod!.paymentMethodId,
                destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
            };

            const cashin = await neeroService.createCashInPayment(payload)
            transaction.transactionReference = cashin.id;
            const new2Transaction = await transaction.save()

            const checkTransaction = await neeroService.getTransactionIntentById(cashin.id)

            if (
                checkTransaction.status === "SUCCESSFUL" &&
                new2Transaction.status === 'PENDING'
            ) {
                debt.amount = debt.amount - amountNum;
                await debt.save();

                new2Transaction.status = mapNeeroStatusToSendo(checkTransaction.status);
                await new2Transaction.save()

                // Envoyer un mail
                await notifyRegularisationDebtUser(debt, true, amountNum);
                
                // Envoyer une notification
                const token = await notificationService.getTokenExpo(debt.user!.id)
                if (token) {
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Paiement partiel par Sendo de la dette #${debt.intitule} d'un montant de ${amountNum} XAF`,
                        userId: debt.user!.id,
                        status: 'SENDED',
                        token: token.token,
                        type: 'SUCCESS_WITHDRAWAL_CARD'
                    })
                }
            }
    
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

            // Envoyer un mail
            await notifyDeletingDebtUser(debt);

            // Envoyer une notification
            const token = await notificationService.getTokenExpo(debt.user!.id)
            if (token) {
                await notificationService.save({
                    title: 'Sendo',
                    content: `Votre dette #${debt.intitule} d'un montant de ${debt.amount} XAF a été supprimée par Sendo`,
                    userId: debt.user!.id,
                    status: 'SENDED',
                    token: token.token,
                    type: 'SUCCESS_WITHDRAWAL_CARD'
                })
            }

            sendResponse(res, 204, 'Dette supprimée avec succès', {})
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }
}

export default new DebtController()