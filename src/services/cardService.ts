import { enleverPrefixe237, formaterDateISO, getCodeRegionCameroun, isBefore, mapStatusCard } from '../utils/functions';
import neeroService, { PaymentMethodCardPayload, PaymentMethodCreate } from './neeroService';
import { CardPayload, CreateCardModel, CreateCardPayload, CreateCardResponse, CreateOnboardingSessionResponse, FreezeCardPayload, PartyObject, UploadDocumentsPayload, UploadDocumentsResponse } from '../types/Neero';
import PartyCard from '@models/party-card.model';
import userService from './userService';
import VirtualCardModel from '@models/virtualCard.model';
import { typesStatusCard, TypesStatusCard } from '@utils/constants';
import UserModel from '@models/user.model';
import PaymentMethodModel from '@models/payment-method.model';
import WalletModel from '@models/wallet.model';
import TransactionModel from '@models/transaction.model';
import CardTransactionDebtsModel from '@models/card-transaction-debts.model';
import notificationService from './notificationService';
import { Op } from 'sequelize';
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

export interface PartySessionCreate {
    sessionId: string | null | undefined;
    partyKey: string;
    userId: number;
    status: string;
}

export interface PartySessionUpdate {
    sessionId: string;
    status: string;
}

export interface VirtualCardDebtCreate {
    amount: number;
    userId: number;
    cardId: number;
    intitule: string;
}

class CardService {
    async createOnboardingSession(partyObject: PartyObject): Promise<CreateOnboardingSessionResponse> {
        return await neeroService.createOnboardingSession(partyObject);
    }

    async uploadDocuments(documents: UploadDocumentsPayload, sessionId: string) {
        return await neeroService.uploadDocuments(documents, sessionId)
    }

    async submitOnboarding(sessionId: string) {
        return await neeroService.submitOnboardingSession(sessionId)
    }

    async createPartySession(partySession: PartySessionCreate) {
        return PartyCard.create(partySession)
    }

    async updatePartySession(partyUpdate: PartySessionUpdate) {
        return PartyCard.update(partyUpdate, {
            where: {
                sessionId: partyUpdate.sessionId
            }
        })
    }

    async getPartySession(userId?: number, partyKey?: string, sessionId?: string) {
        const cacheKey = `partySession:${userId ?? ''}:${partyKey ?? ''}:${sessionId ?? ''}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const where: Record<string, any> = {};
        if (userId) where.userId = userId;
        if (partyKey) where.partyKey = partyKey;
        if (sessionId) where.sessionId = sessionId;

        const result = await PartyCard.findOne({
            where,
            include: [{ 
                model: UserModel,
                as: 'user',
                attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
            }]
        });

        if (result) {
            await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        }
        return result;
    }

    async getPartySessionPending() {
        const cacheKey = 'partySessionPending';
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const result = await PartyCard.findAll({
            where: { status: 'WAITING_FOR_INFORMATION' },
            include: [{
                model: UserModel,
                as: 'user',
                attributes: ['id', 'firstname', 'lastname', 'email']
            }]
        });

        await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }

    async createOnboardingSessionHandler(
        userId: number, 
        documentType: 'NATIONALID' | 'PASSPORT' | 'RECEIPT'
    ) {
        const user = await userService.getMeWithKyc(userId)
        if (!user.isVerifiedKYC) {
            throw new Error("Veuillez soumettre vos documents KYC avant de créer une carte virtuelle.")
        }

        const partyObject: PartyObject = {
            type: 'PERSON',
            partyInfo: {
                firstName: user.firstname,
                familyName: user.lastname,
                birthDate: formaterDateISO(user.dateOfBirth) ?? user.dateOfBirth,
                givenName: '',
                idDocumentType: documentType,
                idDocumentNumber: user.kycDocuments?.filter(k => k.type === 'ID_PROOF')?.[0].idDocumentNumber ?? '',
                taxIdNumber: user.kycDocuments?.find(k => k.type === 'NIU_PROOF')?.taxIdNumber ?? '',
                nationality: 'CM'
            },
            locations: [
                {
                    type: 'DOMICILEADDRESS',
                    address1: user.address,
                    address2: '',
                    address3: '',
                    postalCode: '',
                    city: user.city ? user.city : user.address,
                    region: getCodeRegionCameroun('LT') ?? 'LT',
                    country: 'CM',
                    longitude: null,
                    latitude: null
                },
                {
                    type: 'PLACEOFBIRTH',
                    address1: user.address,
                    address2: '',
                    address3: '',
                    postalCode: '',
                    city: user.city ? user.city : user.address,
                    region: getCodeRegionCameroun('LT') ?? 'LT',
                    country: 'CM',
                    longitude: null,
                    latitude: null
                }
            ],
            contactPoints: [
                {
                    type: 'PHONENUMBER',
                    country: 'CM',
                    value: enleverPrefixe237(user.phone)  
                },
                {
                    type: 'EMAIL',
                    country: 'CM',
                    value: user.email 
                }
            ],
            capacities: [
                {
                    code: 'CAN_MANAGE_CARDS',
                    enabled: true
                }
            ]
        };

        const partySession = await this.getPartySession(userId)
        if (partySession) {
            throw new Error("Vous avez déjà une demande en cours...")
        }

        const result = await this.createOnboardingSession(partyObject);

        const partyPayload: PartySessionCreate = {
            sessionId: result.key,
            partyKey: result.partyKey,
            userId: user.id,
            status: result.status
        }
        await this.createPartySession(partyPayload)

        return result
    }

    async getOnboardingSessionUser(userId: number) {
        try {
            const partySession = await this.getPartySession(userId)
            if (!partySession) {
                throw new Error("Cet utilisateur n'a pas encore créé une demande de vérification de documents")
            }

            const onboardingSession = await neeroService.getOnboardingSession(partySession.sessionId ?? '')
            
            return {
                onboardingSession: onboardingSession, 
                user: partySession.user
            }
        } catch (error: any) {
            throw new Error(`Une erreur est survenue : ${error.message}`)
        }
    }

    async getAllOnboardingSessionUser(limit: number = 10) {
        return await neeroService.getAllOnboardingSession(limit)
    }

    async getSession(sessionId: string) {
        const session = await neeroService.getSession(sessionId)
        if (isBefore(session.expirationDateTime)) 
            return true
        else
            return false
    }

    async getParty(partyId: string) {
        return await neeroService.getParty(partyId)
    }

    async createVirtualCard(card: CreateCardPayload): Promise<CreateCardResponse> {
        return await neeroService.createVirtualCard(card)
    }

    async saveVirtualCard(card: CreateCardModel) {
        return VirtualCardModel.create(card)
    }

    async getAllVirtualCards(
        limit: number,
        startIndex: number,
        status?: TypesStatusCard
    ) {
        const where: Record<string, any> = {};

        if (status) {
            where.status = status;
        }

        return VirtualCardModel.findAndCountAll({
            where,
            offset: startIndex,
            limit,
            order: [['createdAt', 'DESC']]
        })
    }

    async getVirtualCardUser(userId: number) {
        const cacheKey = `virtualCardUser:${userId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const result = await VirtualCardModel.findOne({
            where: { 
                userId,
                status: {
                    [Op.notIn]: [
                        typesStatusCard['3'], 
                        typesStatusCard['4'] 
                    ]
                }
            },
            include: [{ 
                model: UserModel, 
                as: 'user', 
                attributes: ['id', 'firstname', 'lastname', 'email', 'phone'] 
            }]
        });

        if (result) {
            await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        }
        return result;
    }

    async freezeVirtualCard(payload: FreezeCardPayload) {
        const card = await VirtualCardModel.findOne({
            where: { cardId: payload.cardId }
        })
        if (card?.status === 'PRE_ACTIVE') {
            throw new Error("Carte non active")
        }
        return await neeroService.freezeVirtualCard(payload)
    }

    async getVirtualCard(cardId?: number, idCard?: number, userId?: number) {
        const cacheKey = `virtualCard:${cardId ?? ''}:${idCard ?? ''}:${userId ?? ''}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const where: Record<string, any> = {};
        if (cardId) where.cardId = cardId;
        if (idCard) where.id = idCard;
        if (userId) where.userId = userId;

        const result = await VirtualCardModel.findOne({
            where,
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone'],
                    include: [{ model: WalletModel, as: 'wallet' }]
                },
                { 
                    model: CardTransactionDebtsModel, 
                    as: 'debts' 
                }
            ]
        });

        if (result) {
            await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        }
        return result;
    }

    async updateStatusCard(cardId: number, status: TypesStatusCard) {
        const virtualCard = await VirtualCardModel.findOne({
            where: { id: cardId },
            include: [{ 
                model: UserModel,
                as: 'user',
                attributes: ['id', 'firstname', 'lastname']
            }]
        })

        // On envoie la notification
        const token = await notificationService.getTokenExpo(virtualCard?.user?.id ?? 0)
        await notificationService.save({
            title: 'Sendo',
            content: `${virtualCard?.user?.firstname} votre carte virtuelle vient d'être ${mapStatusCard(status)}`,
            userId: virtualCard?.user?.id ?? 0,
            status: 'SENDED',
            token: token?.token ?? '',
            type: 'MESSAGE'
        })

        return VirtualCardModel.update({
            status
        }, {
            where: { 
                [Op.or]: [
                    { id: cardId },
                    { cardId: cardId }
                ]
            }
        })
    }

    async createPaymentMethod(cardId: string | number, userId: number, idCard: number) {
        const payloadPaymentMethod: PaymentMethodCardPayload = {
            type: 'NEERO_CARD',
            neeroCardDetails: {
                cardId,
                cardCategory: 'VIRTUAL'
            }
        }
        const paymentMethod = await neeroService.createPaymentMethod(payloadPaymentMethod)
        
        if (!paymentMethod.id) {
            throw new Error("L'identifiant du moyen de paiement est manquant.");
        }

        const paymentMethodModel: PaymentMethodCreate = {
            type: 'NEERO_CARD',
            paymentMethodId: paymentMethod.id,
            userId,
            cardId: idCard
        }
        
        return await neeroService.findOrSavePaymentMethod(paymentMethodModel)
    }

    async getPaymentMethod(
        userId?: number, 
        paymentMethodId?: string, 
        idCard?: number, 
        type?: 'NEERO_CARD' | 'NEERO_MERCHANT' | 'MOBILE_MONEY'
    ) {
        const cacheKey = `paymentMethod:${userId ?? ''}:${paymentMethodId ?? ''}:${idCard ?? ''}:${type ?? ''}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const where: Record<string, any> = {};
        if (userId) where.userId = userId;
        if (paymentMethodId) where.paymentMethodId = paymentMethodId;
        if (idCard) where.cardId = idCard;
        if (type) where.type = type;

        const result = await PaymentMethodModel.findOne({ where });
        if (result) {
            await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        }
        return result;
    }

    async getPaymentMethodCard(idCard: number) {
        const cacheKey = `paymentMethodCard:${idCard}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const result = await VirtualCardModel.findByPk(idCard, {
            include: [{ model: PaymentMethodModel, as: 'paymentMethod' }]
        });

        if (result) {
            await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        }
        return result;
    }

    public async deleteCard(body: CardPayload) {
        return await neeroService.deleteVirtualCard(body)
    }

    async listTransactions(cardId: number, limit: number = 5, startIndex: number = 0) {
        const cacheKey = `transactions:${cardId}:${limit}:${startIndex}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const result = await TransactionModel.findAndCountAll({
            where: { virtualCardId: cardId },
            offset: startIndex,
            limit,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone']
                },
                {
                    model: VirtualCardModel,
                    as: 'card',
                    attributes: ['id', 'cardId', 'status', 'cardName', 'last4Digits']
                }
            ]
        });

        await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }

    async getBalance(paymentMethodId: string) {
        return await neeroService.getBalance(paymentMethodId);
    }

    async viewDetailCard(cardId: number) {
        const card = await this.getVirtualCard(cardId)
        if (!card) {
            throw new Error("Carte introuvable");
        }
        return await neeroService.viewDetailCard(cardId);
    }

    async saveDebt(debt: VirtualCardDebtCreate) {
        return await CardTransactionDebtsModel.create(debt)
    }

    async updateDebt(idDebt: number, amount: number) {
        return CardTransactionDebtsModel.update({ amount }, {
            where: { id: idDebt }
        })
    }

    async deleteDebt(idDebt: number) {
        return CardTransactionDebtsModel.destroy({
            where: { id: idDebt }
        })
    }

    async getDebtsCard(cardId?: number, userId?: number, idCard?: number) {
        const card = await this.getVirtualCard(cardId, idCard, undefined)
        if (!card) {
            throw new Error("Carte virtuelle introuvable")
        }

        return CardTransactionDebtsModel.findAll({
            where: {
                cardId: card.id,
                userId: card.userId
            }
        })
    }
}

export default new CardService();