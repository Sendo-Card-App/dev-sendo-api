import axios from 'axios';
import { S3PAuth } from './smobilPay';
import { 
    CashinCashout, 
    CollectPayload, 
    CollectResult, 
    Destination, 
    QuoteResult, 
    ResultTransaction 
} from '../types/SmobilPay';
import neeroService, { PaymentMethodCreate, PaymentMethodPayload } from './neeroService';
import { ApiErrorResponse, PaymentErrorResponse } from '../utils/apiResponse';
import UserModel from '../models/user.model';
import PaymentMethodModel from '../models/payment-method.model';
import { detectOtherMoneyTransferType } from '../utils/functions';
import ReferralCodeModel from '@models/referral-code.model';
import { col, fn, literal, Op, where } from 'sequelize';
import WalletModel from '@models/wallet.model';
import configService from './configService';
import walletService from './walletService';
import { TransactionCreate } from '../types/Transaction';
import { typesCurrency, typesMethodTransaction, typesTransaction } from '@utils/constants';
import transactionService from './transactionService';
import { sendGlobalEmail } from './emailService';
import notificationService from './notificationService';


class MobileMoneyService {
    private auth: S3PAuth;
    private baseUrl: string;  

    public constructor() {
        const publicToken = process.env.PUBLIC_TOKEN_SMOBILPAY || '';
        const accessSecret = process.env.SECRET_SMOBILPAY || '';
        this.baseUrl = process.env.BASE_URL_SMOBILPAY || '';
        
        if (!publicToken || !accessSecret || !this.baseUrl) {
            throw new Error('Configuration Smobilpay manquante dans les variables d\'environnement');
        }

        this.auth = new S3PAuth({
            publicToken,
            accessSecret,
            baseUrl: this.baseUrl,
        });
    }

    /**
     * Effectue une requête GET vers l'endpoint 'cashout' or 'cashin' avec authentification S3P
     * @param serviceId Identifiant du service à interroger
     * @returns Données de la réponse API
     */
    public async getCashinOrCashout(serviceId: string | number, type: 'cashin' | 'cashout'): Promise<CashinCashout[]> {
        const endpoint = type;
        const method = 'GET';
        const params = { serviceid: serviceId.toString() };

        // Construction de l'URL complète avec query string
        const url = new URL(endpoint, this.baseUrl);
        Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

        // Générer l'en-tête Authorization
        const authHeader = this.auth.getAuthorizationHeader(method, endpoint, params);

        try {
            const response = await axios.get(url.toString(), {
                headers: {
                    Authorization: authHeader,
                },
                maxBodyLength: Infinity,
            });
            return response.data;
        } catch (error: any) {
            throw error.response.data || error;
        }
    }

    /**
     * Requête GET vers l'endpoint 'destination' avec deux paramètres et authentification S3P
     * @param destination Numéro de destination (ex : numéro de téléphone)
     * @param serviceId Identifiant du service
     * @returns Données retournées par l'API
     */
    public async getDestination(destination: string, serviceId: string): Promise<Destination> {
        const endpoint = 'validate';
        const method = 'GET';
        const params = {
            destination,
            serviceId: serviceId
        };

        // Construction de l'URL avec les paramètres de requête
        const url = new URL(endpoint, this.baseUrl);
        Object.entries(params).forEach(([key, value]) =>
            url.searchParams.append(key, value)
        );

        // Génération de l'en-tête Authorization
        const authHeader = this.auth.getAuthorizationHeader(method, endpoint, params);

        try {
            const response = await axios.get(url.toString(), {
                headers: {
                    Authorization: authHeader,
                },
                maxBodyLength: Infinity,
            });
            return response.data;
        } catch (error: ApiErrorResponse | PaymentErrorResponse | any) {
            throw error.response.data || error;
        }
    }

    /**
     * Requête POST vers l'endpoint 'quotestd' avec authentification S3P
     * @param payItemId Identifiant du pay item
     * @param amount Montant à payer
     * @returns Données retournées par l'API
     */
    public async postQuote(payItemId: string, amount: number): Promise<QuoteResult> {
        const endpoint = 'quotestd';
        const method = 'POST';
        const data = {
            payItemId,
            amount
        };

        // Générer l'en-tête Authorization avec les données du corps
        const authHeader = this.auth.getAuthorizationHeader(method, endpoint, data);

        try {
            const response = await axios.post(this.baseUrl + endpoint, data, {
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                },
                maxBodyLength: Infinity,
            });
            return response.data;
        } catch (error: any) {
            throw error.response.data || error;
        }
    }

    /**
     * Requête POST vers l'endpoint 'collectstd' avec authentification S3P
     * @param collectData Objet contenant les données du collect
     * @returns Données retournées par l'API
     */
    public async postCollect(collectData: CollectPayload): Promise<CollectResult> {
        const endpoint = 'collectstd';
        const method = 'POST';

        // Générer l'en-tête Authorization avec les données du corps
        const authHeader = this.auth.getAuthorizationHeader(method, endpoint, collectData);

        try {
            //Requête finale
            const response = await axios.post(this.baseUrl + endpoint, collectData, {
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                },
                maxBodyLength: Infinity,
            });
            return response.data;
        } catch (error: any) {
            throw error.response.data || error;
        }
    }

    /**
     * Requête GET vers l'endpoint 'verifytx' avec authentification S3P
     * @param trid Identifiant de la transaction à vérifier
     * @returns Données retournées par l'API
     */
    public async getVerifyTx(trid: string): Promise<ResultTransaction[]> {
        const endpoint = 'verifytx';
        const method = 'GET';
        const params = { trid };

        // Construction de l'URL complète avec query string
        const url = new URL(endpoint, this.baseUrl);
        Object.entries(params).forEach(([key, value]) =>
            url.searchParams.append(key, value)
        );

        // Générer l'en-tête Authorization
        const authHeader = this.auth.getAuthorizationHeader(method, endpoint, params);

        try {
            const response = await axios.get(url.toString(), {
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                },
                maxBodyLength: Infinity,
            });
            return response.data;
        } catch (error: any) {
            throw error.response.data || error;
        }
    }

    public async getPaymentMethodUser(userId: number) {
        return UserModel.findByPk(userId, {
            include: [
                { model: PaymentMethodModel, as: 'paymentMethods' }
            ]
        })
    }

    public async getPaymentMethodByPhone(phone: string) {
        return PaymentMethodModel.findOne({
            where: {
                phone
            }
        })
    }

    public async createPaymentMethod(phoneNumber: string, userId?: number) {
        const payloadPaymentMethod: PaymentMethodPayload = {
            type: 'MOBILE_MONEY',
            mobileMoneyDetails: {
                phoneNumber,
                countryIso: 'CM',
                mobileMoneyProvider: detectOtherMoneyTransferType(phoneNumber)
            }
        }
        const paymentMethod = await neeroService.createPaymentMethod(payloadPaymentMethod)
        
        if (!paymentMethod.id) {
            throw new Error("L'identifiant du moyen de paiement est manquant.");
        }

        const paymentMethodModel: PaymentMethodCreate = {
            type: 'MOBILE_MONEY',
            paymentMethodId: paymentMethod.id,
            phone: phoneNumber,
            userId
        }
        
        return await neeroService.findOrSavePaymentMethod(paymentMethodModel)
    }
    
    public async hasUsedReferralCode(userId: number) {
        const referrals = await ReferralCodeModel.findAll({
            where: {
                isUsed: false,
                [Op.and]: [
                    where(fn('LENGTH', col('usedBy')), '>', 0)
                ]
            },
            include: [
                {
                    model: WalletModel,
                    as: 'wallet'
                },
                {
                    model: UserModel,
                    as: 'owner',
                    attributes: ['id', 'email', 'firstName', 'lastName']
                }
            ]
        });

        for (const ref of referrals) {
            const usedBy = ref.usedBy || []; 
            const exists = usedBy.some(
                (item: { userId: number; isUsed: boolean }) => (item.userId === userId && item.isUsed === false)
            );
            if (exists) return { referralExists: !!ref, referral: ref };
        }

        return { referralExists: false, referral: null };
    }

    public async sendGiftForReferralCode(user: UserModel) {
        // Vérification de l'utilisation de son code de parrainage
        const response = await this.hasUsedReferralCode(user.id);
        const config = await configService.getConfigByName("SPONSORSHIP_FEES");
        if (
            response.referralExists && 
            config && 
            user.wallet &&
            response.referral
        ) {
            //On crédite les portefeuilles concernés
            await walletService.creditWallet(response.referral.wallet!.matricule, Number(config.value));
            const transactionToRefferer: TransactionCreate = {
                amount: Number(config.value),
                type: typesTransaction['10'],
                status: 'COMPLETED',
                userId: response.referral.userId,
                currency: typesCurrency['0'],
                totalAmount: Number(config.value),
                method: typesMethodTransaction['3'],
                description: "Gain de parrainage",
                receiverId: response.referral.userId,
                receiverType: 'User'
            }
            await transactionService.createTransaction(transactionToRefferer)
            await sendGlobalEmail(
                response.referral.owner?.email || '',
                'Nouveau gain de parrainage',
                `<p>Félicitations ! Vous avez reçu un gain de parrainage de ${config.value} XAF dans votre portefeuille. Continuez à parrainer pour plus de récompenses !<p>`
            );
            const tokenReferral = await notificationService.getTokenExpo(response.referral.userId)
            await notificationService.save({
                title: 'Sendo',
                content: `Félicitations ! Vous avez reçu un gain de parrainage de ${config.value} XAF dans votre portefeuille. Continuez à parrainer pour plus de récompenses !`,
                userId: response.referral.userId,
                status: 'SENDED',
                token: tokenReferral?.token ?? '',
                type: 'MARKETING'
            })

            await walletService.creditWallet(user.wallet.matricule, Number(config.value));
            const transactionToReceiver: TransactionCreate = {
                amount: Number(config.value),
                type: typesTransaction['10'],
                status: 'COMPLETED',
                userId: user.id,
                currency: typesCurrency['0'],
                totalAmount: Number(config.value),
                method: typesMethodTransaction['3'],
                description: "Gain de parrainage",
                receiverId: user.id,
                receiverType: 'User'
            }
            await transactionService.createTransaction(transactionToReceiver)
            await sendGlobalEmail(
                user.email,
                'Gain de parrainage',
                `<p>Félicitations ! Vous avez reçu un gain de parrainage de ${config.value} XAF dans votre portefeuille.<p>`
            );
            const tokenReceiver = await notificationService.getTokenExpo(user.id)
            await notificationService.save({
                title: 'Sendo',
                content: `Félicitations ! Vous avez reçu un gain de parrainage de ${config.value} XAF dans votre portefeuille.`,
                userId: user.id,
                status: 'SENDED',
                token: tokenReceiver?.token ?? '',
                type: 'MARKETING'
            })

            // On met à jour la propriété isUsed du code de parrainage
            await response.referral.update({
                isUsed: true,
                usedBy: response.referral.usedBy.map((item: { userId: number; isUsed: boolean }) => {
                    if (item.userId === user.id) {
                        return { ...item, isUsed: true };
                    }
                    return item;
                })
            });
        }
    }
}

export default new MobileMoneyService();