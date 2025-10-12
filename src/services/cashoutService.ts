import { ajouterPrefixe237, detectMoneyTransferType, mapNeeroStatusToSendo, roundToPreviousMultipleOfFive } from "@utils/functions";
import mobileMoneyService from "./mobileMoneyService";
import neeroService, { CashOutPayload } from "./neeroService";
import transactionService from "./transactionService";
import configService from "./configService";
import { wait } from "@controllers/mobileMoneyController";
import notificationService from "./notificationService";


class CashoutService {
    async init(phone: string, transactionId: string) {
        try {
            const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
            if (!paymentMethodMerchant) {
                throw new Error("Erreur lors de la récupération de la source")
            }

            let created: boolean;
            const phoneParsed = ajouterPrefixe237(phone)
            const configCadReal = await configService.getConfigByName('CAD_REAL_TIME_VALUE')    

            let paymentMethodDestinataire = await mobileMoneyService.getPaymentMethodByPhone(phoneParsed)
            if (!paymentMethodDestinataire) {
                [paymentMethodDestinataire, created] = await mobileMoneyService.createPaymentMethod(phoneParsed)
            }

            const transaction = await transactionService.getTransaction(transactionId)
            if (!transaction) {
                throw new Error("Transaction initiale introuvable")
            }

            const amountToSend = Number(transaction.amount) * Number(configCadReal!.value)
            const payload: CashOutPayload = {
                amount: roundToPreviousMultipleOfFive(amountToSend),
                currencyCode: 'XAF',
                confirm: true,
                paymentType: detectMoneyTransferType(phone).transferType,
                sourcePaymentMethodId: paymentMethodMerchant?.paymentMethodId || '',
                destinationPaymentMethodId: paymentMethodDestinataire.paymentMethodId
            };

            const cashout = await neeroService.createCashOutPayment(payload)
            transaction.transactionReference = cashout.id;
            await transaction.save()
            await wait(5000)

            const neeroTransaction = await neeroService.getTransactionIntentById(cashout.id)
            
            transaction.status = mapNeeroStatusToSendo(neeroTransaction.status);
            await transaction.save()
            const newTransaction = await transaction.reload()

            const token = await notificationService.getTokenExpo(newTransaction.userId)
            if (
                newTransaction.type === 'TRANSFER' &&
                newTransaction.status === "COMPLETED"
            ) {
                const receiver = await transaction.getReceiver()
                await notificationService.save({
                    title: 'Sendo',
                    type: 'INFORMATION',
                    content: `${transaction.user?.firstname} votre transfert d'argent de ${amountToSend} XAF a été envoyé à votre destinataire ${receiver?.firstname} ${receiver?.lastname}`,
                    userId: transaction.user?.id ?? 0,
                    token: token?.token ?? '',
                    status: 'SENDED'
                })
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }
}

export default new CashoutService();