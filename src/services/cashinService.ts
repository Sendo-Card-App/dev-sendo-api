import { wait } from "@controllers/mobileMoneyController";
import neeroService, { CashInPayload } from "./neeroService";
import { mapNeeroStatusToSendo, troisChiffresApresVirgule } from "@utils/functions";
import notificationService from "./notificationService";
import VirtualCardModel from "@models/virtualCard.model";
import TokenModel from "@models/token.model";
import { sendEmailWithHTML } from "./emailService";
import { typesCurrency, typesMethodTransaction, typesTransaction } from "@utils/constants";
import transactionService from "./transactionService";
import cardService, { VirtualCardDebtCreate } from "./cardService";
import configService from "./configService";
import sequelize from "@config/db";


class CashinService {
    async init(
        cashinPayload: CashInPayload, 
        sendoFees: number, 
        object: any, 
        virtualCard: VirtualCardModel, 
        token: TokenModel,
        isFailed: boolean,
        userId?: number
    ) {
        const transaction = await sequelize.transaction()
        try {
            const cashin = await neeroService.createCashInPayment(cashinPayload)
            
            let checkTransaction = await neeroService.getTransactionIntentById(cashin.id)

            let attempts = 0;
            while (attempts < 5 && !['COMPLETED', 'FAILED'].includes(mapNeeroStatusToSendo(checkTransaction.status))) {
                await wait(1000);
                checkTransaction = await neeroService.getTransactionIntentById(cashin.id);
                attempts++;
            }
        
            //console.log('checkTransaction cashinService : ', checkTransaction)

            const total = troisChiffresApresVirgule(Number(object.totalAmount) + sendoFees)

            if (!isFailed) {
                if (
                    mapNeeroStatusToSendo(checkTransaction.status) === "COMPLETED" ||
                    checkTransaction.statusUpdates.some((update: any) => update.status === "SUCCESSFUL")
                ) {
                    // On enregistre la transaction du paiement des frais
                    await transactionService.createTransaction({
                        type: 'PAYMENT',
                        amount: 0,
                        status: "COMPLETED",
                        userId: virtualCard.userId,
                        currency: object.cardCurrencyCode,
                        totalAmount: sendoFees,
                        method: typesMethodTransaction['2'],
                        transactionReference: cashin.id,
                        virtualCardId: virtualCard?.id,
                        description: `Frais de service #${object.reference}`,
                        provider: 'CARD',
                        receiverId: virtualCard.userId,
                        receiverType: 'User',
                        sendoFees,
                        createdAt: new Date(object.transactionDate),
                        bankName: object.merchantCity,
                        accountNumber: object.transactionOriginAmount
                    }, { transaction })

                    // On envoie la notification
                    if (token) {
                        await notificationService.save({
                            title: 'Sendo',
                            content: `${virtualCard?.user?.firstname} un paiement de ${total} ${object.cardCurrencyCode} vient d'être effectué sur votre carte virtuelle **** **** **** ${virtualCard?.last4Digits}`,
                            userId: virtualCard!.user!.id,
                            status: 'SENDED',
                            token: token.token,
                            type: 'SUCCESS_TRANSACTION_CARD'
                        })
                    }
                    await sendEmailWithHTML(
                        virtualCard?.user?.email ?? '',
                        'Paiement sur la carte',
                        `<p>${virtualCard?.user?.firstname} un paiement de ${total} ${object.cardCurrencyCode} vient d'être effectué sur votre carte virtuelle **** **** **** ${virtualCard?.last4Digits}</p>`
                    )
                } else if (
                    mapNeeroStatusToSendo(checkTransaction.status) === "FAILED" ||
                    checkTransaction.statusUpdates.some((update: any) => update.status === "FAILED")
                ) {
                    // On enregistre la transaction des frais échouée
                    await transactionService.createTransaction({
                        type: 'PAYMENT',
                        amount: 0,
                        status: "FAILED",
                        userId: virtualCard.userId,
                        currency: object.cardCurrencyCode,
                        totalAmount: sendoFees,
                        method: typesMethodTransaction['2'],
                        transactionReference: cashin.id,
                        virtualCardId: virtualCard.id,
                        description: `Frais de service #${object.reference}`,
                        provider: 'CARD',
                        receiverId: virtualCard.userId,
                        receiverType: 'User',
                        sendoFees,
                        createdAt: new Date(object.transactionDate),
                        bankName: object.merchantCity,
                        accountNumber: object.transactionOriginAmount
                    }, { transaction })

                    // on enregistre le reste comme dette
                    const debt: VirtualCardDebtCreate = {
                        amount: sendoFees,
                        userId: virtualCard.userId,
                        cardId: virtualCard.id,
                        intitule: object.reference || 'Frais de service'
                    }
                    await cardService.saveDebt(debt)

                    // On envoie la notification
                    if (token) {
                        await notificationService.save({
                            title: 'Sendo',
                            content: `${virtualCard?.user?.firstname} un paiement de ${troisChiffresApresVirgule(Number(object.totalAmount))} ${object.cardCurrencyCode} vient d'être effectué sur votre carte virtuelle **** **** **** ${virtualCard?.last4Digits}. Les frais Sendo n'ont pas pû être prélevés sur votre carte, par conséquent vous avez une dette de ${sendoFees} XAF enregistrée.`,
                            userId: virtualCard.userId,
                            status: 'SENDED',
                            token: token.token,
                            type: 'SUCCESS_TRANSACTION_CARD'
                        })
                    }
                    await sendEmailWithHTML(
                        virtualCard?.user?.email ?? '',
                        'Paiement sur la carte',
                        `<p>${virtualCard?.user?.firstname} un paiement de ${troisChiffresApresVirgule(Number(object.totalAmount))} ${object.cardCurrencyCode} vient d'être effectué sur votre carte virtuelle **** **** **** ${virtualCard?.last4Digits}. Les frais Sendo n'ont pas pû être prélevés sur votre carte, par conséquent vous avez une dette de ${sendoFees} XAF enregistrée.</p>`
                    )
                } else {
                    await transactionService.createTransaction({
                        amount: 0,
                        type: typesTransaction['3'],
                        status: mapNeeroStatusToSendo(checkTransaction.status),
                        userId: userId!,
                        currency: typesCurrency['0'],
                        totalAmount: sendoFees,
                        method: typesMethodTransaction['2'],
                        transactionReference: cashin.id,
                        virtualCardId: virtualCard!.id,
                        description: `Frais de service #${object.reference}`,
                        receiverId: userId!,
                        receiverType: 'User',
                        sendoFees,
                        bankName: object.merchantCity,
                        accountNumber: object.transactionOriginAmount
                    }, { transaction })
                }
            } else {
                const rejectFeesCard = await configService.getConfigByName('SENDO_TRANSACTION_CARD_REJECT_FEES')
                
                if (mapNeeroStatusToSendo(checkTransaction.status) === "COMPLETED") {
                    await transactionService.createTransaction({
                        amount: 0,
                        type: typesTransaction['3'],
                        status: 'COMPLETED',
                        userId: userId!,
                        currency: typesCurrency['0'],
                        totalAmount: sendoFees,
                        method: typesMethodTransaction['2'],
                        transactionReference: cashin.id,
                        virtualCardId: virtualCard!.id,
                        description: `Frais de rejet : #${object.denialReason}`,
                        receiverId: userId!,
                        receiverType: 'User',
                        sendoFees: Number(rejectFeesCard?.value || 400) - 335,
                        partnerFees: 335,
                        bankName: object.merchantCity,
                        accountNumber: object.transactionOriginAmount
                    }, { transaction })

                    if (virtualCard.paymentRejectNumber > 1) {
                        virtualCard.paymentRejectNumber = 0;
                        await virtualCard.save();
                    }
                    await sendEmailWithHTML(
                        virtualCard?.user?.email ?? '',
                        'Paiement sur la carte',
                        `<p>${virtualCard?.user?.firstname}, des frais de rejet de ${Number(rejectFeesCard?.value || 400)} XAF viennent d'être prélevés sur votre carte **** **** **** ${virtualCard?.last4Digits} pour la transaction #${object.reference}</p>`
                    )

                    // Envoyer une notification
                    const token = await notificationService.getTokenExpo(virtualCard!.user!.id)
                    if (token) {
                        await notificationService.save({
                            title: 'Sendo',
                            content: `Des frais de rejet de ${Number(rejectFeesCard?.value || 400)} XAF viennent d'être prélevés sur votre carte **** **** **** ${virtualCard?.last4Digits} pour la transaction #${object.reference}`,
                            userId: virtualCard!.user!.id,
                            status: 'SENDED',
                            token: token.token,
                            type: 'PAYMENT_FAILED'
                        })
                    }
                } else {
                    await transactionService.createTransaction({
                        amount: 0,
                        type: typesTransaction['3'],
                        status: mapNeeroStatusToSendo(checkTransaction.status),
                        userId: userId!,
                        currency: typesCurrency['0'],
                        totalAmount: sendoFees,
                        method: typesMethodTransaction['2'],
                        transactionReference: cashin.id,
                        virtualCardId: virtualCard!.id,
                        description: `Frais de rejet : #${object.denialReason}`,
                        receiverId: userId!,
                        receiverType: 'User',
                        sendoFees: Number(rejectFeesCard?.value || 400) - 335,
                        partnerFees: 335
                    }, { transaction })

                    await sendEmailWithHTML(
                        virtualCard?.user?.email ?? '',
                        'Paiement sur la carte',
                        `<p>${virtualCard?.user?.firstname}, des frais de rejet de ${checkTransaction.totalAmount} XAF n'ont pas pû être prélevés sur votre carte **** **** **** ${virtualCard?.last4Digits} pour la transaction #${object.reference}</p>`
                    )

                    // Envoyer une notification
                    const token = await notificationService.getTokenExpo(virtualCard!.user!.id)
                    if (token) {
                        await notificationService.save({
                            title: 'Sendo',
                            content: `Des frais de rejet de ${checkTransaction.totalAmount} XAF n'ont pas pû être prélevés sur votre carte **** **** **** ${virtualCard?.last4Digits} pour la transaction #${object.reference}`,
                            userId: virtualCard!.user!.id,
                            status: 'SENDED',
                            token: token.token,
                            type: 'PAYMENT_FAILED'
                        })
                    }
                }
            }
        } catch (error: any) {
            await transaction.rollback(); 
            throw error;
        } finally {
            await transaction.commit();  
        }
    }
}

export default new CashinService()