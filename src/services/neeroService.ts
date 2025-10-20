import axios, { AxiosError } from 'axios';
import { NeeroApiError } from '../utils/apiResponse';
import PaymentMethodModel from '../models/payment-method.model';
import { CardPayload, CreateCardPayload, FreezeCardPayload, PartyObject, UploadDocumentsPayload, UploadDocumentsResponse } from '../types/Neero';
import FormData from 'form-data';
const { Readable } = require('node:stream');
import 'dotenv-flow/config';
import 'module-alias/register';

interface PayPalDetails {
    email: string;
    countryIso: string;
}

interface MobileMoneyDetails {
  phoneNumber: string;
  countryIso: string;
  mobileMoneyProvider: 'ORANGE_MONEY' | 'MTN_MONEY';
}

interface NeeroMerchantDetails {
  merchantKey: string;
  storeId: string;
  balanceId: string;
  operatorId: number;
}

interface PersonDetails {
  personId: number;
  accountId: string;
  paymentRequestId: string | null;
}

interface PersonDetailsWithPhoneNumber {
  countryCode: string;
  phoneNumber: string;
}

interface PaypalDetails {
  email: string;
  countryIso: string;
}

export interface PaymentMethodPayload {
  type: string;
  mobileMoneyDetails?: MobileMoneyDetails;
  neeroMerchantDetails?: NeeroMerchantDetails;
  personDetails?: PersonDetails;
  personDetailsWithPhoneNumber?: PersonDetailsWithPhoneNumber;
  paypalDetails?: PaypalDetails;
}

export interface PaymentMethodCardPayload {
  type: 'NEERO_CARD';
  neeroCardDetails: {
    cardId: number | string;
    cardCategory: 'VIRTUAL';
  }
}

export interface PaymentMethodResult {
    id: string;
    createdAt: string;
    updatedAt: string;
    metadata: Record<string, unknown>;
    operatorDetails: {
        operatorId: string | null;
        merchantKey: string;
    };
    active: boolean;
    type: string;
    walletTypeProductName: string;
    mobileMoneyDetails: {
        countryCode: string;
    };
    neeroPersonDetails: {
        personId: string | null;
        accountId: string;
        country: string;
        paymentRequestId: string | null;
    };
    neeroMerchantDetails: {
        merchantKey: string;
        storeId: string;
        balanceId: string;
        operatorId: string | null;
        country: string;
    };
    paypalDetails: {
        email: string;
        countryCode: string;
    };
    shortInfo: string;
    walletId: string | null;
}

interface Customer {
  name: string;
  email: string;
  phone: string;
}

interface FlowTransaction {
  amount: number;
  currencyCode: string;
  paymentType: string;
  sourcePaymentMethodId: string;
  destinationPaymentMethodId: string;
  transactionType: string;
}

interface DisplayInfo {
  name: string;
  imageUrl: string;
}

export interface CashInPayload {
  amount: number;
  currencyCode: string;
  paymentType: string;
  sourcePaymentMethodId?: string;
  destinationPaymentMethodId?: string;
  confirm?: boolean;
  successUrl?: string;
  failureUrl?: string;
  cancelUrl?: string;
  collectCustomerDetails?: boolean;
  customer?: Customer;
  metadata?: Record<string, any>;
  flowTransactions?: FlowTransaction[];
  displayInfo?: DisplayInfo;
}

export interface CashOutPayload {
  amount: number;
  currencyCode: string;
  paymentType: string;
  sourcePaymentMethodId: string;
  destinationPaymentMethodId: string;
  confirm?: boolean;
  successUrl?: string;
  failureUrl?: string;
  cancelUrl?: string;
  customer?: Customer;
  metadata?: Record<string, any>;
  collectCustomerDetails?: boolean;
  displayInfo?: DisplayInfo;
}

interface PaymentMethodsQueryParams {
  startingAfter?: string;
  endingBefore?: string;
  limit?: string;
  'createdAt.lt'?: string;
  'createdAt.lte'?: string;
  'createdAt.gt'?: string;
  'createdAt.gte'?: string;
  'createdAt.eq'?: string;
  'amount.lt'?: string;
  'amount.lte'?: string;
  'amount.gt'?: string;
  'amount.gte'?: string;
  'amount.eq'?: string;
}

interface TransactionIntentsQueryParams {
  startingAfter?: string;
  endingBefore?: string;
  limit?: number;
  'createdAt.lt'?: string;
  'createdAt.lte'?: string;
  'createdAt.gt'?: string;
  'createdAt.gte'?: string;
  transactionIntentIds?: string[];
}

interface UpdateTransactionIntentPayload {
  id: string;
  sourcePaymentMethodId: string;
  destinationPaymentMethodId: string;
  successUrl?: string;
  failureUrl?: string;
  cancelUrl?: string;
  customer?: Customer;
  metadata?: Record<string, any>;
}

export interface PaymentMethodCreate {
    paymentMethodId: string;
    type: 'MOBILE_MONEY' | 'NEERO_MERCHANT' | 'PAYPAL' | 'NEERO_PERSON' | 'NEERO_CARD';
    userId: number | null | undefined;
    phone?: string;
    cardId?: number;
}

class NeeroGatewayService {
    private basePaymentUrl: string;
    private baseBaasUrl: string;
    private secretKey: string;

    constructor() {
        this.secretKey = process.env.NEERO_SECRET_KEY || '';
        this.basePaymentUrl = process.env.NEERO_PAYMENT_APP_URL || '';
        this.baseBaasUrl = process.env.NEERO_BAAS_APP_URL || '';

        if (!this.secretKey || !this.basePaymentUrl) {
            throw new Error('Configuration Neero manquante dans les variables d\'environnement');
        }
    }

    private getAuthHeader(): string {
        return 'Basic ' + Buffer.from(`${this.secretKey}:`).toString('base64');
    }

    /**
     * Crée une nouvelle méthode de paiement avec le body complet attendu par l'API Neero
     * @param payload Données de la méthode de paiement
     * @returns Résultat de la création
     */
    public async createPaymentMethod(payload: PaymentMethodPayload): Promise<PaymentMethodResult> {
        const endpoint = 'payment-methods';
        const url = new URL(endpoint, this.basePaymentUrl).toString();
        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader(),
                },
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
            throw new Error('Unreachable');
        }
    }

    /**
     * Récupère la liste des méthodes de paiement depuis l'API Neero
     */
    public async getPaymentMethods(params?: PaymentMethodsQueryParams): Promise<any> {
        const endpoint = 'payment-methods';
        const url = new URL(endpoint, this.basePaymentUrl);

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, value);
                }
            });
        }

        try {
            const response = await axios.get(url.toString(), {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError)
        }
    }

    /**
     * Récupère une méthode de paiement par son ID
     * @param paymentMethodId Identifiant de la méthode de paiement
     * @returns Détails de la méthode de paiement
     */
    public async getPaymentMethodById(paymentMethodId: string): Promise<any> {
    const endpoint = `payment-methods/${paymentMethodId}`;
        const url = new URL(endpoint, this.basePaymentUrl).toString();

        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError)
        }   
    }

    /**
     * Récupère le solde associé à une méthode de paiement via son ID
     * @param paymentMethodId Identifiant de la méthode de paiement
     * @returns Détails du solde
     */
    public async getBalanceByPaymentMethodId(paymentMethodId: string): Promise<any> {
        const endpoint = `balances/payment-method/${paymentMethodId}`;
        const url = new URL(endpoint, this.basePaymentUrl).toString();

        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError)
        }
    }

    /**
     * Crée un paiement cash-in
     * @param payload Données du paiement cash-in
     * @returns Réponse de l'API
     */
    public async createCashInPayment(payload: CashInPayload | null): Promise<any> {
        const endpoint = 'transaction-intents/cash-in';
        const url = new URL(endpoint, this.basePaymentUrl).toString();

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError)
        }
    }

    /**
     * Crée un paiement cash-out
     * @param payload Données du paiement cash-out
     * @returns Réponse de l'API
     */
    public async createCashOutPayment(payload: CashOutPayload): Promise<any> {
        const endpoint = 'transaction-intents/cash-out';
        const url = new URL(endpoint, this.basePaymentUrl).toString();

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError)
        }
    }

    /**
     * Récupère la liste des transaction intents
     * @returns Liste des transaction intents
     */
    public async listTransactionIntents(params?: TransactionIntentsQueryParams): Promise<any> {
        const endpoint = 'transaction-intents';
        const url = new URL(endpoint, this.basePaymentUrl);

        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        value.forEach(v => url.searchParams.append(key, v));
                    } else {
                        url.searchParams.append(key, value.toString());
                    }
                }
            });
        }

        try {
            const response = await axios.get(url.toString(), {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError)
        }
    }

    /**
     * Met à jour un transaction intent
     * @param payload Données de mise à jour du transaction intent
     * @returns Réponse de l'API
     */
    public async updateTransactionIntent(payload: UpdateTransactionIntentPayload): Promise<any> {
        const endpoint = 'transaction-intents';
        const url = new URL(endpoint, this.basePaymentUrl).toString();

        try {
            const response = await axios.put(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError)
        }
    }

    /**
     * Confirmer une transaction intent
     * @param transactionId identifiant de la transaction intent
     * @returns Réponse de l'API
     */
    public async confirmTransactionIntent(transactionId: string): Promise<any> {
        const endpoint = `transaction-intents/${transactionId}/confirm`;
        const url = new URL(endpoint, this.basePaymentUrl).toString();

        try {
            const response = await axios.post(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError)
        }
    }

    /**
     * Récupérer une transaction intent
     * @param transactionId identifiant de la transaction intent
     * @returns Réponse de l'API
     */
    public async getTransactionIntentById(transactionId: string): Promise<any> {
        const endpoint = `transaction-intents/${transactionId}`;
        const url = new URL(endpoint, this.basePaymentUrl).toString();

        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError)
        }
    }

    public async findOrSavePaymentMethod(paymentMethod: PaymentMethodCreate) {
        return PaymentMethodModel.findOrCreate({
            where: {paymentMethodId: paymentMethod.paymentMethodId},
            defaults: paymentMethod
        })
    }

    public async getPaymentMethod(paymentMethodId: string) {
        return PaymentMethodModel.findOne({
            where: { paymentMethodId }
        })
    }

    public async getPaymentMethodMarchant() {
        return PaymentMethodModel.findOne({
            where: { type: 'NEERO_MERCHANT' }
        })
    }

    public async getRequiredDocuments(nationality: string = 'CM', partyType: string = 'PERSON'): Promise<any> {
        const endpoint = `party/config/required-doc?nationality=${nationality}&partyType=${partyType}`;
        const url = new URL(endpoint, this.baseBaasUrl).toString();

        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    public async createOnboardingSession(partyObject: PartyObject): Promise<any> {
        const endpoint = 'party/onboarding/session';
        const url = new URL(endpoint, this.baseBaasUrl).toString();
        const payload = {
            partyobject: partyObject
        };

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader(),
                },
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    public async getOnboardingSession(sessionKey: string): Promise<any> {
        const endpoint = `party/onboarding/session/${sessionKey}/party`;
        const url = new URL(endpoint, this.baseBaasUrl).toString();
        
        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader(),
                },
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    public async getAllOnboardingSession(): Promise<any> {
        const endpoint = `party/search`;
        const url = new URL(endpoint, this.baseBaasUrl).toString();
        
        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader(),
                },
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    public async uploadDocuments(documents: UploadDocumentsPayload, sessionId: string) {
        const endpoint = `party/onboarding/session/${sessionId}/upload-doc`;
        const url = new URL(endpoint, this.baseBaasUrl).toString();

        try {
            const formData = new FormData();

            formData.append('documentType', documents.documentType);

            // Ajout des fichiers
            documents.files.forEach(file => {
                const stream = Readable.from(file.buffer);
                formData.append('files', stream, {
                    filename: file.originalname,
                    contentType: file.mimetype,
                    knownLength: file.buffer.length
                });
            });

            const headers = {
                ...formData.getHeaders(),
                'Authorization': this.getAuthHeader()
            };

            const response = await axios.post(url, formData, {
                headers,
                maxBodyLength: Infinity
            });

            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    public async submitOnboardingSession(sessionId: string): Promise<any> {
        const endpoint = `party/onboarding/session/${sessionId}/submit`;
        const url = new URL(endpoint, this.baseBaasUrl).toString();

        try {
            const response = await axios.post(url, null, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    public async getSession(sessionId: string) {
        const endpoint = `party/onboarding/session/${sessionId}`;
        const url = new URL(endpoint, this.baseBaasUrl).toString();

        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });

            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    public async getParty(partyId: string) {
        const endpoint = `party/object/${partyId}`;
        const url = new URL(endpoint, this.baseBaasUrl).toString();

        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });

            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    public async createVirtualCard(payload: CreateCardPayload) {
        const endpoint = `cards/virtual-registration`;
        const url = new URL(endpoint, this.baseBaasUrl).toString();

        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });

            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    public async freezeVirtualCard(payload: FreezeCardPayload) {
        const endpoint = `cards/freeze`;
        const url = new URL(endpoint, this.baseBaasUrl).toString();

        try {
            const response = await axios.put(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });

            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    public async deleteVirtualCard(payload: CardPayload) {
        const endpoint = `cards/terminate`;
        const url = new URL(endpoint, this.baseBaasUrl).toString();

        try {
            const response = await axios.delete(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                },
                data: payload
            });
            console.log('response delete card', response.data)
            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    public async getBalance(paymentMethodId: string) {
        const endpoint = `balances/payment-method/${paymentMethodId}`;
        const url = new URL(endpoint, this.basePaymentUrl).toString();

        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });

            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    public async viewDetailCard(cardId: number) {
        const endpoint = `cards/${cardId}/view-details?cardCategory=VIRTUAL`;
        const url = new URL(endpoint, this.baseBaasUrl).toString();

        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.getAuthHeader()
                }
            });

            return response.data;
        } catch (error) {
            this.errorApi(error as AxiosError);
        }
    }

    private errorApi(error: AxiosError) {
        const apiError = error.response?.data as NeeroApiError | undefined;
        console.log('error api', error.response)

        if (axios.isAxiosError(error)) {
            return error.response?.data;
        }

        const message = apiError
        ? `Erreur API : ${apiError.title} (code: ${apiError.code})`
        : 'Erreur inconnue';

        return message
    }
}

export default new NeeroGatewayService();