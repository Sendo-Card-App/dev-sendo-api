import { Request, Response } from "express";
import cardService, { PartySessionUpdate } from "../services/cardService";
import kycService from "../services/kycService";
import { sendError, sendResponse } from "../utils/apiResponse";
import { CardPayload, CreateCardModel, CreateCardPayload, FreezeCardPayload, UploadDocumentsPayload } from "../types/Neero";
import { canInitiateTransaction, DownloadedFile, mapDocumentType, mapNeeroStatusToSendo, recreateFilesFromUrls, validateAndTruncateCardName } from "@utils/functions";
import configService from "@services/configService";
import userService from "@services/userService";
import walletService, { settleCardDebtsIfAny } from "@services/walletService";
import { TransactionCreate } from "../types/Transaction";
import transactionService from "@services/transactionService";
import { PaginatedData } from "../types/BaseEntity";
import neeroService, { CashInPayload, CashOutPayload } from "@services/neeroService";
import { wait } from "./mobileMoneyController";
import { typesCurrency, typesMethodTransaction, typesTransaction } from "@utils/constants";
import notificationService from "@services/notificationService";
import PaymentMethodModel from "@models/payment-method.model";
import logger from "@config/logger";

class CardController {
    async createCard(req: Request, res: Response) {
        const { name } = req.body
        try {
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const partySession = await cardService.getPartySession(req.user.id)
            if (!partySession) {
                throw new Error("Envoyez d'abord vos documents KYC pour validation")
            }

            const partyFromNeero = await cardService.getParty(partySession.partyKey ?? '')
            if (partyFromNeero.onboardingSessionStatus === "UNDER_VERIFICATION") {
                throw new Error("Votre demande d'onboarding n'a pas encore été validé")
            } else if (partyFromNeero.onboardingSessionStatus === "VERIFIED") {
                partySession.status = partyFromNeero.onboardingSessionStatus
                await partySession.save()
            }
            
            if (name.length < 5) {
                throw new Error("Le nom de la carte doit contenir au moins 5 caractères.");
            }
            const cardName = name.slice(0, 19)

            // On récupère le user pour savoir combien de cartes il a déjà créé
            const user = await userService.getUserById(req.user.id)

            // S'il a déjà créé au moins une carte, on applique les frais sur sa prochaine création
            const config = await configService.getConfigByName('SENDO_CREATING_CARD_FEES')
            if (user && user.numberOfCardsCreated >= 1) {
                if (config && user.wallet && config.value > 0) {
                    await walletService.debitWallet(
                        user?.wallet?.matricule, 
                        config.value
                    )
                    const transaction: TransactionCreate = {
                        amount: config.value,
                        userId: user.id,
                        type: 'PAYMENT',
                        description: 'Frais de création de carte',
                        status: 'COMPLETED',
                        currency: 'XAF',
                        totalAmount: config.value,
                        receiverId: user.id,
                        receiverType: 'User'
                    }
                    await transactionService.createTransaction(transaction)
                }
            } else {
                // On détermine d'abord si la première création de carte est gratuitre
                const configFirstCreating = await configService.getConfigByName('IS_FREE_FIRST_CREATING_CARD')
                if (configFirstCreating && configFirstCreating.value === 0) {
                    if (config && user?.wallet && config.value > 0) {
                        await walletService.debitWallet(
                            user?.wallet?.matricule, 
                            config.value
                        )
                        const transaction: TransactionCreate = {
                            amount: config.value,
                            userId: user.id,
                            type: 'PAYMENT',
                            description: 'Frais de création de carte',
                            status: 'COMPLETED',
                            currency: 'XAF',
                            totalAmount: config.value,
                            receiverId: user.id,
                            receiverType: 'User'
                        }
                        await transactionService.createTransaction(transaction)
                    }
                }
            }

            const payload: CreateCardPayload = {
                partyId: partySession.partyKey ?? '',
                cardName: cardName
            }
            const card = await cardService.createVirtualCard(payload);

            // Enregistrer les informations de la carte dans la BD
            const cardModel: CreateCardModel = {
                cardName: card.cardName,
                cardId: card.cardId,
                last4Digits: card.last4Digits,
                partyId: partySession.partyKey ?? '',
                status: 'PRE_ACTIVE',
                userId: req.user.id,
                expirationDate: card.expirationDate
            }
            const virtualCard = await cardService.saveVirtualCard(cardModel)

            if (user) {
                user.numberOfCardsCreated = user.numberOfCardsCreated + 1;
                await user.save();
            }

            await cardService.createPaymentMethod(virtualCard.cardId, virtualCard.userId, virtualCard.id)

            logger.info("Nouvelle carte virtuelle créée", {
                card: `${virtualCard.cardName} - ${virtualCard.cardId}`,
                user: `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`
            });
            
            sendResponse(res, 200, 'Carte virtuelle créée avec succès', card)
        } catch (error: any) {
            sendError(res, 500, "Internal server error", [error.message])
        }
    }

    async getRequiredDocuments(req: Request, res: Response) {
        try {
            const requiredDocs = await kycService.getRequiredKycDocuments()
            sendResponse(res, 200, 'Liste des documents requis', requiredDocs)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }

    async uploadDocuments(req: Request, res: Response) {
        const { documentType, userId } = req.body

        try {
            if (!documentType) {
                sendError(res, 403, "Veuillez remplir le documentType")
            }

            // 1. Etape 1
            const verified = await kycService.checkIsAllKycIsApprouved(Number(userId), documentType)
            if (!verified) {
                sendError(res, 403, "Veuillez approuver d'abord les documents de l'utilisateur")
            }

            // 2. Etape 2
            const kycUser = await kycService.getKYCByType(Number(userId), documentType)
            const urls = kycUser.map(item => item.url);

            // 3. Etape 3
            const filesToUpload: DownloadedFile[] = await recreateFilesFromUrls(urls); 
        
            if (!filesToUpload || filesToUpload.length === 0) {
                return sendError(res, 403, "Aucun fichier à envoyer après le téléchargement depuis Cloudinary.");
            }

            // 4. Etape 4
            const partySession = await cardService.getPartySession(Number(userId))
            if (!partySession) {
                throw new Error("Party session neero introuvable")
            }

            // 5. Etape 5
            const payload: UploadDocumentsPayload = {
                documentType: mapDocumentType(documentType),
                files: filesToUpload
            }
            await cardService.uploadDocuments(payload, partySession.sessionId ?? '')

            const upload = await cardService.getOnboardingSessionUser(Number(userId))

            logger.info("Documents KYC envoyés à Neero", {
                documentType: documentType,
                user: `User ID : ${kycUser[0]?.user?.id} - ${kycUser[0]?.user?.firstname} ${kycUser[0]?.user?.lastname}`
            });

            sendResponse(res, 200, "Envoie réussie", upload)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async submitRequestOnboarding(req: Request, res: Response) {
        const { userId } = req.body
        try {
            const partySession = await cardService.getPartySession(Number(userId))
            const session = await neeroService.getSession(partySession?.sessionId ?? '')
            let submit: any | null = null;

            if (session.status !== 'VERIFIED' || session.status === 'UNDER_VERIFICATION') {
                submit = await cardService.submitOnboarding(partySession?.sessionId ?? '')
            } else if (session.status === 'VERIFIED') {
                submit = session
            }

            // Update du status PartyCard
            const update: PartySessionUpdate = {
                sessionId: partySession?.sessionId ?? '',
                status: submit.status
            }
            await cardService.updatePartySession(update)

            logger.info("Demande d'onboarding soumise à Neero", {
                status: submit.status,
                user: partySession && partySession.user ? `User ID : ${partySession.user.id} - ${partySession.user.firstname} ${partySession.user.lastname}` : 'Utilisateur non trouvé'
            });

            sendResponse(res, 200, 'Documents soumis', submit)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }

    async askCreatingCard(req: Request, res: Response) {
        const { documentType } = req.body
        try {
            if (!req.user || !req.user.id) {
                sendError(res, 403, "Utilisateur non authentifié ou prénom manquant");
                return;
            }
            if (!documentType) {
                sendError(res, 401, "Veuillez fournir le documentType");
                return;
            }

            const partySession = await cardService.getPartySession(req.user.id)
            if (partySession) {
                const onboardingUser = await cardService.getOnboardingSessionUser(req.user.id)
                if (onboardingUser.onboardingSession.onboardingSessionStatus == 'UNDER_VERIFICATION') {
                    sendError(res, 403, "Votre demande d'onboarding n'a pas encore été validé")
                    return;
                }
                if (onboardingUser.onboardingSession.onboardingSessionStatus == 'VERIFIED') {
                    sendError(res, 403, "Vous possédez déjà une carte virtuelle active")
                    return; 
                }
            }

            // On récupère le montant des frais de création de carte
            const config = await configService.getConfigByName('SENDO_CREATING_CARD_FEES')
            const user = await userService.getUserById(req.user.id)

            if (config && user && user.wallet!.balance < config!.value) {
                throw new Error("Veuillez recharger votre portefeuille")
            }

            const response = await cardService.createOnboardingSessionHandler(req.user.id, documentType)
            if (!response) {
                throw new Error("Erreur lors de l'initiation d'un onboarding Neero")
            }

            if (config && user && user.wallet!.balance >= config!.value) {
                await walletService.debitWallet(
                    user.wallet!.matricule, 
                    config.value
                )
                const transaction: TransactionCreate = {
                    amount: 0,
                    userId: user.id,
                    type: 'PAYMENT',
                    description: 'Frais de création de carte',
                    status: 'COMPLETED',
                    currency: 'XAF',
                    totalAmount: Number(config.value),
                    receiverId: user.id,
                    receiverType: 'User',
                    sendoFees: Number(config.value),
                    method: 'WALLET'
                }
                await transactionService.createTransaction(transaction)
            }

            logger.info("Demande de création de carte initiée", {
                documentType: documentType,
                user: `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`
            });

            sendResponse(res, 201, "Envoie réussie", response)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async getRequestsCreatingCard(req: Request, res: Response) {
        const { status } = res.locals.pagination;
        try {
            const sessionParty = await cardService.getAllOnboardingSessionUser();
            let filteredSessionParties: any[] = status
                ? sessionParty.filter((s: any) => s.onboardingSessionStatus === status)
                : sessionParty;

            // Enrichir chaque session avec l'objet user récupéré par la clé
            const enrichedSessions = await Promise.all(
                filteredSessionParties.map(async (session) => {
                    try {
                        const partySession = await cardService.getPartySession(undefined, session.key);
                        return { sessionParty: session, user: partySession?.user };
                    } catch (e) {
                        return { sessionParty: session, user: null };
                    }
                })
            );

            sendResponse(res, 200, 'Session party user retournée', enrichedSessions);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', error.message);
        }
    }

    async getRequestCreatingCardUser(req: Request, res: Response) {
        try {
            if (!req.user || !req.user.id) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const sessionParty = await cardService.getOnboardingSessionUser(req.user.id)
            sendResponse(res, 200, 'Session party user retournée', sessionParty)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }

    async getAllVirtualCards(req: Request, res: Response) {
        const { status, limit, startIndex, page } = res.locals.pagination
        try {
            const cards = await cardService.getAllVirtualCards(limit, startIndex, status)

            const totalPages = Math.ceil(cards.count / limit);
                              
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: cards.count,
                items: cards.rows
            };

            sendResponse(res, 200, 'Cartes virtuelles récupérées avec succès', responseData)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async getVirtualCardsUser(req: Request, res: Response) {
        try {
            if (!req.user || !req.user.id) {
                sendError(res, 403, "Utilisateur non authentifié ou prénom manquant");
                return;
            }

            const cards = await cardService.getVirtualCardUser(req.user.id)

            sendResponse(res, 200, 'Cartes virtuelles récupérées avec succès', cards)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async bloquerVirtualCard(req: Request, res: Response) {
        const { cardId } = req.params
        try {
            const virtualCard = await cardService.getVirtualCard(Number(cardId))
            if (virtualCard?.status === 'FROZEN') {
                sendError(res, 400, 'Carte déjà bloquée')
            }
            if (virtualCard?.status === 'BLOCKED') {
                sendError(res, 400, 'Carte déjà bloquée par SENDO, veuillez contacter le support')
            }
            if (virtualCard?.status === 'TERMINATED') {
                sendError(res, 400, 'Carte supprimée')
            }

            const payload: FreezeCardPayload = {
                cardId: Number(cardId),
                cardCategory: 'VIRTUAL',
                freeze: true
            }
            await cardService.freezeVirtualCard(payload)
            
            await cardService.updateStatusCard(virtualCard?.id ?? 0, 'FROZEN')
            const newCard = await virtualCard?.reload()

            logger.info("Carte virtuelle bloquée", {
                card: `${newCard?.cardName} - ${newCard?.cardId}`,
                user: newCard && newCard.user ? `User ID : ${newCard.user.id} - ${newCard.user.firstname} ${newCard.user.lastname}` : 'Utilisateur non trouvé'
            });

            sendResponse(res, 200, 'Carte bloquée avec succès', newCard)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async viewDetailsVirtualCard(req: Request, res: Response) {
        const { cardId } = req.params
        try {
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const virtualCard = await cardService.getVirtualCard(Number(cardId), undefined, undefined)
            console.log('card : ', virtualCard)
            if (req.user.role?.name === 'CUSTOMER' && virtualCard?.status === 'BLOCKED') {
                sendError(res, 400, 'Carte déjà bloquée par SENDO, veuillez contacter le support')
            }

            sendResponse(res, 200, 'Détails de la carte récupérés', virtualCard)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }
    
    async debloquerVirtualCard(req: Request, res: Response) {
        const { cardId } = req.params
        try {
            const virtualCard = await cardService.getVirtualCard(Number(cardId))
            if (virtualCard?.status === 'ACTIVE') {
                sendError(res, 400, 'Carte déjà active')
            }
            if (virtualCard?.status === 'BLOCKED') {
                sendError(res, 400, 'Carte bloquée par SENDO, veuillez contacter le support')
            }
            if (virtualCard?.status === 'TERMINATED') {
                sendError(res, 400, 'Carte supprimée')
            }

            const payload: FreezeCardPayload = {
                cardId: Number(cardId),
                cardCategory: 'VIRTUAL',
                freeze: false
            }
            await cardService.freezeVirtualCard(payload)
            
            await cardService.updateStatusCard(virtualCard?.id ?? 0, 'ACTIVE')
            const newCard = await virtualCard?.reload()

            logger.info("Carte virtuelle débloquée", {
                card: `${newCard?.cardName} - ${newCard?.cardId}`,
                user: newCard && newCard.user ? `User ID : ${newCard.user.id} - ${newCard.user.firstname} ${newCard.user.lastname}` : 'Utilisateur non trouvé'
            });

            sendResponse(res, 200, 'Carte activée avec succès', newCard)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async rechargerCarte(req: Request, res: Response) {
        const { amount, matriculeWallet, idCard } = req.body
        try {
            if (!amount || !matriculeWallet || !idCard) {
                sendError(res, 403, 'Tous les champs doivent être fournis')
            }
            
            if (!req.user || !req.user.id) {
                sendError(res, 401, 'Veuillez vous connecter');
                return;
            }

            // 1. Conversion du montant en nombre entier
            const amountNum = Number(amount);

            // 2. On verifie que l'utilisateur attende d'abord 3min avant de lancer une memee transaction d'un meme montant
            const canProceed = await canInitiateTransaction(req.user.id, 'DEPOSIT', 'VIRTUAL_CARD', amountNum);
            if (!canProceed) {
                sendError(res, 429, 'Patientez au moins 3 minutes entre deux transactions de même montant');
                return;
            }

            // 3. Vérification que le montant est un nombre valide
            if (isNaN(amountNum) || !Number.isInteger(amountNum)) {
                sendError(res, 400, "Le montant doit être un nombre entier valide");
                return;
            }

            // 4. Vérifier les limites
            if (amountNum < 500 || amountNum > 500000) {
                sendError(res, 400, "Le montant doit être compris entre 500 et 500000 XAF");
                return;
            }

            // 5. Vérification que le montant est un multiple de 50
            if (amountNum % 50 !== 0) {
                sendError(res, 400, "Le montant doit être un multiple de 50");
                return;
            }

            // 6. On check si la carte possede des dettes
            console.log('On check si la carte possede des dettes')
            await settleCardDebtsIfAny(req.user.wallet!.matricule, req.user.wallet!.userId)

            const checkBalanceWallet = await walletService.getBalanceWallet(req.user.id)
            if (checkBalanceWallet!.balance < amountNum) {
                throw new Error("Veuillez recharger votre portefeuille")
            }

            const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
            if (!paymentMethodMerchant) {
                throw new Error("Erreur lors de la récupération de la source")
            }

            let payload: CashOutPayload | undefined;
            let paymentMethod: PaymentMethodModel;
            let created: boolean;
            
            const virtualCard = await cardService.getPaymentMethodCard(Number(idCard))
            if (!virtualCard) {
                throw new Error("Erreur de récupération de la méthode de paiement de la carte")
            }
            if (virtualCard.status === 'BLOCKED') {
                sendError(res, 400, 'Carte déjà bloquée par SENDO, veuillez contacter le support')
            }
            if (virtualCard.status === 'TERMINATED') {
                sendError(res, 400, 'Carte supprimée')
            }

            if (virtualCard.paymentMethod) {
                payload = {
                    amount: amountNum,
                    currencyCode: 'XAF',
                    confirm: true,
                    paymentType: 'NEERO_CARD_CASHIN',
                    sourcePaymentMethodId: paymentMethodMerchant.paymentMethodId,
                    destinationPaymentMethodId: virtualCard.paymentMethod.paymentMethodId
                }
            } else {
                [paymentMethod, created] = await cardService.createPaymentMethod(virtualCard.cardId, virtualCard.userId, virtualCard.id)
                payload = {
                    amount: amountNum,
                    currencyCode: 'XAF',
                    confirm: true,
                    paymentType: 'NEERO_CARD_CASHIN',
                    sourcePaymentMethodId: paymentMethodMerchant.paymentMethodId,
                    destinationPaymentMethodId: paymentMethod.paymentMethodId
                }
            }

            if (!payload) {
                throw new Error("Le payload de cashout n'a pas pu être généré.");
            }

            //On vérifie s'il a assez de fonds dans son wallet
            const configFees = await configService.getConfigByName('SENDO_DEPOSIT_CARD_FEES')
            const fees = configFees!.value
            const wallet = await walletService.getBalanceWallet(req.user.id)
            if (wallet && wallet.balance < (amountNum + parseInt(`${fees}`))) {
                throw new Error("Veuillez recharger votre portefeuille")
            }

            const transactionToCreate: TransactionCreate = {
                amount: amountNum,
                type: typesTransaction['0'],
                status: 'PENDING',
                userId: req.user!.id,
                currency: typesCurrency['0'],
                totalAmount: amountNum + parseInt(`${fees}`),
                method: typesMethodTransaction['2'],
                sendoFees: parseInt(`${fees}`),
                virtualCardId: virtualCard.id,
                description: 'Dépôt sur la carte',
                receiverId: req.user!.id,
                receiverType: 'User'
            }
            const transaction = await transactionService.createTransaction(transactionToCreate)

            const cashout = await neeroService.createCashOutPayment(payload)

            const neeroTransaction = await neeroService.getTransactionIntentById(cashout.id)

            await wait(5000)

            const checkTransaction = await neeroService.getTransactionIntentById(neeroTransaction.id)

            if (
                checkTransaction.statusUpdates.some((update: any) => update.status === "SUCCESSFUL")
            ) {
                await walletService.debitWallet(
                    matriculeWallet,
                    amountNum + parseInt(`${fees}`)
                )

                // On met à jour le status de la carte
                if (virtualCard.status === 'PRE_ACTIVE') {
                    await cardService.updateStatusCard(virtualCard.id, 'ACTIVE')
                }

                // Envoyer une notification
                const token = await notificationService.getTokenExpo(req.user.id)
                await notificationService.save({
                    title: 'Sendo',
                    content: `Votre recharge de ${checkTransaction.amount} XAF s'est effectuée avec succès`,
                    userId: wallet?.userId ?? 0,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'SUCCESS_DEPOSIT_CARD'
                })
            }

            // On met à jour les données de la transaction
            transaction.status = mapNeeroStatusToSendo(checkTransaction.status)
            transaction.transactionReference = cashout.id
            await transaction.save()

            logger.info("Carte virtuelle rechargée", {
                amount: amountNum,
                card: `${virtualCard.cardName} - ${virtualCard.cardId}`,
                user: `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`
            });
            
            sendResponse(res, 200, 'La requête a été initiée avec succès', {
                deposit: checkTransaction,
                transaction
            })
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async debiterCarte(req: Request, res: Response) {
        const { amount, matriculeWallet, idCard } = req.body
        
        try {
            if (!amount || !matriculeWallet || !idCard) {
                sendError(res, 403, 'Tous les champs doivent être fournis')
            }

            if (!req.user || !req.user.id) {
                sendError(res, 401, 'Veuillez vous connecter');
                return;
            }
            
            // 1. Conversion du montant en nombre entier
            const amountNum = Number(amount);
            
            // 2. On verifie que l'utilisateur attende d'abord 3min avant de lancer une memee transaction d'un meme montant
            const canProceed = await canInitiateTransaction(req.user.id, 'WITHDRAWAL', 'VIRTUAL_CARD', amountNum);
            if (!canProceed) {
                sendError(res, 429, 'Patientez au moins 3 minutes entre deux transactions de même montant');
                return;
            }

            // 3. Vérification que le montant est un nombre valide
            if (isNaN(amountNum) || !Number.isInteger(amountNum)) {
                sendError(res, 400, "Le montant doit être un nombre entier valide");
                return;
            }

            // 4. Vérifier les limites
            if (amountNum < 500 || amountNum > 500000) {
                sendError(res, 400, "Le montant doit être compris entre 500 et 500000 XAF");
                return;
            }

            // 5. Vérification que le montant est un multiple de 50
            if (amountNum % 50 !== 0) {
                sendError(res, 400, "Le montant doit être un multiple de 50");
                return;
            }

            const virtualCard = await cardService.getPaymentMethodCard(Number(idCard))
            if (!virtualCard) {
                throw new Error("Erreur de récupération de la méthode de paiement de la carte")
            }
            if (virtualCard?.status === 'BLOCKED') {
                sendError(res, 400, 'Carte déjà bloquée par SENDO, veuillez contacter le support')
            }
            if (virtualCard?.status === 'TERMINATED') {
                sendError(res, 400, 'Carte supprimée')
            }

            const configFees = await configService.getConfigByName('SENDO_WITHDRAWAL_CARD_FEES')
            const fees = configFees!.value

            const transactionToCreate: TransactionCreate = {
                amount: amountNum,
                type: typesTransaction['1'],
                status: 'PENDING',
                userId: req.user!.id,
                currency: typesCurrency['0'],
                totalAmount: amountNum + parseInt(`${fees}`),
                method: typesMethodTransaction['2'],
                sendoFees: parseInt(`${fees}`),
                virtualCardId: virtualCard.id,
                description: 'Retrait sur la carte',
                receiverId: req.user!.id,
                receiverType: 'User'
            }
            const transaction = await transactionService.createTransaction(transactionToCreate)

            const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
            if (!paymentMethodMerchant) {
                throw new Error("Erreur lors de la récupération de la source")
            }

            let payload: CashInPayload | undefined;
            if (virtualCard.paymentMethod) {
                payload = {
                    amount: amountNum + parseInt(`${fees}`),
                    currencyCode: 'XAF',
                    confirm: true,
                    paymentType: 'NEERO_CARD_CASHOUT',
                    sourcePaymentMethodId: virtualCard.paymentMethod.paymentMethodId,
                    destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
                }
            }

            if (!payload) {
                throw new Error("Le payload de cashout n'a pas pu être généré.");
            }
            
            const cashin = await neeroService.createCashInPayment(payload)

            const neeroTransaction = await neeroService.getTransactionIntentById(cashin.id)

            await wait(10000)

            const checkTransaction = await neeroService.getTransactionIntentById(neeroTransaction.id)

            if (
                checkTransaction.statusUpdates.some((update: any) => update.status === "SUCCESSFUL")
            ) {
                await walletService.creditWallet(
                    matriculeWallet,
                    amountNum
                )

                // Envoyer une notification
                const token = await notificationService.getTokenExpo(req.user.id)
                await notificationService.save({
                    title: 'Sendo',
                    content: `Votre retrait de ${checkTransaction.amount} XAF s'est effectué avec succès`,
                    userId: req.user.id,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'SUCCESS_WITHDRAWAL_CARD'
                })
            }
            
            // On met à jour les données de la transaction
            transaction.status = mapNeeroStatusToSendo(checkTransaction.status)
            transaction.transactionReference = cashin.id
            await transaction.save()

            logger.info("Carte virtuelle débitée", {
                amount: amountNum,
                card: `${virtualCard.cardName} - ${virtualCard.cardId}`,
                user: `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`
            });
            
            sendResponse(res, 200, 'La requête a été initiée avec succès', {
                deposit: checkTransaction,
                transaction
            })
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async transactionsNeeroCard(req: Request, res: Response) {
        const { idCard } = req.params
        const { limit, startIndex, page } = res.locals.pagination;
        try {
            const virtualCard = await cardService.getPaymentMethodCard(Number(idCard))
            if (!virtualCard) {
               throw new Error("Carte introuvable")
            }

            const transactions = await cardService.listTransactions(
                Number(idCard),
                limit,
                startIndex
            )

            const totalPages = Math.ceil(transactions.count / limit);
                  
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: transactions.count,
                items: transactions.rows
            };

            sendResponse(
                res, 
                200, 
                'Transactions de la carte retournées',
                {
                    card: virtualCard,
                    transactions: responseData
                }
            )
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async deleteVirtualCard(req: Request, res: Response) {
        const { cardId } = req.params
        try {
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const virtualCard = await cardService.getVirtualCard(Number(cardId))
            if (!virtualCard) {
                sendError(res, 404, 'Carte introuvable')
            }
            if (req.user.role?.name === 'CUSTOMER' && virtualCard?.status === 'BLOCKED') {
                sendError(res, 400, 'Carte déjà bloquée par SENDO, veuillez contacter le support')
            }

            const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
            if (!paymentMethodMerchant) {
                throw new Error("Erreur lors de la récupération de la source")
            }

            let payload: CashInPayload | undefined;
            
            const paymentMethod = await cardService.getPaymentMethod(
                undefined, 
                undefined, 
                virtualCard?.id,
                'NEERO_CARD'
            )
            if (!paymentMethod) {
                throw new Error("Erreur de récupération de la méthode de paiement de la carte")
            }

            const token = await notificationService.getTokenExpo(virtualCard?.user?.id ?? 0)

            const balance = await cardService.getBalance(paymentMethod.paymentMethodId)

            if (balance && balance.balance > 0) {
                if (paymentMethod) {
                    payload = {
                        amount: balance.balance,
                        currencyCode: 'XAF',
                        confirm: true,
                        paymentType: 'NEERO_CARD_CASHOUT',
                        sourcePaymentMethodId: paymentMethod.paymentMethodId,
                        destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
                    }
                }

                if (!payload) {
                    throw new Error("Le payload de cashout n'a pas pu être généré.");
                }
                
                const cashin = await neeroService.createCashInPayment(payload)

                const neeroTransaction = await neeroService.getTransactionIntentById(cashin.id)
                
                await wait(2000)

                const checkTransaction = await neeroService.getTransactionIntentById(neeroTransaction.id)

                // On retire les fonds de la carte virtuelle vers le portefeuille
                if (
                    checkTransaction.statusUpdates.some((update: any) => update.status === "SUCCESSFUL")
                ) {
                    await walletService.creditWallet(
                        virtualCard?.user?.wallet?.matricule ?? '',
                        balance.balance
                    )
                    
                    const transactionToCreate: TransactionCreate = {
                        amount: balance.balance,
                        type: typesTransaction['1'],
                        status: mapNeeroStatusToSendo(checkTransaction.status),
                        userId: req.user!.id,
                        currency: typesCurrency['0'],
                        totalAmount: balance.balance,
                        method: typesMethodTransaction['2'],
                        transactionReference: cashin.id,
                        sendoFees: 0,
                        virtualCardId: virtualCard?.id,
                        description: 'Retrait de carte virtuelle',
                        receiverId: req.user!.id,
                        receiverType: 'User'
                    }
                    await transactionService.createTransaction(transactionToCreate)
                    
                    // Envoyer une notification
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Tous les fonds de votre carte *****${virtualCard?.last4Digits} ont été déplacé sur votre portefeuille`,
                        userId: virtualCard?.user?.id ?? 0,
                        status: 'SENDED',
                        token: token?.token ?? '',
                        type: 'SUCCESS_WITHDRAWAL_CARD'
                    })
                }
            }

            const payloadDeleteCard: CardPayload = {
                cardId: Number(cardId),
                cardCategory: 'VIRTUAL'
            }
            
            await cardService.deleteCard(payloadDeleteCard)

            await cardService.updateStatusCard(payloadDeleteCard.cardId, 'TERMINATED')

            await notificationService.save({
                title: 'Sendo',
                content: `Votre carte *****${virtualCard?.last4Digits} vient d'être supprimé avec succès`,
                userId: virtualCard?.user?.id ?? 0,
                status: 'SENDED',
                token: token?.token ?? '',
                type: 'DELETE_CARD'
            })

            logger.info(`L'utilisateur ${req.user.id} a supprimé la carte virtuelle ${cardId}`);

            sendResponse(res, 204, 'Carte supprimée avec succès', {})
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async viderVirtualCard(req: Request, res: Response) {
        const { cardId } = req.params
        try {
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const virtualCard = await cardService.getVirtualCard(Number(cardId))
            if (!virtualCard) {
                sendError(res, 404, 'Carte introuvable')
            }
            if (req.user.role?.name === 'CUSTOMER' && virtualCard?.status === 'BLOCKED') {
                sendError(res, 400, 'Carte déjà bloquée par SENDO, veuillez contacter le support')
            }

            const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
            if (!paymentMethodMerchant) {
                throw new Error("Erreur lors de la récupération de la source")
            }

            let payload: CashInPayload | undefined;
            
            const paymentMethod = await cardService.getPaymentMethod(
                undefined, 
                undefined, 
                virtualCard?.id,
                'NEERO_CARD'
            )
            if (!paymentMethod) {
                throw new Error("Erreur de récupération de la méthode de paiement de la carte")
            }

            const balance = await cardService.getBalance(paymentMethod.paymentMethodId)

            if (balance && balance.balance > 0) {
                if (paymentMethod) {
                    payload = {
                        amount: balance.balance,
                        currencyCode: 'XAF',
                        confirm: true,
                        paymentType: 'NEERO_CARD_CASHOUT',
                        sourcePaymentMethodId: paymentMethod.paymentMethodId,
                        destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
                    }
                }

                if (!payload) {
                    throw new Error("Le payload de cashout n'a pas pu être généré.");
                }
                
                const cashin = await neeroService.createCashInPayment(payload)

                const neeroTransaction = await neeroService.getTransactionIntentById(cashin.id)
                
                await wait(2000)

                const checkTransaction = await neeroService.getTransactionIntentById(neeroTransaction.id)

                // On retire les fonds de la carte virtuelle vers le portefeuille
                if (
                    checkTransaction.statusUpdates.some((update: any) => update.status === "SUCCESSFUL")
                ) {
                    await walletService.creditWallet(
                        virtualCard?.user?.wallet?.matricule ?? '',
                        balance.balance
                    )
                }

                const transactionToCreate: TransactionCreate = {
                    amount: Number(balance.balance),
                    type: typesTransaction['1'],
                    status: mapNeeroStatusToSendo(checkTransaction.status),
                    userId: virtualCard!.user!.id,
                    currency: typesCurrency['0'],
                    totalAmount: Number(balance.balance),
                    method: typesMethodTransaction['2'],
                    transactionReference: cashin.id,
                    sendoFees: 0,
                    virtualCardId: virtualCard?.id,
                    description: 'Transfert des fonds sur le portefeuille',
                    receiverId: virtualCard!.user!.id,
                    receiverType: 'User'
                }
                await transactionService.createTransaction(transactionToCreate)
            }

            logger.info(`La carte de l'utilisateur ${req.user.id} a été vidé. Card ID : ${cardId}`);

            sendResponse(res, 204, 'Carte vidée avec succès', null)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async getBalanceObject(req: Request, res: Response) {
        const { idCard, type } = res.locals.pagination;
        try {
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const virtualCard = await cardService.getVirtualCard(undefined, Number(idCard))
            if (req.user.role?.name === 'CUSTOMER' && virtualCard?.status === 'BLOCKED') {
                sendError(res, 400, 'Carte déjà bloquée par SENDO, veuillez contacter le support')
            }

            let paymentMethod: PaymentMethodModel | null = null;
            if (type && type === 'MERCHANT') {
                paymentMethod = await cardService.getPaymentMethod(undefined, undefined, undefined, 'NEERO_MERCHANT')
            } else if (idCard) {
                paymentMethod = await cardService.getPaymentMethod(undefined, undefined, Number(idCard), undefined)
            }
            if (!paymentMethod) {
                throw new Error("Carte ou portefeuille Sendo introuvable")
            }

            const balance = await cardService.getBalance(paymentMethod.paymentMethodId)

            sendResponse(res, 200, 'Solde de l\'objet récupéré avec succès', balance)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async viewDetailCard(req: Request, res: Response) {
        const { cardId } = req.params;
        try {
            if (!cardId) {
                throw new Error("Veuillez fournir le cardId");
            }
            if (!req.user) {
                sendError(res, 403, "Utilisateur non authentifié");
                return;
            }

            const virtualCard = await cardService.getVirtualCard(Number(cardId))
            if (virtualCard?.status === 'BLOCKED') {
                sendError(res, 400, 'Carte déjà bloquée par SENDO, veuillez contacter le support')
            }
            if (virtualCard?.status === 'TERMINATED') {
                sendError(res, 400, 'Carte supprimée')
            }

            const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
            if (!paymentMethodMerchant) {
                throw new Error("Erreur lors de la récupération de la source")
            }

            const configFees = await configService.getConfigByName('SENDO_VIEW_DETAILS_CARD_FEES')
            const fees = configFees!.value
            let payload: CashInPayload | undefined;
            
            const newVirtualCard = await cardService.getPaymentMethodCard(virtualCard!.id)
            if (!newVirtualCard) {
                throw new Error("Erreur de récupération de la méthode de paiement de la carte")
            }

            if (newVirtualCard.paymentMethod) {
                payload = {
                    amount: fees,
                    currencyCode: 'XAF',
                    confirm: true,
                    paymentType: 'NEERO_CARD_CASHOUT',
                    sourcePaymentMethodId: newVirtualCard.paymentMethod.paymentMethodId,
                    destinationPaymentMethodId: paymentMethodMerchant.paymentMethodId
                }
            }

            if (!payload) {
                throw new Error("Le payload de cashout n'a pas pu être généré.");
            }
            
            const cashin = await neeroService.createCashInPayment(payload)

            const neeroTransaction = await neeroService.getTransactionIntentById(cashin.id)

            await wait(5000)

            const checkTransaction = await neeroService.getTransactionIntentById(neeroTransaction.id)
            
            const transactionToCreate: TransactionCreate = {
                amount: 0,
                type: typesTransaction['8'],
                status: mapNeeroStatusToSendo(checkTransaction.status),
                userId: req.user!.id,
                currency: typesCurrency['0'],
                totalAmount: Number(fees),
                method: typesMethodTransaction['2'],
                transactionReference: cashin.id,
                sendoFees: Number(fees),
                virtualCardId: virtualCard!.id,
                description: 'Frais infos carte',
                receiverId: req.user!.id,
                receiverType: 'User'
            }
            await transactionService.createTransaction(transactionToCreate)
      
            if (
                checkTransaction.statusUpdates.some((update: any) => update.status === "FAILED")
            ) {
                throw new Error("Impossible de voir les détails de la carte pour le moment");
            }

            const link = await cardService.viewDetailCard(Number(cardId));
            
            sendResponse(res, 200, 'Détails de la carte récupérés', link);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async bloquerDebloquerAdminVirtualCard(req: Request, res: Response) {
        const { cardId } = req.params
        const { action } = req.body;
        try {
            const virtualCard = await cardService.getVirtualCard(Number(cardId))
            if (virtualCard?.status === 'TERMINATED') {
                sendError(res, 400, "Carte supprimée");
            }
            if (virtualCard?.status === 'BLOCKED' && action === 'FREEZE') {
                sendError(res, 400, 'Carte déjà bloquée')
            }
            if (virtualCard?.status === 'ACTIVE' && action === 'UNFREEZE') {
                sendError(res, 400, 'Carte déjà active')
            }
            
            await cardService.updateStatusCard(
                virtualCard?.id ?? 0, 
                action === 'FREEZE' ? 'BLOCKED' : 'ACTIVE'
            )
            const newCard = await virtualCard?.reload()

            logger.info(`Carte virtuelle ${action === 'FREEZE' ? 'bloquée' : 'débloquée'} par un administrateur`, {
                card: `${newCard?.cardName} - ${newCard?.cardId}`,
                user: newCard && newCard.user ? `User ID : ${newCard.user.id} - ${newCard.user.firstname} ${newCard.user.lastname}` : 'Utilisateur non trouvé'
            });

            sendResponse(
                res, 
                200, 
                `Carte ${action === 'FREEZE' ? 'bloquée' : 'débloquée'} avec succès`, 
                newCard
            )
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async debloquerVirtualCardBloque(req: Request, res: Response) {
        const { cardId } = req.params
        try {
            const virtualCard = await cardService.getVirtualCard(Number(cardId))
            if (virtualCard?.status === 'ACTIVE') {
                sendError(res, 400, 'Carte déjà active')
            }
            if (virtualCard?.status === 'TERMINATED') {
                sendError(res, 400, "Carte supprimée");
            }
            
            //Si la carte est bloquée et on veut la débloquer, on paie les frais de débloquage
            const fees = await configService.getConfigByName('SENDO_UNLOCK_CARD_FEES')
            if (virtualCard?.paymentRejectNumber === 3) {
                await walletService.debitWallet(
                    virtualCard.user?.wallet?.matricule ?? '',
                    fees?.value ?? 0
                )
                const TransactionCreate: TransactionCreate = {
                    type: 'PAYMENT',
                    amount: fees?.value ?? 0,
                    currency: typesCurrency['0'],
                    status: 'COMPLETED',
                    userId: virtualCard?.user?.id ?? 0,
                    totalAmount: fees?.value ?? 0,
                    description: 'Paiement des frais de débloquage de carte',
                    virtualCardId: virtualCard?.id,
                    method: 'VIRTUAL_CARD',
                    provider: 'WALLET',
                    receiverId: virtualCard?.user?.id ?? 0,
                    receiverType: 'User'
                }
                await transactionService.createTransaction(TransactionCreate)

                // On remet le compteur à 0
                virtualCard.paymentRejectNumber = 0
                virtualCard.save()
            } else {
                await walletService.debitWallet(
                    virtualCard?.user?.wallet?.matricule ?? '',
                    fees?.value ?? 0
                )
            }

            await cardService.updateStatusCard(
                virtualCard?.id ?? 0, 
                'ACTIVE'
            )
            const newCard = await virtualCard?.reload()

            logger.info("Carte virtuelle débloquée", {
                card: `${newCard?.cardName} - ${newCard?.cardId}`,
                user: newCard && newCard.user ? `User ID : ${newCard.user.id} - ${newCard.user.firstname} ${newCard.user.lastname}` : 'Utilisateur non trouvé'
            });

            sendResponse(
                res, 
                200, 
                `Carte débloquée avec succès`, 
                newCard
            )
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async getDebtsCard(req: Request, res: Response) {
        const { idCard } = req.params
        try {
            const debts = await cardService.getDebtsCard(undefined, undefined, Number(idCard))
            if (debts) {
                sendResponse(res, 200, 'Dettes de la carte retournée', debts)
            }
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }
}

export default new CardController();