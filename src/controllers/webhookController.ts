import logger from "@config/logger";
import cardService, { VirtualCardDebtCreate } from "@services/cardService";
import { sendEmailWithHTML } from "@services/emailService";
import notificationService from "@services/notificationService";
import transactionService from "@services/transactionService";
import walletService, { settleCardDebtsIfAny } from "@services/walletService";
import { TransactionCreate } from "../types/Transaction";
import { sendResponse } from "@utils/apiResponse";
import { arrondiSuperieur, checkSignatureNeero, mapNeeroStatusToSendo, troisChiffresApresVirgule } from "@utils/functions";
import { Request, Response } from "express";
import configService from "@services/configService";
import neeroService, { CashInPayload } from "@services/neeroService";
import { wait } from "./mobileMoneyController";
import { typesCurrency, typesMethodTransaction, typesTransaction } from "@utils/constants";
import PaymentMethodModel from "@models/payment-method.model";
import { CardPayload } from "../types/Neero";
import userService from "@services/userService";
import cashinService from "@services/cashinService";

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

        // Webhook pour les transactions intents
        if (event.type === "transactionIntent.statusUpdated") {
            const transactionReference =  event.data.object.transactionIntentId.trim();
            console.log(`transaction intent id :${transactionReference}`)
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
                        transaction.amount
                    )
                
                    transaction.status = 'COMPLETED'
                    await transaction.save()

                    // On check si la carte possede des dettes
                    console.log('On check si la carte possede des dettes')
                    await settleCardDebtsIfAny(matricule, transaction.user!.id)
                    
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Votre recharge de ${transaction.amount} XAF s'est effectuée avec succès`,
                        userId: transaction?.user?.id ?? 0,
                        status: 'SENDED',
                        token: token?.token ?? '',
                        type: 'SUCCESS_DEPOSIT_WALLET'
                    })
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
                        transaction.totalAmount
                    )
                    
                    transaction.status = 'COMPLETED'
                    await transaction.save()
                    
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Votre retrait de ${transaction.amount} XAF s'est effectuée avec succès`,
                        userId: transaction?.user?.id ?? 0,
                        status: 'SENDED',
                        token: token?.token ?? '',
                        type: 'SUCCESS_WITHDRAWAL_WALLET'
                    })
                    await sendEmailWithHTML(
                        transaction?.user?.email ?? '',
                        'Retrait SENDO réussi',
                        `<p>Votre retrait de ${transaction.amount} XAF du portefeuille s'est effectué avec succès</p>`
                    )
                } else if (
                    transaction?.type === 'TRANSFER' && 
                    transaction.status === 'PENDING'
                ) {
                    const configCadReal = await configService.getConfigByName('CAD_REAL_TIME_VALUE')
                    const amountToSend = Number(transaction.amount) * Number(configCadReal!.value)
                    const receiver = await transaction.getReceiver()
                    await notificationService.save({
                        title: 'Sendo',
                        type: 'INFORMATION',
                        content: `${transaction.user?.firstname} votre transfert d'argent de ${amountToSend} XAF a été envoyé à votre destinataire ${receiver?.firstname} ${receiver?.lastname}`,
                        userId: transaction.user?.id ?? 0,
                        token: token?.token ?? '',
                        status: 'SENDED'
                    })
                } else if (
                    transaction?.type === 'DEPOSIT' && 
                    transaction.status === 'PENDING' &&
                    transaction.method === 'VIRTUAL_CARD'
                ) {
                    const matricule = transaction.user!.wallet!.matricule;
                    const configFees = await configService.getConfigByName('SENDO_DEPOSIT_CARD_FEES')
                    const fees = configFees!.value
                    const amountNum = Number(transaction.amount)
                    const virtualCard = await cardService.getVirtualCard(event.data.object.cardId, undefined, undefined)

                    await walletService.debitWallet(
                        matricule,
                        amountNum + Number(fees)
                    )
                    
                    // On met à jour le status de la carte
                    if (virtualCard && virtualCard.status === 'PRE_ACTIVE') {
                        await cardService.updateStatusCard(virtualCard.id, 'ACTIVE')
                    }
    
                    // Envoyer une notification
                    const token = await notificationService.getTokenExpo(transaction.user!.id)
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Votre recharge de ${transaction.amount} XAF s'est effectuée avec succès`,
                        userId: transaction.user!.id,
                        status: 'SENDED',
                        token: token?.token ?? '',
                        type: 'SUCCESS_DEPOSIT_CARD'
                    })
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
                    const virtualCard = await cardService.getVirtualCard(event.data.object.cardId, undefined, undefined)

                    await walletService.creditWallet(
                        matricule,
                        amountNum
                    )
    
                    // Envoyer une notification
                    const token = await notificationService.getTokenExpo(transaction.user!.id)
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Votre retrait de ${transaction.amount} XAF sur la carte **** **** **** ${virtualCard?.last4Digits} s'est effectué avec succès`,
                        userId: transaction.user!.id,
                        status: 'SENDED',
                        token: token?.token ?? '',
                        type: 'SUCCESS_WITHDRAWAL_CARD'
                    })
                }
            } else if (
                mapNeeroStatusToSendo(event.data.object.newStatus) === "FAILED" ||
                mapNeeroStatusToSendo(event.data.object.status) === "FAILED"
            ) {
                const token = await notificationService.getTokenExpo(transaction?.user?.id ?? 0)
                await notificationService.save({
                    title: 'Sendo',
                    content: `Votre opération n'a pas été un succès`,
                    userId: transaction?.user?.id ?? 0,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'ERROR'
                })
            }

            // Webhook pour les onboarding session
        } else if (event.type === "partyOnboardingSession.statusUpdated") {
            const session = await cardService.getPartySession(
                undefined, 
                undefined, 
                event.data.object.sessionKey
            )
            const token = await notificationService.getTokenExpo(session?.user?.id ?? 0)
            if (event.data.object.newStatus === "VERIFIED") {
                await notificationService.save({
                    title: 'Sendo',
                    content: `${session?.user?.firstname} votre requête de création de carte a été validée. Vous pouvez maintenant créer votre carte`,
                    userId: session?.user?.id ?? 0,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'SUCCESS_ONBOARDING_PARTY'
                })
                await sendEmailWithHTML(
                    session?.user?.email ?? '',
                    'Requête de carte SENDO',
                    `<p>${session?.user?.firstname} votre requête de création de carte a été validée</p>`
                )
            } else if (event.data.object.newStatus === "UNDER_VERIFICATION") {
                await notificationService.save({
                    title: 'Sendo',
                    content: `${session?.user?.firstname} votre requête de création de carte est en cours de traitement`,
                    userId: session?.user?.id ?? 0,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'ERROR'
                })
                await sendEmailWithHTML(
                    session?.user?.email ?? '',
                    'Requête de carte SENDO',
                    `<p>${session?.user?.firstname} votre requête de création de carte est en cours de traitement</p>`
                )
            } else if (event.data.object.newStatus === "REFUSED_TIMEOUT") {
                await notificationService.save({
                    title: 'Sendo',
                    content: `${session?.user?.firstname} votre requête de création de carte a expiré faute d'envoi de documents.`,
                    userId: session?.user?.id ?? 0,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'ERROR'
                })
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

        } else if (event.type === "cardManagement.onlineTransactions") {
            // Webhook pour les cartes virtuelles
            const amountNum = Number(event.data.object?.transactionOriginAmount) || Number(event.data.object?.baseAmount)
            console.log("amount num : ", amountNum)
            const exchangeRates = await configService.getConfigByName('EXCHANGE_RATES_FEES')
            const totalAmountWithEchangeRates = amountNum * (Number(exchangeRates!.value) / 100) // 1
            console.log("exchange rates fees : ", totalAmountWithEchangeRates)
            const feesCard = await configService.getConfigByName('SENDO_TRANSACTION_CARD_FEES') // 2
            console.log("feees card : ", Number(feesCard!.value))
            const feesCardPercentage = await configService.getConfigByName('SENDO_TRANSACTION_CARD_PERCENTAGE') // 3
            const totalAmountWithFeesCardPercentage = (amountNum + totalAmountWithEchangeRates) * (Number(feesCardPercentage!.value) / 100) // 3
            console.log("transaction card percentage : ", totalAmountWithFeesCardPercentage)
            const virtualCard = await cardService.getVirtualCard(event.data.object.cardId, undefined, undefined)
            const token = await notificationService.getTokenExpo(virtualCard?.user?.id ?? 0)
            const sendoFees = totalAmountWithEchangeRates + Number(feesCard!.value) + totalAmountWithFeesCardPercentage
            console.log("frais sendo : ", sendoFees)

            try {
                // On enregistre la transaction
                if (mapNeeroStatusToSendo(event.data.object.status) === 'COMPLETED') {
                    console.log("on entre dans le success")
                    const card = await cardService.getPaymentMethodCard(virtualCard?.id ?? 0)
                    let balanceObject = null;
                    console.log("on check le solde de la carte virtuelle")
                    if (card && card.paymentMethod && card.paymentMethod.paymentMethodId) {
                        balanceObject = await cardService.getBalance(card.paymentMethod.paymentMethodId);
                    }
                    
                    const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()

                    // Si la carte a assez de fonds pour prélever les frais SENDO
                    if (
                        (Number(balanceObject.balance) >= arrondiSuperieur(sendoFees)) &&
                        virtualCard
                    ) {
                        console.log("la balance de la carte couvre les frais sendo")
                        // On prélève les frais SENDO sur la transaction
                        const payload: CashInPayload = {
                            amount: arrondiSuperieur(sendoFees),
                            currencyCode: 'XAF',
                            confirm: true,
                            paymentType: 'NEERO_CARD_CASHOUT',
                            sourcePaymentMethodId: card!.paymentMethod!.paymentMethodId,
                            destinationPaymentMethodId: paymentMethodMerchant?.paymentMethodId
                        }
                        await cashinService.init(
                            payload, 
                            arrondiSuperieur(sendoFees), 
                            event.data.object, 
                            virtualCard, 
                            token!, 
                            false
                        )
                    } else if (
                        (Number(balanceObject.balance) < arrondiSuperieur(sendoFees)) && 
                        Number(balanceObject.balance) > 0 &&
                        virtualCard
                    ) {
                        console.log("la balance de la carte ne couvre pas les frais sendo")
                        // Si la carte n'a pas assez de fonds pour prélever les frais, on prélève tout ce qu'elle a
                        const payload: CashInPayload = {
                            amount: Number(balanceObject.balance),
                            currencyCode: 'XAF',
                            confirm: true,
                            paymentType: 'NEERO_CARD_CASHOUT',
                            sourcePaymentMethodId: card!.paymentMethod!.paymentMethodId,
                            destinationPaymentMethodId: paymentMethodMerchant?.paymentMethodId
                        }
                        await cashinService.init(
                            payload, 
                            Number(balanceObject.balance), 
                            event.data.object, 
                            virtualCard, 
                            token!, 
                            false
                        )

                        // ensuite on vérifie si le wallet possède de l'argent
                        console.log("on vérifie si le wallet possède de l'argent")
                        const user = await userService.getUserById(virtualCard!.user!.id)
                        const result = (arrondiSuperieur(sendoFees) - Number(balanceObject.balance || 0))
                        if (user!.wallet!.balance > 0 && user!.wallet!.balance > result) {
                            console.log("le wallet couvre le reste des frais sendo")
                            await walletService.debitWallet(
                                user!.wallet!.matricule,
                                troisChiffresApresVirgule(result)
                            )
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
                                description: event.data.object.reference,
                                partnerFees: Number(event.data.object.totalAmount) - amountNum,
                                provider: 'CARD',
                                receiverId: virtualCard?.user?.id ?? 0,
                                receiverType: 'User',
                                sendoFees: troisChiffresApresVirgule(result)
                            }
                            await transactionService.createTransaction(transactionToCreate)
                        } else if (user!.wallet!.balance > 0 && user!.wallet!.balance < result) {
                            console.log("on retire tout ce qu'il y a sur le wallet pour payer les frais")
                            await walletService.debitWallet(
                                user!.wallet!.matricule,
                                Number(user!.wallet!.balance)
                            )
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
                                description: event.data.object.reference,
                                partnerFees: Number(event.data.object.totalAmount) - amountNum,
                                provider: 'CARD',
                                receiverId: virtualCard?.user?.id ?? 0,
                                receiverType: 'User',
                                sendoFees: Number(user!.wallet!.balance)
                            }
                            await transactionService.createTransaction(transactionToCreate)

                            // on enregistre le reste comme dette
                            const debt: VirtualCardDebtCreate = {
                                amount: troisChiffresApresVirgule(result) - Number(user!.wallet!.balance),
                                userId: virtualCard?.user?.id ?? 0,
                                cardId: virtualCard?.id ?? 0,
                                intitule: event.data.object.reference || 'Frais de rejet'
                            }
                            await cardService.saveDebt(debt)
                        } else {
                            console.log("le wallet ne couvre pas le reste des frais sendo")
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
                    
                    // On vérifie d'abord si la carte possède les fonds pour payer les frais de rejet
                    let paymentMethod: PaymentMethodModel | null = null;
                    if (virtualCard) {
                        paymentMethod = await cardService.getPaymentMethod(undefined, undefined, virtualCard.id)
                    }
                    if (!paymentMethod) {
                        throw new Error("Carte ou portefeuille Sendo introuvable")
                    }

                    const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
                    if (!paymentMethodMerchant) {
                        throw new Error("Erreur lors de la récupération de la source")
                    }

                    console.log("on check le solde de la carte virtuelle")
                    const balanceObject = await cardService.getBalance(paymentMethod.paymentMethodId)
                    // S'il a assez de fonds pour payer, on paie
                    if (
                        rejectFeesCard && 
                        balanceObject &&
                        (Number(balanceObject.balance) >= Number(rejectFeesCard.value)) &&
                        virtualCard && 
                        token
                    ) {
                        const payload: CashInPayload = {
                            amount: Number(rejectFeesCard.value),
                            currencyCode: 'XAF',
                            confirm: true,
                            paymentType: 'NEERO_CARD_CASHOUT',
                            sourcePaymentMethodId: paymentMethod.paymentMethodId,
                            destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
                        }

                        console.log("on lance la requête pour prélerver sur la carte les frais de rejet")
                        await cashinService.init(payload, rejectFeesCard.value, event.data.object, virtualCard, token, true, req.user!.id)
                    } else if (
                        rejectFeesCard &&
                        balanceObject &&
                        (Number(balanceObject.balance) < Number(rejectFeesCard.value))
                    ) {
                        // ensuite on vérifie si le wallet possède de l'argent
                        // On débite les frais de rejet
                        console.log("on vérifie si le wallet possède de l'argent")
                        const user = await userService.getUserById(virtualCard!.user!.id)
                        if (user!.wallet!.balance > Number(rejectFeesCard!.value)) {
                            await walletService.debitWallet(
                                user!.wallet!.matricule,
                                Number(rejectFeesCard!.value)
                            )
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
                                description: `Paiement des frais de rejet : #${event.data.object.reference}`,
                                provider: 'CARD',
                                receiverId: virtualCard?.user?.id ?? 0,
                                receiverType: 'User',
                                sendoFees: Number(rejectFeesCard!.value)
                            }
                            await transactionService.createTransaction(transactionToCreate)
                        } else {
                            console.log("on enregistre la dette car le wallet n'a pas assez d'argent")
                            // On rétire ce qu'il y a dans le wallet
                            if (user!.wallet!.balance > 1) {
                                await walletService.debitWallet(
                                    user!.wallet!.matricule,
                                    user!.wallet!.balance
                                )
                                const transactionToCreate: TransactionCreate = {
                                    type: 'PAYMENT',
                                    amount: 0,
                                    status: "COMPLETED",
                                    userId: virtualCard?.user?.id ?? 0,
                                    currency: 'XAF',
                                    totalAmount: user!.wallet!.balance,
                                    method: typesMethodTransaction['2'],
                                    transactionReference: event.id,
                                    virtualCardId: virtualCard?.id,
                                    description: `Paiement des frais de rejet : #${event.data.object.reference}`,
                                    provider: 'CARD',
                                    receiverId: virtualCard?.user?.id ?? 0,
                                    receiverType: 'User',
                                    sendoFees: user!.wallet!.balance
                                }
                                await transactionService.createTransaction(transactionToCreate)

                                // On enregistre la dette
                                const debt: VirtualCardDebtCreate = {
                                    amount: Number(rejectFeesCard!.value) - user!.wallet!.balance,
                                    userId: virtualCard?.user?.id ?? 0,
                                    cardId: virtualCard?.id ?? 0,
                                    intitule: event.data.object.reference || 'Frais de rejet du partenaire'
                                }
                                await cardService.saveDebt(debt)
                            } else {
                                // sinon on enregistre la dette
                                const debt: VirtualCardDebtCreate = {
                                    amount: Number(rejectFeesCard!.value),
                                    userId: virtualCard?.user?.id ?? 0,
                                    cardId: virtualCard?.id ?? 0,
                                    intitule: event.data.object.reference || 'Frais de rejet du partenaire'
                                }
                                await cardService.saveDebt(debt)
                            }
                            
                            // On incrémente le nombre de paiement rejeté sur la carte
                            if (virtualCard) {
                                console.log("on incrémente le nombre de paiement rejeté sur la carte")
                                virtualCard.paymentRejectNumber = virtualCard.paymentRejectNumber + 1;
                                await virtualCard.save();
                            }
                        }

                        // Si le nombre de paiement rejeté passe à 3 on bloque la carte
                        if (virtualCard && virtualCard.paymentRejectNumber === 3) {
                            // On retire tous les fonds restant sur la carte
                            const balanceObject = await cardService.getBalance(paymentMethod.paymentMethodId)
                            if (Number(balanceObject.balance) > 0) {
                                const cashinPayload: CashInPayload = {
                                    amount: Number(balanceObject.balance),
                                    currencyCode: 'XAF',
                                    confirm: true,
                                    paymentType: 'NEERO_CARD_CASHOUT',
                                    sourcePaymentMethodId: paymentMethod.paymentMethodId,
                                    destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
                                }

                                const cashin = await neeroService.createCashInPayment(cashinPayload)

                                const neeroTransaction = await neeroService.getTransactionIntentById(cashin.id)

                                await wait(5000)
                                
                                const checkTransaction = await neeroService.getTransactionIntentById(neeroTransaction.id)

                                if (
                                    checkTransaction.statusUpdates.some((update: any) => update.status === "SUCCESSFUL")
                                ) {
                                    await sendEmailWithHTML(
                                        virtualCard?.user?.email ?? '',
                                        'Vidange des fonds de la carte',
                                        `<p>Dépot de ${Number(balanceObject.balance)} XAF sur votre portefeuille représentant le solde total de votre carte virtuelle **** **** **** ${virtualCard.last4Digits}</p>`
                                    )

                                    // Envoyer une notification
                                    const token = await notificationService.getTokenExpo(virtualCard!.user!.id)
                                    await notificationService.save({
                                        title: 'Sendo',
                                        content: `Dépot de ${Number(balanceObject.balance)} XAF sur votre portefeuille représentant le solde total de votre carte virtuelle **** **** **** ${virtualCard.last4Digits}`,
                                        userId: virtualCard!.user!.id,
                                        status: 'SENDED',
                                        token: token?.token ?? '',
                                        type: 'SUCCESS_DEPOSIT_CARD'
                                    })
                                }
                                const transactionToCreate: TransactionCreate = {
                                    amount: Number(balanceObject.balance),
                                    type: typesTransaction['0'],
                                    status: mapNeeroStatusToSendo(checkTransaction.status),
                                    userId: req.user!.id,
                                    currency: typesCurrency['0'],
                                    totalAmount: Number(balanceObject.balance),
                                    method: typesMethodTransaction['2'],
                                    transactionReference: cashin.id,
                                    virtualCardId: virtualCard!.id,
                                    description: `Dépot des fonds de la carte sur le portefeuille`,
                                    receiverId: req.user!.id,
                                    receiverType: 'User'
                                }
                                await transactionService.createTransaction(transactionToCreate)
                            }
                            
                            // On supprime définitivement la carte
                            const payload: CardPayload = {
                                cardId: virtualCard.cardId,
                                cardCategory: 'VIRTUAL'
                            }
                            await cardService.deleteCard(payload)

                            await cardService.updateStatusCard(virtualCard.cardId, 'TERMINATED')

                            // Envoyer une notification
                            const token = await notificationService.getTokenExpo(virtualCard!.user!.id)
                            await notificationService.save({
                                title: 'Sendo',
                                content: `${virtualCard?.user?.firstname}, votre carte virtuelle **** **** **** ${virtualCard.last4Digits} a été bloquée suite à 3 paiements rejetés.`,
                                userId: virtualCard!.user!.id,
                                status: 'SENDED',
                                token: token?.token ?? '',
                                type: 'PAYMENT_FAILED'
                            })

                            await sendEmailWithHTML(
                                virtualCard?.user?.email ?? '',
                                'Carte virtuelle bloquée',
                                `<p>${virtualCard?.user?.firstname}, votre carte virtuelle **** **** **** ${virtualCard.last4Digits} a été supprimé suite à 3 paiements rejetés.</p>`
                            )
                        }
                    }
                }
            } catch (error) {
                console.error("Error lors de la vérification des transactions online : ", error)
                logger.info("Error lors de la vérification des transactions online", {
                    amount: amountNum,
                    card: `${virtualCard!.cardName} - ${virtualCard!.cardId}`
                });
            }
        } /*else if (event.type === "CASHOUT" && event.paymentType === "NEERO_CARD_CASHIN") {
            const transactionId = event.data.object.transactionIntentId
            const neeroTransaction = await neeroService.getTransactionIntentById(transactionId)
            const transaction = await transactionService.getTransactionByReference(transactionId)
            
            if (
                neeroTransaction.status === "SUCCESSFUL" &&
                transaction?.type === 'DEPOSIT' &&
                transaction.status === 'PENDING'
            ) {
                // On crédite le montant chez le user
                await walletService.debitWallet(
                    transaction?.user?.wallet?.matricule ?? '',
                    transaction.totalAmount
                )
                transaction.status = 'COMPLETED'
                transaction.save();

                // On envoie la notification
                const token = await notificationService.getTokenExpo(transaction?.user?.id ?? 0)
                await notificationService.save({
                    title: 'Sendo',
                    content: `${transaction?.user?.firstname} votre recharge de carte virtuelle a été effectuée avec succès`,
                    userId: transaction?.user?.id ?? 0,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'SUCCESS_DEPOSIT_CARD'
                })
                
            } else {
                const token = await notificationService.getTokenExpo(transaction?.user?.id ?? 0)
                await notificationService.save({
                    title: 'Sendo',
                    content: `Votre opération n'a pas été un succès`,
                    userId: transaction?.user?.id ?? 0,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'ERROR'
                })
            }
        } else if (event.type === "CASHIN" && event.paymentType === "NEERO_CARD_CASHOUT") {
            const transactionId = event.data.object.transactionIntentId
            const neeroTransaction = await neeroService.getTransactionIntentById(transactionId)
            const transaction = await transactionService.getTransactionByReference(transactionId)
            
            if (
                neeroTransaction.status === "SUCCESSFUL" &&
                transaction?.type === 'WITHDRAWAL' &&
                transaction.status === 'PENDING'
            ) {
                // On crédite le montant chez le user
                await walletService.creditWallet(
                    transaction?.user?.wallet?.matricule ?? '',
                    transaction.totalAmount
                )
                transaction.status = 'COMPLETED'
                transaction.save();

                // On envoie la notification
                const token = await notificationService.getTokenExpo(transaction?.user?.id ?? 0)
                await notificationService.save({
                    title: 'Sendo',
                    content: `Votre retrait de ${transaction.totalAmount} XAF s'est effectué avec succès`,
                    userId: transaction?.user?.id ?? 0,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'SUCCESS_WITHDRAWAL_CARD'
                })
                
            } else {
                const token = await notificationService.getTokenExpo(transaction?.user?.id ?? 0)
                await notificationService.save({
                    title: 'Sendo',
                    content: `Votre opération n'a pas été un succès`,
                    userId: transaction?.user?.id ?? 0,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'ERROR'
                })
            }
        }*/

        sendResponse(res, 200, 'Webhook reçu', true)
    }
}

export default new WebhookController()