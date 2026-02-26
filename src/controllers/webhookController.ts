import logger from "@config/logger";
import cardService, { VirtualCardDebtCreate } from "@services/cardService";
import { sendEmailWithHTML } from "@services/emailService";
import notificationService from "@services/notificationService";
import transactionService from "@services/transactionService";
import walletService, { settleCardDebtsIfAny } from "@services/walletService";
import { TransactionCreate } from "../types/Transaction";
import { sendError, sendResponse } from "@utils/apiResponse";
import { ajouterPrefixe237, arrondiSuperieur, checkSignatureNeero, mapNeeroStatusToSendo, roundToNextMultipleOfFive, roundToPreviousMultipleOfFive, troisChiffresApresVirgule } from "@utils/functions";
import { Request, Response } from "express";
import configService from "@services/configService";
import neeroService, { CashInPayload } from "@services/neeroService";
import { wait } from "./mobileMoneyController";
import { typesCurrency, typesMethodTransaction, typesTransaction } from "@utils/constants";
import PaymentMethodModel from "@models/payment-method.model";
import { CardPayload } from "../types/Neero";
import userService from "@services/userService";
import cashinService from "@services/cashinService";
import debtService from "@services/debtService";
import { PaginatedData } from "../types/BaseEntity";
import ConfigModel from "@models/config.model";
import mobileMoneyService from "@services/mobileMoneyService";
import merchantService from "@services/merchantService";
import VirtualCardModel from "@models/virtualCard.model";

const WEBHOOK_SECRET = process.env.NEERO_WEBHOOK_KEY || ''

class WebhookController {
    async neero(req: Request, res: Response) {
        console.log('webhook secret : ', WEBHOOK_SECRET)
        console.log('check signature : ', checkSignatureNeero(req, WEBHOOK_SECRET))
        /*if (!checkSignatureNeero(req, WEBHOOK_SECRET)) {
            sendError(res, 401, 'Signature invalide')
            return
        }*/

        const event = req.body;
        console.log('Événement webhook reçu : ', event)

        // On enregistre le webhook event
        await neeroService.saveWebhookEvent(req)

        sendResponse(res, 200, 'Webhook reçu', true)

        // Webhook pour les transactions intents
        if (event.type == "transactionIntent.statusUpdated") {
            const transactionReference =  event.data.object.transactionIntentId.trim();
            const transaction = await transactionService.getTransactionByReference(String(transactionReference))

            if (
                mapNeeroStatusToSendo(event.data.object.newStatus) === "COMPLETED" || 
                mapNeeroStatusToSendo(event.data.object.status) === "COMPLETED"
            ) {
                const token = await notificationService.getTokenExpo(transaction?.user?.id ?? 0)
                if (
                    transaction?.type === 'DEPOSIT' && 
                    transaction.status === 'PENDING' &&
                    transaction.method === 'MOBILE_MONEY'
                ) {
                    const matricule = transaction.user!.wallet!.matricule;

                    // On crédite le montant chez le user
                    await walletService.creditWallet(
                        matricule,
                        transaction.amount,
                        "Dépôt sur le portefeuille",
                        transaction.userId,
                        transaction.id
                    )
                
                    transaction.status = 'COMPLETED'
                    await transaction.save()

                    // On check si la carte possede des dettes
                    await settleCardDebtsIfAny(matricule, transaction.user!.id)
                    
                    if (token) {
                        await notificationService.save({
                            title: 'Sendo',
                            content: `Votre recharge de ${transaction.amount} XAF s'est effectuée avec succès`,
                            userId: transaction?.user!.id,
                            status: 'SENDED',
                            token: token.token,
                            type: 'SUCCESS_DEPOSIT_WALLET'
                        })
                    }
                    await sendEmailWithHTML(
                        transaction?.user?.email ?? '',
                        'Recharge SENDO réussie',
                        `<p>Votre recharge du portefeuille de ${transaction.amount} XAF s'est effectuée avec succès</p>`
                    )
                } else if (
                    transaction?.type === 'WITHDRAWAL' && 
                    transaction.status === 'PENDING' &&
                    transaction.method === 'MOBILE_MONEY'
                ) {
                    // On débite le montant chez le user
                    await walletService.debitWallet(
                        transaction.user?.wallet?.matricule ?? '',
                        transaction.totalAmount,
                        "Retrait sur le portefeuille",
                        transaction.userId,
                        transaction.id
                    )
                    
                    transaction.status = 'COMPLETED'
                    await transaction.save()
                    
                    if (token) {
                        await notificationService.save({
                            title: 'Sendo',
                            content: `Votre retrait de ${transaction.amount} XAF s'est effectuée avec succès`,
                            userId: transaction?.user!.id,
                            status: 'SENDED',
                            token: token.token,
                            type: 'SUCCESS_WITHDRAWAL_WALLET'
                        })
                    }
                    await sendEmailWithHTML(
                        transaction?.user?.email ?? '',
                        'Retrait SENDO réussi',
                        `<p>Votre retrait de ${transaction.amount} XAF du portefeuille s'est effectué avec succès</p>`
                    )

                    // On envoie le gain si nécessaire
                    await mobileMoneyService.sendGiftForReferralCode(transaction.user!)
                } else if (
                    transaction?.type === 'WITHDRAWAL' && 
                    transaction.status === 'PENDING' &&
                    transaction.method === 'AGENT'
                ) {
                    const requestWithdraw = await merchantService.getRequestWithdrawByParams(
                        ajouterPrefixe237(transaction.accountNumber ?? ''), 
                        transaction.amount
                    );
                    
                    if (requestWithdraw) {
                        requestWithdraw.status = 'VALIDATED';
                        await requestWithdraw.save();
                    }

                    transaction.status = 'COMPLETED';
                    await transaction.save();

                    await sendEmailWithHTML(
                        transaction.user!.email,
                        'Retrait marchand',
                        `<p>Votre demande de retrait de ${transaction.amount} XAF a été validé et déposé sur votre compte mobile money</p>`,
                    )
                } else if (
                    transaction?.type === 'TRANSFER' && 
                    transaction.status === 'PENDING' &&
                    transaction.method === 'MOBILE_MONEY'
                ) {  
                    const amountToSend = Number(transaction.amount)

                    transaction.status = 'COMPLETED'
                    await transaction.save()
                    
                    const receiver = await transaction.getReceiver()
                    if (token) {
                        await notificationService.save({
                            title: 'Sendo',
                            type: 'INFORMATION',
                            content: `${transaction.user?.firstname} votre transfert d'argent de ${amountToSend} XAF a été envoyé à votre destinataire ${receiver?.firstname} ${receiver?.lastname}`,
                            userId: transaction.user!.id,
                            token: token.token,
                            status: 'SENDED'
                        })
                    }
                } else if (
                    transaction?.type === 'TRANSFER' && 
                    transaction.status === 'PENDING' &&
                    transaction.method === 'BANK_TRANSFER'
                ) {
                    const amountToDecrement = Number(transaction.amount)

                    //On décrémente le solde du portefeuille
                    await walletService.debitWallet(
                        transaction.user?.wallet?.matricule  || '',
                        amountToDecrement,
                        "Recharge par transfert bancaire",
                        transaction.userId,
                        transaction.id
                    )

                    transaction.status = 'COMPLETED'
                    await transaction.save()

                    const receiver = await transaction.getReceiver()
                    if (token) {
                        await notificationService.save({
                            title: 'Sendo',
                            type: 'INFORMATION',
                            content: `${transaction.user?.firstname} votre transfert bancaire de ${amountToDecrement} ${transaction.currency} a été envoyé à votre destinataire ${receiver?.firstname} ${receiver?.lastname}`,
                            userId: transaction.user!.id,
                            token: token.token,
                            status: 'SENDED'
                        })
                    }
                } else if (
                    transaction?.type === 'DEPOSIT' && 
                    transaction.status === 'PENDING' &&
                    transaction.method === 'VIRTUAL_CARD'
                ) {
                    /*const matricule = transaction.user!.wallet!.matricule;
                    const configFees = await configService.getConfigByName('SENDO_DEPOSIT_CARD_FEES')
                    const fees = configFees!.value
                    const amountNum = Number(transaction.amount)*/
                    const virtualCard = await cardService.getVirtualCard(undefined, undefined, transaction.userId)

                    /*await walletService.debitWallet(
                        matricule,
                        amountNum + Number(fees)
                    )*/
                    
                    // On met à jour le status de la carte
                    if (virtualCard && virtualCard.status === 'PRE_ACTIVE') {
                        await cardService.updateStatusCard(virtualCard.cardId, 'ACTIVE')
                    }

                    transaction.status = 'COMPLETED'
                    await transaction.save()
    
                    // Envoyer une notification
                    const token = await notificationService.getTokenExpo(transaction.user!.id)
                    if (token) {
                        await notificationService.save({
                            title: 'Sendo',
                            content: `Votre recharge de ${transaction.amount} XAF s'est effectuée avec succès`,
                            userId: transaction.user!.id,
                            status: 'SENDED',
                            token: token.token,
                            type: 'SUCCESS_DEPOSIT_CARD'
                        })
                    }
                    await sendEmailWithHTML(
                        transaction?.user?.email ?? '',
                        'Recharge de carte Sendo',
                        `<p>Votre recharge de ${transaction.amount} XAF sur la carte **** **** **** ${virtualCard?.last4Digits} s'est effectuée avec succès</p>`
                    )
                } else if (
                    transaction?.type === 'WITHDRAWAL' &&
                    transaction.status === 'PENDING' &&
                    transaction.method === 'VIRTUAL_CARD'
                ) {
                    const matricule = transaction.user!.wallet!.matricule;
                    const amountNum = Number(transaction.amount)
                    const virtualCard = await cardService.getVirtualCard(undefined, undefined, transaction.userId)
    
                    // Envoyer une notification
                    const token = await notificationService.getTokenExpo(transaction.user!.id)
                    if (
                        transaction.amount > 0 && 
                        transaction.description == 'Retrait sur la carte'
                    ) {
                        await walletService.creditWallet(
                            matricule,
                            amountNum,
                            "Retrait sur la carte",
                            transaction.userId,
                            transaction.id
                        )

                        if (token) {
                            await notificationService.save({
                                title: 'Sendo',
                                content: `Votre retrait de ${transaction.totalAmount} XAF sur la carte **** **** **** ${virtualCard?.last4Digits} s'est effectué avec succès`,
                                userId: transaction.user!.id,
                                status: 'SENDED',
                                token: token.token,
                                type: 'SUCCESS_WITHDRAWAL_CARD'
                            })
                        }
                    } else if (
                        transaction.description.includes("Paiement par Sendo de la dette") &&
                        transaction.amount == 0
                    ) {
                        const debt = await debtService.getOneDebt(virtualCard!.id)
                        if (debt && debt.amount <= Number(transaction.totalAmount)) {
                            await debt!.destroy()
                        } else if (debt && debt.amount > Number(transaction.totalAmount)) {
                            debt.amount = debt.amount - Number(transaction.totalAmount);
                            await debt.save();
                        }
                        
                        if (token) {
                            await notificationService.save({
                                title: 'Sendo',
                                content: `${transaction.description} d'un montant de ${transaction.totalAmount} XAF`,
                                userId: transaction.user!.id,
                                status: 'SENDED',
                                token: token.token,
                                type: 'SUCCESS_WITHDRAWAL_CARD'
                            })
                        }
                    }
                    
                    transaction.status = 'COMPLETED'
                    await transaction.save()
                } else if (
                    transaction?.type === 'VIEW_CARD_DETAILS' &&
                    transaction.status === 'PENDING' &&
                    transaction.method === 'VIRTUAL_CARD'
                ) {
                    transaction.status = 'COMPLETED';
                    await transaction.save();
                } else if (
                    transaction?.type === 'PAYMENT' &&
                    transaction.status === 'PENDING' &&
                    transaction.method === 'VIRTUAL_CARD'
                ) {
                    if (transaction.card!.paymentRejectNumber > 1) {
                        transaction.card!.paymentRejectNumber = 0;
                        await transaction.card!.save();
                    }
                    transaction.status = 'COMPLETED';
                    await transaction.save();
                }
            } else if (
                mapNeeroStatusToSendo(event.data.object.newStatus) === "FAILED" ||
                mapNeeroStatusToSendo(event.data.object.status) === "FAILED"
            ) {
                if (
                    transaction && 
                    transaction.status === 'PENDING' &&
                    transaction.type === 'PAYMENT' &&
                    transaction.method === 'VIRTUAL_CARD'
                ) {
                    // on enregistre le reste comme dette
                    const debt: VirtualCardDebtCreate = {
                        amount: transaction.sendoFees,
                        userId: transaction.userId,
                        cardId: transaction.virtualCardId,
                        intitule: transaction.description || 'Frais de service'
                    }
                    await cardService.saveDebt(debt)

                    transaction.status = 'FAILED';
                    await transaction.save();
                } else if (
                    transaction &&
                    transaction.type === 'WITHDRAWAL' && 
                    transaction.status === 'PENDING' &&
                    transaction.method === 'AGENT'
                ) {
                    const requestWithdraw = await merchantService.getRequestWithdrawByParams(
                        ajouterPrefixe237(transaction.accountNumber ?? ''), 
                        transaction.amount
                    );
                    if (requestWithdraw && requestWithdraw.status !== 'VALIDATED') {
                        requestWithdraw.status = 'FAILED';
                        await requestWithdraw.save();
                    }
                }

                const token = await notificationService.getTokenExpo(transaction!.user!.id)
                if (token) {
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Votre opération n'a pas été un succès`,
                        userId: transaction!.user!.id,
                        status: 'SENDED',
                        token: token.token,
                        type: 'ERROR'
                    })
                }
            }

            // Webhook pour les onboarding session
        } else if (event.type == "partyOnboardingSession.statusUpdated") {
            const session = await cardService.getPartySession(
                undefined, 
                undefined, 
                event.data.object.sessionKey
            )
            const token = await notificationService.getTokenExpo(session!.user!.id)
            if (event.data.object.newStatus === "VERIFIED") {
                if (token) {
                    await notificationService.save({
                        title: 'Sendo',
                        content: `${session?.user?.firstname} votre requête de création de carte a été validée. Vous pouvez maintenant créer votre carte`,
                        userId: session!.user!.id,
                        status: 'SENDED',
                        token: token.token,
                        type: 'SUCCESS_ONBOARDING_PARTY'
                    })
                }
                await sendEmailWithHTML(
                    session?.user?.email ?? '',
                    'Requête de carte SENDO',
                    `<p>${session?.user?.firstname} votre requête de création de carte a été validée</p>`
                )
            } else if (event.data.object.newStatus === "UNDER_VERIFICATION") {
                if (token) {
                    await notificationService.save({
                        title: 'Sendo',
                        content: `${session?.user?.firstname} votre requête de création de carte est en cours de traitement`,
                        userId: session!.user!.id,
                        status: 'SENDED',
                        token: token.token,
                        type: 'ERROR'
                    })
                }
                await sendEmailWithHTML(
                    session?.user?.email ?? '',
                    'Requête de carte SENDO',
                    `<p>${session?.user?.firstname} votre requête de création de carte est en cours de traitement</p>`
                )
            } else if (event.data.object.newStatus === "REFUSED_TIMEOUT") {
                if (token) {
                    await notificationService.save({
                        title: 'Sendo',
                        content: `${session?.user?.firstname} votre requête de création de carte a expiré faute d'envoi de documents.`,
                        userId: session!.user!.id,
                        status: 'SENDED',
                        token: token.token,
                        type: 'ERROR'
                    })
                }
                await sendEmailWithHTML(
                    session?.user?.email ?? '',
                    'Requête de carte SENDO',
                    `<p>${session?.user?.firstname} votre requête de création de carte a expiré faute d'envoi de documents.</p>`
                )
            }
            // On met a jour le status de la session party
            await cardService.updatePartySession({
                sessionId: event.data.object.sessionKey,
                status: event.data.object.newStatus
            })
        } else if (event.type == "cardManagement.onlineTransactions") {
            // Webhook pour les cartes virtuelles
            const amountNum = Number(event.data.object.totalAmount)
            const currency = event.data.object.transactionOriginCurrencyCode
            let exchangeRates: ConfigModel | null = null;
            if (currency == 'CAD') {
                exchangeRates = await configService.getConfigByName('EXCHANGE_RATES_FEES_CAD')
            } else if (currency == 'EUR') {
                exchangeRates = await configService.getConfigByName('EXCHANGE_RATES_FEES_EUR')
            } else if (currency == 'USD') {
                exchangeRates = await configService.getConfigByName('EXCHANGE_RATES_FEES_USD')
            } else if (currency == 'JPY') {
                exchangeRates = await configService.getConfigByName('EXCHANGE_RATES_FEES_YEN')
            } else {
                exchangeRates = await configService.getConfigByName('EXCHANGE_RATES_FEES')
            }
            const totalAmountWithEchangeRates = amountNum * (Number(exchangeRates?.value ?? 0) / 100) // 1
            const feesCard = await configService.getConfigByName('SENDO_TRANSACTION_CARD_FEES') // 2
            const feesCardPercentage = await configService.getConfigByName('SENDO_TRANSACTION_CARD_PERCENTAGE') // 3
            const totalAmountWithFeesCardPercentage = (amountNum + totalAmountWithEchangeRates) * (Number(feesCardPercentage?.value ?? 0) / 100) // 3
            const virtualCard = await cardService.getVirtualCard(event.data.object.cardId, undefined, undefined)
            const token = await notificationService.getTokenExpo(virtualCard?.user?.id ?? 0)
            const sendoFees = totalAmountWithEchangeRates + Number(feesCard?.value ?? 0) + totalAmountWithFeesCardPercentage

            try {
                // On enregistre la transaction
                if (mapNeeroStatusToSendo(event.data.object.status) === 'COMPLETED') {
                    // On enregistre la transaction réussie
                    const transactionToCreate: TransactionCreate = {
                        type: 'PAYMENT',
                        amount: Number(event.data.object.totalAmount),
                        status: "COMPLETED",
                        userId: virtualCard!.userId,
                        currency: event.data.object.cardCurrencyCode,
                        totalAmount: Number(event.data.object.totalAmount),
                        method: typesMethodTransaction['2'],
                        transactionReference: event.data.object.transactionId,
                        virtualCardId: virtualCard?.id,
                        description: event.data.object.reference,
                        partnerFees: 200,
                        provider: 'CARD',
                        receiverId: virtualCard!.userId,
                        receiverType: 'User',
                        exchangeRates: totalAmountWithEchangeRates,
                        createdAt: event.data.object.transactionDate
                    }
                    await transactionService.createTransaction(transactionToCreate)

                    await sendEmailWithHTML(
                        virtualCard?.user?.email ?? '',
                        'Paiement sur la carte',
                        `<p>Un paiement de ${Number(event.data.object.totalAmount)} XAF vient d'etre effectué avec succès sur votre carte **** **** **** ${virtualCard?.last4Digits}</p>`
                    )
                    
                    if (token) {
                        await notificationService.save({
                            title: 'Sendo',
                            content: `Un paiement de ${Number(event.data.object.totalAmount)} XAF vient d'etre effectué avec succès sur votre carte **** **** **** ${virtualCard?.last4Digits}`,
                            userId: virtualCard!.userId,
                            status: 'SENDED',
                            token: token.token,
                            type: 'SUCCESS_WITHDRAWAL_CARD'
                        })
                    }

                    const card = await cardService.getPaymentMethodCard(virtualCard?.id ?? 0)
                    let balanceObject = null;
                    if (card && card.paymentMethod && card.paymentMethod.paymentMethodId) {
                        balanceObject = await cardService.getBalance(card.paymentMethod.paymentMethodId);
                    }
                    
                    const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()

                    // Si la carte a assez de fonds pour prélever les frais SENDO
                    if (
                        balanceObject.balance &&
                        (Number(balanceObject.balance) >= roundToNextMultipleOfFive(sendoFees)) &&
                        virtualCard
                    ) {
                        // On prélève les frais SENDO sur la transaction
                        const payload: CashInPayload = {
                            amount: roundToNextMultipleOfFive(sendoFees),
                            currencyCode: 'XAF',
                            confirm: true,
                            paymentType: 'NEERO_CARD_CASHOUT',
                            sourcePaymentMethodId: card!.paymentMethod!.paymentMethodId,
                            destinationPaymentMethodId: paymentMethodMerchant?.paymentMethodId
                        }
                        await cashinService.init(
                            payload, 
                            roundToNextMultipleOfFive(sendoFees), 
                            event.data.object, 
                            virtualCard, 
                            token!, 
                            false
                        )
                    } else if (
                        balanceObject.balance &&
                        (Number(balanceObject.balance) < Number(sendoFees)) && 
                        Number(balanceObject.balance) > 0 &&
                        virtualCard
                    ) {
                        // Si la carte n'a pas assez de fonds pour prélever les frais, on prélève tout ce qu'elle a
                        const payload: CashInPayload = {
                            amount: roundToPreviousMultipleOfFive(Number(balanceObject.balance)),
                            currencyCode: 'XAF',
                            confirm: true,
                            paymentType: 'NEERO_CARD_CASHOUT',
                            sourcePaymentMethodId: card!.paymentMethod!.paymentMethodId,
                            destinationPaymentMethodId: paymentMethodMerchant?.paymentMethodId
                        }
                        await cashinService.init(
                            payload, 
                            roundToPreviousMultipleOfFive(Number(balanceObject.balance)), 
                            event.data.object, 
                            virtualCard, 
                            token!, 
                            false
                        )

                        // ensuite on vérifie si le wallet possède de l'argent
                        const user = await userService.getUserById(virtualCard!.user!.id)
                        const result = (Number(sendoFees) - roundToPreviousMultipleOfFive(Number(balanceObject.balance || 0)))
                        if (user!.wallet!.balance > 0 && user!.wallet!.balance > result) {
                            const transactionToCreate: TransactionCreate = {
                                type: 'PAYMENT',
                                amount: 0,
                                status: "COMPLETED",
                                userId: virtualCard?.user?.id ?? 0,
                                currency: event.data.object.cardCurrencyCode,
                                totalAmount: troisChiffresApresVirgule(result),
                                method: typesMethodTransaction['2'],
                                transactionReference: event.data.object.transactionId,
                                virtualCardId: virtualCard?.id,
                                description: `Frais de service #${event.data.object.reference}`,
                                provider: 'CARD',
                                receiverId: virtualCard?.user?.id ?? 0,
                                receiverType: 'User',
                                sendoFees: troisChiffresApresVirgule(result)
                            }
                            const transaction = await transactionService.createTransaction(transactionToCreate)

                            await walletService.debitWallet(
                                user!.wallet!.matricule,
                                troisChiffresApresVirgule(result),
                                "Paiement dette de la carte",
                                user?.id,
                                transaction.id
                            )
                        } else if (user!.wallet!.balance > 0 && user!.wallet!.balance < result) {
                            const transactionToCreate: TransactionCreate = {
                                type: 'PAYMENT',
                                amount: 0,
                                status: "COMPLETED",
                                userId: virtualCard?.user?.id ?? 0,
                                currency: event.data.object.cardCurrencyCode,
                                totalAmount: Number(user!.wallet!.balance),
                                method: typesMethodTransaction['2'],
                                transactionReference: event.data.object.transactionId,
                                virtualCardId: virtualCard?.id,
                                description: `Frais de service #${event.data.object.reference}`,
                                provider: 'CARD',
                                receiverId: virtualCard?.user?.id ?? 0,
                                receiverType: 'User',
                                sendoFees: Number(user!.wallet!.balance)
                            }
                            const transaction = await transactionService.createTransaction(transactionToCreate)

                            await walletService.debitWallet(
                                user!.wallet!.matricule,
                                Number(user!.wallet!.balance),
                                "Paiement dette de la carte",
                                user?.id,
                                transaction.id
                            )

                            // on enregistre le reste comme dette
                            const debt: VirtualCardDebtCreate = {
                                amount: troisChiffresApresVirgule(result) - Number(user!.wallet!.balance),
                                userId: virtualCard?.user?.id ?? 0,
                                cardId: virtualCard?.id ?? 0,
                                intitule: event.data.object.reference || 'Frais de rejet'
                            }
                            await cardService.saveDebt(debt)
                        } else {
                            // sinon on enregistre la dette
                            const debt: VirtualCardDebtCreate = {
                                amount: troisChiffresApresVirgule(result),
                                userId: virtualCard?.user?.id ?? 0,
                                cardId: virtualCard?.id ?? 0,
                                intitule: event.data.object.reference || 'Frais de rejet'
                            }
                            await cardService.saveDebt(debt)
                        }
                    } 
                } else if (mapNeeroStatusToSendo(event.data.object.status) === 'FAILED') {
                    const rejectFeesCard = await configService.getConfigByName('SENDO_TRANSACTION_CARD_REJECT_FEES')
                    if (!virtualCard) throw new Error("Carte introuvable");

                    // On enregistre tout d'abord la dette
                    const debt: VirtualCardDebtCreate = {
                        amount: Number(rejectFeesCard!.value),
                        userId: virtualCard.user!.id,
                        cardId: virtualCard.id,
                        intitule: event.data.object.reference || 'Frais de rejet du partenaire'
                    }
                    const dette = await cardService.saveDebt(debt)
    
                    virtualCard.paymentRejectNumber! += 1;
                    await virtualCard.save();

                    const paymentMethod = await cardService.getPaymentMethod(undefined, undefined, virtualCard.id)
                    if (!paymentMethod) return;
                    const balanceObject = await cardService.getBalance(paymentMethod.paymentMethodId)

                    // Vérifier dès maintenant si suppression nécessaire (après incrémentation)
                    const shouldTerminateCard = virtualCard.paymentRejectNumber >= 2;

                    const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
                    if (!paymentMethodMerchant) return;

                    // S'il a assez de fonds pour payer, on paie
                    if (
                        rejectFeesCard && 
                        balanceObject.balance &&
                        (Number(balanceObject.balance) >= Number(rejectFeesCard.value)) &&
                        virtualCard
                    ) {
                        const payload: CashInPayload = {
                            amount: roundToNextMultipleOfFive(Number(rejectFeesCard.value)),
                            currencyCode: 'XAF',
                            confirm: true,
                            paymentType: 'NEERO_CARD_CASHOUT',
                            sourcePaymentMethodId: paymentMethod.paymentMethodId,
                            destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
                        }

                        await cashinService.init(
                            payload, 
                            Number(rejectFeesCard.value), 
                            event.data.object, 
                            virtualCard, 
                            token!, 
                            true, 
                            virtualCard.userId
                        )

                        // On supprime la dette
                        await dette.destroy();

                        await sendEmailWithHTML(
                            virtualCard?.user?.email ?? '',
                            'Paiement sur la carte',
                            `<p>Un paiement de ${Number(event.data.object.totalAmount)} XAF vient d'échouer sur votre carte **** **** **** ${virtualCard?.last4Digits}</p>`
                        )

                        // On remet le paymentRejectNumber de la carte à 0
                        virtualCard.paymentRejectNumber = 0;
                        await virtualCard.save();

                        if (token) {
                            await notificationService.save({
                                title: 'Sendo',
                                content: `Un paiement de ${Number(event.data.object.totalAmount)} XAF vient d'échouer sur votre carte **** **** **** ${virtualCard?.last4Digits}`,
                                userId: virtualCard!.userId,
                                status: 'SENDED',
                                token: token.token,
                                type: 'PAYMENT_FAILED'
                            })
                        }
                    } else if (
                        rejectFeesCard &&
                        balanceObject.balance &&
                        (Number(balanceObject.balance) < Number(rejectFeesCard.value))
                    ) {
                        // ensuite on vérifie si le wallet possède de l'argent
                        // On débite les frais de rejet
                        const user = await userService.getUserById(virtualCard!.user!.id)
                        if (Number(user!.wallet!.balance) > Number(rejectFeesCard!.value)) {
                            const transactionToCreate: TransactionCreate = {
                                type: 'PAYMENT',
                                amount: 0,
                                status: "COMPLETED",
                                userId: virtualCard?.user?.id ?? 0,
                                currency: 'XAF',
                                totalAmount: Number(rejectFeesCard!.value),
                                method: typesMethodTransaction['2'],
                                transactionReference: event.id,
                                virtualCardId: virtualCard?.id,
                                description: `Frais de rejet : #${event.data.object.denialReason}`,
                                provider: 'CARD',
                                receiverId: virtualCard?.user?.id ?? 0,
                                receiverType: 'User',
                                sendoFees: Number(rejectFeesCard!.value) - 335,
                                partnerFees: 335
                            }
                            const transaction = await transactionService.createTransaction(transactionToCreate)

                            await walletService.debitWallet(
                                user!.wallet!.matricule,
                                Number(rejectFeesCard!.value),
                                "Paiement frais de rejet",
                                transaction.userId,
                                transaction.id
                            )

                            // On supprime la dette
                            await dette.destroy();

                            // On remet le paymentRejectNumber de la carte à 0
                            virtualCard.paymentRejectNumber = 0;
                            await virtualCard.save();
                        } else {
                            // On retire ce qu'il y a dans la carte
                            if (balanceObject.balance && Number(balanceObject.balance) > 0) {
                                const payload: CashInPayload = {
                                    amount: roundToPreviousMultipleOfFive(Number(balanceObject.balance)),
                                    currencyCode: 'XAF',
                                    confirm: true,
                                    paymentType: 'NEERO_CARD_CASHOUT',
                                    sourcePaymentMethodId: paymentMethod.paymentMethodId,
                                    destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
                                }

                                await cashinService.init(
                                    payload, 
                                    roundToPreviousMultipleOfFive(Number(balanceObject.balance)), 
                                    event.data.object, 
                                    virtualCard, 
                                    token!, 
                                    true, 
                                    virtualCard.userId
                                )
                            }

                            // Et puis le reste, on rétire ce qu'il y a dans le wallet
                            const newValueDette = Number(rejectFeesCard.value) - roundToPreviousMultipleOfFive(Number(balanceObject.balance));
                            if (Number(user!.wallet!.balance) > newValueDette) {
                                const transactionToCreate: TransactionCreate = {
                                    type: 'PAYMENT',
                                    amount: 0,
                                    status: "COMPLETED",
                                    userId: virtualCard?.user?.id ?? 0,
                                    currency: 'XAF',
                                    totalAmount: newValueDette,
                                    method: typesMethodTransaction['2'],
                                    transactionReference: event.id,
                                    virtualCardId: virtualCard?.id,
                                    description: `Frais de rejet : #${event.data.object.denialReason}`,
                                    provider: 'CARD',
                                    receiverId: virtualCard?.user?.id ?? 0,
                                    receiverType: 'User',
                                    sendoFees: newValueDette
                                }
                                const transaction = await transactionService.createTransaction(transactionToCreate)
                                
                                await walletService.debitWallet(
                                    user!.wallet!.matricule,
                                    newValueDette,
                                    "Paiement frais de rejet",
                                    transaction.userId,
                                    transaction.id
                                )

                                // On supprime la dette
                                await dette.destroy();

                                // On remet le paymentRejectNumber de la carte à 0
                                virtualCard.paymentRejectNumber = 0;
                                await virtualCard.save();
                            } else {
                                const transactionToCreate: TransactionCreate = {
                                    type: 'PAYMENT',
                                    amount: 0,
                                    status: 'FAILED',
                                    userId: virtualCard?.user?.id ?? 0,
                                    currency: 'XAF',
                                    totalAmount: Number(user!.wallet!.balance),
                                    method: typesMethodTransaction['2'],
                                    transactionReference: event.id,
                                    virtualCardId: virtualCard?.id,
                                    description: `Frais de rejet : #${event.data.object.denialReason}`,
                                    provider: 'CARD',
                                    receiverId: virtualCard?.user?.id ?? 0,
                                    receiverType: 'User',
                                    sendoFees: Number(user!.wallet!.balance)
                                }
                                const transaction = await transactionService.createTransaction(transactionToCreate)

                                await walletService.debitWallet(
                                    user!.wallet!.matricule,
                                    Number(user!.wallet!.balance),
                                    "Paiement frais de rejet",
                                    transaction.userId,
                                    transaction.id
                                )

                                // On met à jour la dette
                                dette.amount = Number(user!.wallet!.balance) - newValueDette;
                                await dette.save();
                            }

                            if (shouldTerminateCard) {
                                await cardService.handleCardTermination(
                                    virtualCard, 
                                    event.data.object,
                                    paymentMethod,
                                    paymentMethodMerchant
                                );
                            }
                        }

                        await sendEmailWithHTML(
                            virtualCard?.user?.email ?? '',
                            'Paiement sur la carte',
                            `<p>Un paiement de ${Number(event.data.object.totalAmount)} XAF vient d'échouer sur votre carte **** **** **** ${virtualCard?.last4Digits}. Une dette de ${rejectFeesCard.value} XAF vient d'être enregistrée.</p>`
                        )
                        
                        if (token) {
                            await notificationService.save({
                                title: 'Sendo',
                                content: `Un paiement de ${Number(event.data.object.totalAmount)} XAF vient d'échouer sur votre carte **** **** **** ${virtualCard?.last4Digits}. Une dette de ${rejectFeesCard.value} XAF vient d'être enregistrée.`,
                                userId: virtualCard!.userId,
                                status: 'SENDED',
                                token: token.token,
                                type: 'PAYMENT_FAILED'
                            })
                        }
                    }
                }
            } catch (error) {
                logger.info("Error lors de la vérification des transactions online", {
                    amount: amountNum,
                    card: `${virtualCard!.cardName} - ${virtualCard!.cardId}`
                });
            }
        }
    }

    async getEvents(req: Request, res: Response) {
        const { page, limit, startIndex, startDate, endDate, type } = res.locals.pagination;
        try {

            const events = await neeroService.getWebhookEvents(limit, startIndex, startDate, endDate);

            // Parser la propriété content de chaque enregistrement
            const parsedItems = events.rows.map(event => {
                const parsedContent = event.content ? JSON.parse(event.content) : null;
                return {
                    ...event.toJSON(),
                    content: parsedContent
                };
            });

            // Filtrer par type si spécifié
            const filteredItems = type ? parsedItems.filter(event =>
                event.content && event.content.type === type
            ) : parsedItems;

            const totalItems = filteredItems.length;
            const totalPages = Math.ceil(totalItems / limit);

            // Pagination basique en mémoire après filtrage
            const pagedItems = filteredItems.slice(startIndex, startIndex + limit);

            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: events.count,
                items: pagedItems
            };

            sendResponse(res, 200, 'Webhook events récupérés', responseData);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getEventById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            if (!id) {
                sendError(res, 401, "Veuillez fournir l'ID du webhook", {});
                return;
            }

            const event = await neeroService.getWebhookEventById(Number(id));
            if (!event) {
                sendError(res, 404, 'Webhook introuvable', {});
                return;
            }

            // Parser la propriété content
            const parsedContent = event.content ? JSON.parse(event.content) : null;
            const eventWithParsedContent = {
                ...event.toJSON(),
                content: parsedContent
            };

            sendResponse(res, 200, 'Webhook event récupéré', eventWithParsedContent);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

}

export default new WebhookController()