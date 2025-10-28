import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { enleverPrefixe237, formaterDateISO, generateMethodSignature, getCodeRegionCameroun, isBefore, mapStatusCard } from '../utils/functions';
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

    async getPartySession(
        userId?: number,
        partyKey?: string,
        sessionId?: string
    ) {
        const where: Record<string, any> = {};
        if (userId) {
            where.userId = userId;
        }
        if (partyKey) {
            where.partyKey = partyKey;
        }
        if (sessionId) {
            where.sessionId = sessionId;
        }

        return PartyCard.findOne({
            where,
            include: [{ 
                model: UserModel,
                as: 'user',
                attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
            }]
        })
    }

    async getPartySessionPending() {
        return PartyCard.findAll({
            where: { status: 'WAITING_FOR_INFORMATION' },
            include: [{
                model: UserModel,
                as: 'user',
                attributes: ['id', 'firstname', 'lastname', 'email']
            }]
        })
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
        return VirtualCardModel.findOne({
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
        })
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
        if (cardId) {
            where.cardId = cardId;
        }
        if (idCard) {
            where.id = idCard;
        }
        if (userId) {
            where.userId = userId;
        }
        
        return await VirtualCardModel.findOne({
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
        })
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

        if (userId) {
            where.userId = userId;
        }
        if (paymentMethodId) {
            where.paymentMethodId = paymentMethodId;
        }
        if (idCard) {
            where.cardId = idCard;
        }
        if (type) {
            where.type = type;
        }

        return PaymentMethodModel.findOne({ where })
    }

    public async getPaymentMethodCard(idCard: number) {
        return VirtualCardModel.findByPk(idCard, {
            include: [{ model: PaymentMethodModel, as: 'paymentMethod' }]
        })
    }

    public async deleteCard(body: CardPayload) {
        return await neeroService.deleteVirtualCard(body)
    }

    async listTransactions(cardId: number, limit: number = 5, startIndex: number = 0) {
        return TransactionModel.findAndCountAll({
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