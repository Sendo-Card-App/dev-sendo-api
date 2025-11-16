import { wait } from "@controllers/mobileMoneyController";
import neeroService, { CashInPayload } from "./neeroService";
import { arrondiSuperieur, mapNeeroStatusToSendo, troisChiffresApresVirgule } from "@utils/functions";
import notificationService from "./notificationService";
import VirtualCardModel from "@models/virtualCard.model";
import TokenModel from "@models/token.model";
import { sendEmailWithHTML } from "./emailService";
import { TransactionCreate } from "../types/Transaction";
import { typesCurrency, typesMethodTransaction, typesTransaction } from "@utils/constants";
import transactionService from "./transactionService";
import cardService, { VirtualCardDebtCreate } from "./cardService";


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
        try {
            const cashin = await neeroService.createCashInPayment(cashinPayload)
        
            const checkTransaction = await neeroService.getTransactionIntentById(cashin.id)
            console.log('checkTransaction cashinService : ', checkTransaction)

            const total = troisChiffresApresVirgule(Number(object.totalAmount) + arrondiSuperieur(sendoFees))

            if (!isFailed) {
                if (checkTransaction.status === "SUCCESSFUL") {
                    // On enregistre la transaction du paiement des frais
                    const transactionToCreateFees: TransactionCreate = {
                        type: 'PAYMENT',
                        amount: 0,
                        status: "COMPLETED",
                        userId: virtualCard.userId,
                        currency: object.cardCurrencyCode,
                        totalAmount: sendoFees,
                        method: typesMethodTransaction['2'],
                        transactionReference: cashin.id,
                        virtualCardId: virtualCard?.id,
                        description: object.reference,
                        partnerFees: Number(object.totalAmount) - (Number(object.transactionOriginAmount) || Number(object.baseAmount)),
                        provider: 'CARD',
                        receiverId: virtualCard.userId,
                        receiverType: 'User',
                        sendoFees: sendoFees,
                        createdAt: new Date(object.transactionDate)
                    }
                    await transactionService.createTransaction(transactionToCreateFees)

                    // On envoie la notification
                    await notificationService.save({
                        title: 'Sendo',
                        content: `${virtualCard?.user?.firstname} un paiement de ${total} ${object.cardCurrencyCode} vient d'être effectué sur votre carte virtuelle **** **** **** ${virtualCard?.last4Digits}`,
                        userId: virtualCard?.user?.id ?? 0,
                        status: 'SENDED',
                        token: token?.token ?? '',
                        type: 'SUCCESS_TRANSACTION_CARD'
                    })
                    await sendEmailWithHTML(
                        virtualCard?.user?.email ?? '',
                        'Paiement sur la carte',
                        `<p>${virtualCard?.user?.firstname} un paiement de ${total} ${object.cardCurrencyCode} vient d'être effectué sur votre carte virtuelle **** **** **** ${virtualCard?.last4Digits}</p>`
                    )
                } else if (checkTransaction.status === "FAILED") {
                    // On enregistre la transaction des frais échouée
                    const transactionToCreateDebt: TransactionCreate = {
                        type: 'PAYMENT',
                        amount: 0,
                        status: "FAILED",
                        userId: virtualCard.userId,
                        currency: object.cardCurrencyCode,
                        totalAmount: sendoFees,
                        method: typesMethodTransaction['2'],
                        transactionReference: cashin.id,
                        virtualCardId: virtualCard.id,
                        description: object.reference,
                        partnerFees: Number(object.totalAmount) - (Number(object.transactionOriginAmount) || Number(object.baseAmount)),
                        provider: 'CARD',
                        receiverId: virtualCard.userId,
                        receiverType: 'User',
                        sendoFees: sendoFees,
                        createdAt: new Date(object.transactionDate)
                    }
                    await transactionService.createTransaction(transactionToCreateDebt)

                    // on enregistre le reste comme dette
                    const debt: VirtualCardDebtCreate = {
                        amount: sendoFees,
                        userId: virtualCard.userId,
                        cardId: virtualCard.id,
                        intitule: object.reference || 'Frais de service'
                    }
                    await cardService.saveDebt(debt)

                    // On envoie la notification
                    await notificationService.save({
                        title: 'Sendo',
                        content: `${virtualCard?.user?.firstname} un paiement de ${troisChiffresApresVirgule(Number(object.totalAmount))} ${object.cardCurrencyCode} vient d'être effectué sur votre carte virtuelle **** **** **** ${virtualCard?.last4Digits}. Les frais Sendo n'ont pas pû être prélevés sur votre carte, par conséquent vous avez une dette de ${sendoFees} XAF enregistrée.`,
                        userId: virtualCard.userId,
                        status: 'SENDED',
                        token: token?.token ?? '',
                        type: 'SUCCESS_TRANSACTION_CARD'
                    })
                    await sendEmailWithHTML(
                        virtualCard?.user?.email ?? '',
                        'Paiement sur la carte',
                        `<p>${virtualCard?.user?.firstname} un paiement de ${troisChiffresApresVirgule(Number(object.totalAmount))} ${object.cardCurrencyCode} vient d'être effectué sur votre carte virtuelle **** **** **** ${virtualCard?.last4Digits}. Les frais Sendo n'ont pas pû être prélevés sur votre carte, par conséquent vous avez une dette de ${sendoFees} XAF enregistrée.</p>`
                    )
                } else {
                    // On enregistre la transaction des frais échouée
                    const transactionToCreateDebt: TransactionCreate = {
                        type: 'PAYMENT',
                        amount: 0,
                        status: 'PENDING',
                        userId: virtualCard.userId,
                        currency: object.cardCurrencyCode,
                        totalAmount: sendoFees,
                        method: typesMethodTransaction['2'],
                        transactionReference: cashin.id,
                        virtualCardId: virtualCard.id,
                        description: object.reference,
                        partnerFees: Number(object.totalAmount) - (Number(object.transactionOriginAmount) || Number(object.baseAmount)),
                        provider: 'CARD',
                        receiverId: virtualCard.userId,
                        receiverType: 'User',
                        sendoFees: sendoFees,
                        createdAt: new Date(object.transactionDate)
                    }
                    await transactionService.createTransaction(transactionToCreateDebt)
                }
            } else {
                if (checkTransaction.status === "SUCCESSFUL") {
                    await sendEmailWithHTML(
                        virtualCard?.user?.email ?? '',
                        'Paiement sur la carte',
                        `<p>${virtualCard?.user?.firstname}, des frais de rejet de ${checkTransaction.amount} XAF viennent d'être prélevés sur votre carte **** **** **** ${virtualCard?.last4Digits} pour la transaction #${object.reference}</p>`
                    )

                    // Envoyer une notification
                    const token = await notificationService.getTokenExpo(virtualCard!.user!.id)
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Des frais de rejet de ${checkTransaction.totalAmount} XAF viennent d'être prélevés sur votre carte **** **** **** ${virtualCard?.last4Digits} pour la transaction #${object.reference}`,
                        userId: virtualCard!.user!.id,
                        status: 'SENDED',
                        token: token?.token ?? '',
                        type: 'PAYMENT_FAILED'
                    })
                } else {
                    await sendEmailWithHTML(
                        virtualCard?.user?.email ?? '',
                        'Paiement sur la carte',
                        `<p>${virtualCard?.user?.firstname}, des frais de rejet de ${checkTransaction.totalAmount} XAF n'ont pas pû être prélevés sur votre carte **** **** **** ${virtualCard?.last4Digits} pour la transaction #${object.reference}</p>`
                    )

                    // Envoyer une notification
                    const token = await notificationService.getTokenExpo(virtualCard!.user!.id)
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Des frais de rejet de ${checkTransaction.totalAmount} XAF n'ont pas pû être prélevés sur votre carte **** **** **** ${virtualCard?.last4Digits} pour la transaction #${object.reference}`,
                        userId: virtualCard!.user!.id,
                        status: 'SENDED',
                        token: token?.token ?? '',
                        type: 'PAYMENT_FAILED'
                    })
                }
                const transactionToCreate: TransactionCreate = {
                    amount: 0,
                    type: typesTransaction['3'],
                    status: mapNeeroStatusToSendo(checkTransaction.status),
                    userId: userId!,
                    currency: typesCurrency['0'],
                    totalAmount: sendoFees,
                    method: typesMethodTransaction['2'],
                    transactionReference: cashin.id,
                    virtualCardId: virtualCard!.id,
                    description: `Paiement des frais de rejet : #${object.reference}`,
                    receiverId: userId!,
                    receiverType: 'User',
                    sendoFees: sendoFees
                }
                await transactionService.createTransaction(transactionToCreate)
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
}

export default new CashinService()