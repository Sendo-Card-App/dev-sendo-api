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
                                    
            await wait(5000)
        
            const checkTransaction = await neeroService.getTransactionIntentById(cashin.id)

            const total = troisChiffresApresVirgule(Number(object.totalAmount) + arrondiSuperieur(sendoFees))

            if (!isFailed) {
                if (
                    checkTransaction.statusUpdates.some((update: any) => update.status === "SUCCESSFUL")
                ) {
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
                } else {
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
                }
            } else {
                if (
                    checkTransaction.statusUpdates.some((update: any) => update.status === "SUCCESSFUL")
                ) {
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