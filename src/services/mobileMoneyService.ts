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
    
}

export default new MobileMoneyService();