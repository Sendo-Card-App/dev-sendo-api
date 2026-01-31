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
import logger from '@config/logger';
import configService from './configService';
import walletService from './walletService';
import { TransactionCreate } from '../types/Transaction';
import transactionService from './transactionService';

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
        /*const cacheKey = `partySession:${userId ?? ''}:${partyKey ?? ''}:${sessionId ?? ''}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const where: Record<string, any> = {};
        if (userId) where.userId = userId;
        if (partyKey) where.partyKey = partyKey;
        if (sessionId) where.sessionId = sessionId;
        where.status = { [Op.ne]: 'REFUSED_TIMEOUT' };

        const result = await PartyCard.findOne({
            where,
            include: [{ 
                model: UserModel,
                as: 'user',
                attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
            }],
            order: [['createdAt', 'DESC']]
        });

        /*if (result) {
            await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        }*/
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
        if (!user.isVerifiedKYC) throw new Error("Veuillez soumettre vos documents KYC avant de créer une carte virtuelle.")
        if (user.country === 'Canada') throw new Error("Vous ne pouvez pas avoir de carte etant au Canada")

        const kycDocs = user.kycDocuments ?? [];

        const hasNiuProof = kycDocs.some(doc => doc.type === 'NIU_PROOF');

        let taxIdNumber = '';
        let idDocumentNumber = '';

        // Si ancien système (NIU_PROOF présent)
        if (hasNiuProof) {
            const niuDoc = kycDocs.find(doc => doc.type === 'NIU_PROOF');
            taxIdNumber = niuDoc?.taxIdNumber ?? '';

            const idProofDoc = kycDocs.find(doc => doc.type === 'ID_PROOF');
            idDocumentNumber = idProofDoc?.idDocumentNumber ?? '';
        } else {
            // Nouveau système : taxIdNumber dans ID_PROOF ou absent selon pays
            const idProofDocs = kycDocs.find(doc => doc.type === 'ID_PROOF');
            idDocumentNumber = idProofDocs?.idDocumentNumber ?? '';
            taxIdNumber = idProofDocs?.taxIdNumber ?? '';
        }

        const partyObject: PartyObject = {
            type: 'PERSON',
            partyInfo: {
                firstName: user.firstname,
                familyName: user.lastname,
                birthDate: formaterDateISO(user.dateOfBirth) ?? user.dateOfBirth,
                givenName: '',
                idDocumentType: documentType,
                idDocumentNumber,
                taxIdNumber,
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
        if (partySession && partySession.status !== 'REFUSED_TIMEOUT' && partySession.status !== 'REFUSED') {
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
            /*if (!partySession) {
                throw new Error("Cet utilisateur n'a pas encore créé une demande de vérification de documents")
            }*/

            const onboardingSession = await neeroService.getOnboardingSession(partySession?.sessionId ?? '')
            
            return {
                onboardingSession: onboardingSession, 
                user: partySession?.user
            }
        } catch (error: any) {
            throw new Error(`${error.message}`)
        }
    }

    async getAllOnboardingSessionUser() {
        return await neeroService.getAllOnboardingSession()
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
            ],
            order: [['createdAt', 'DESC']]
        });

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
        const where: Record<string, any> = {};
        if (userId) where.userId = userId;
        if (paymentMethodId) where.paymentMethodId = paymentMethodId;
        if (idCard) where.cardId = idCard;
        if (type) where.type = type;

        const result = await PaymentMethodModel.findOne({ where });

        return result;
    }

    async getPaymentMethodCard(idCard: number) {
        const result = await VirtualCardModel.findByPk(idCard, {
            include: [{ model: PaymentMethodModel, as: 'paymentMethod' }]
        });

        return result;
    }

    public async deleteCard(body: CardPayload) {
        return await neeroService.deleteVirtualCard(body)
    }

    async listTransactions(cardId: number, limit: number = 5, startIndex: number = 0) {
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

    async createCard(card: VirtualCardModel, user: UserModel) {
        // S'il a déjà créé au moins une carte, on applique les frais sur sa prochaine création
        const config = await configService.getConfigByName('SENDO_CREATING_CARD_FEES')
        if (config && user && user.wallet!.balance < Number(config!.value)) {
            throw new Error("Veuillez recharger votre portefeuille")
        }

        if (user && user.numberOfCardsCreated >= 1) {
            if (config && user.wallet && config.value > 0) {
                await walletService.debitWallet(
                    user?.wallet?.matricule, 
                    Number(config.value)
                )
                const transaction: TransactionCreate = {
                    amount: Number(config.value),
                    userId: user.id,
                    type: 'PAYMENT',
                    description: 'Frais de création de carte',
                    status: 'COMPLETED',
                    currency: 'XAF',
                    totalAmount: Number(config.value),
                    receiverId: user.id,
                    receiverType: 'User'
                }
                await transactionService.createTransaction(transaction)
            }
        } else {
            // On détermine d'abord si la première création de carte est gratuitre
            const configFirstCreating = await configService.getConfigByName('IS_FREE_FIRST_CREATING_CARD')
            if (configFirstCreating && configFirstCreating.value === 0) {
                if (config && user?.wallet && Number(config.value) > 0) {
                    await walletService.debitWallet(
                        user?.wallet?.matricule, 
                        Number(config.value)
                    )
                    const transaction: TransactionCreate = {
                        amount: Number(config.value),
                        userId: user.id,
                        type: 'PAYMENT',
                        description: 'Frais de création de carte',
                        status: 'COMPLETED',
                        currency: 'XAF',
                        totalAmount: Number(config.value),
                        receiverId: user.id,
                        receiverType: 'User'
                    }
                    await transactionService.createTransaction(transaction)
                }
            }
        }

        const payload: CreateCardPayload = {
            partyId: card.partyId,
            cardName: card.cardName
        }
        const newCard = await this.createVirtualCard(payload);

        // Enregistrer les informations de la carte dans la BD
        const cardModel: CreateCardModel = {
            cardName: card.cardName,
            cardId: card.cardId,
            last4Digits: card.last4Digits,
            partyId: card.partyId,
            status: 'PRE_ACTIVE',
            userId: user.id,
            expirationDate: card.expirationDate
        }
        const virtualCard = await this.saveVirtualCard(cardModel)

        if (user) {
            user.numberOfCardsCreated = user.numberOfCardsCreated + 1;
            await user.save();
        }

        await this.createPaymentMethod(virtualCard.cardId, virtualCard.userId, virtualCard.id)

        logger.info("Nouvelle carte virtuelle créée", {
            card: `${virtualCard.cardName} - ${virtualCard.cardId}`,
            user: `User ID : ${user.id} - ${user.firstname} ${user.lastname}`
        });
    
        return newCard;
    }
}

export default new CardService();