import FundRequestModel from "@models/fund-request.model";
import RequestRecipientModel from "@models/request-recipient.model";
import TransactionModel from "@models/transaction.model";
import UserModel from "@models/user.model";
import WalletModel from "@models/wallet.model";
import { TypesCurrency, typesMethodTransaction, typesStatusTransaction, typesTransaction } from "@utils/constants";
import { Op } from "sequelize";
import transactionService from "./transactionService";
import walletService from "./walletService";
import userService from "./userService";
import { generateUniqueReference, getUTCBoundaries } from "@utils/functions";
import notificationService from "./notificationService";
import sequelize from '@config/db';
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

class FundRequestService {
    /**
     * Créer une demande de fonds
     * @param userId 
     * @param data 
     * @returns 
     */
    async createFundRequest(
        userId: number,
        data: {
            amount: number;
            description: string;
            deadline: Date;
            recipients: Array<{
                matriculeWallet: string;
            }>;
        }
    ) {
        const transaction = await sequelize.transaction(); // 1. Début transaction
        
        try {
            // 1. Récupérer les utilisateurs à partir des matricules
            const matricules = data.recipients.map(r => r.matriculeWallet);

            const demandeur = await UserModel.findByPk(userId);

            const users = await UserModel.findAll({
                include: [{
                    model: WalletModel,
                    as: 'wallet',
                    where: { matricule: matricules },
                    required: true
                }]
            });

            if (users.length !== matricules.length) {
                const missing = matricules.filter(m => 
                    !users.some(u => u.wallet?.matricule === m)
                );
                throw new Error(`Matricules manquants : ${missing.join(', ')}`);
            }


            // 2. Créer la demande de fonds
            const reference = await generateUniqueReference();
            if (!reference) {
                throw new Error("La génération de la référence a échoué");
            }
            const fundRequest = await FundRequestModel.create({
                userId,
                amount: data.amount,
                description: data.description,
                deadline: data.deadline,
                status: 'PENDING',
                reference
            }, { transaction });

            // 3. Créer les destinataires avec les userId récupérés
            await RequestRecipientModel.bulkCreate(
                users.map(user => ({
                    fundRequestId: fundRequest.id,
                    recipientId: user.id,
                    status: 'PENDING' as 'PENDING'
                })),
                { transaction }
            );

            // 4. Puis récupérer les destinataires avec leurs utilisateurs associés
            const recipients = await RequestRecipientModel.findAll({
                where: { fundRequestId: fundRequest.id },
                include: [
                    {
                        model: UserModel,
                        as: 'recipient',
                        attributes: ['id', 'email']
                    }
                ],
                transaction
            });

            await transaction.commit(); // 6. Validation globale

            // 7. Envoyer une notification au participant
            for (const recipient of recipients) {
                const tokenExpoParticipant = await notificationService.getTokenExpo(recipient.recipient?.id ?? 0);
                if (tokenExpoParticipant) {
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Vous avez reçu une demande de ${fundRequest.amount} XAF de la part de ${demandeur?.lastname}. Accepter ou refuser`,
                        userId: recipient.recipient?.id ?? 0,
                        status: 'SENDED',
                        token: tokenExpoParticipant.token,
                        type: 'FUND_REQUEST'
                    });
                }
            }

            return { fundRequest, recipients };
        } catch (error) {
            await transaction.rollback(); // 8. Rollback automatique
            throw error;
        }
    }

    /**
     * Retourne la liste de toutes les demandes de fonds d'un utilisateur
     * @param userId 
     * @returns 
     */
    async getFundRequestsByUser(userId: number) {
        const fundRequests = await FundRequestModel.findAll({
            where: { userId },
            include: [{
                model: RequestRecipientModel,
                as: 'recipients',
                include: [
                    {
                        model: UserModel,
                        as: 'recipient',
                        attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
                    }
                ],
                order: [['createdAt', 'DESC']]
            }]
        });

        const recipientIds = fundRequests.flatMap(fr => fr.recipients?.map(r => r.recipientId) || []);

        if (recipientIds.length > 0) {
            const payments = await TransactionModel.findAll({
                where: {
                    userId: recipientIds,
                    type: 'FUND_REQUEST_PAYMENT'
                }
            });

            fundRequests.forEach(fr => {
                fr.recipients?.forEach(r => {
                    (r as any).setDataValue('payments', payments.filter(p => p.userId === r.recipientId));
                });
            });
        }

        return fundRequests;
    }

    /**
     * Modifier le status d'une requête de demande de fonds
     * @param requestRecipientId 
     * @param status 
     * @returns 
     */
    async updateRecipientStatus(
        requestRecipientId: number,
        status: 'ACCEPTED'|'REJECTED'|'PAID'|'PENDING'
    ) {
        const requestRecipient = await RequestRecipientModel.findByPk(requestRecipientId, {
            include: [
                {
                    model: UserModel,
                    as: 'recipient',
                    attributes: ['id', 'email', 'firstname', 'lastname']
                }
            ]
        })
        if (!requestRecipient) {
            throw new Error("Requête de paiement introuvable")
        }
        if (status === 'PAID' || status === 'PENDING') {
            throw new Error("Vous ne pouvez pas attribuer ce status manuellement")
        }

        requestRecipient.status = status
        requestRecipient.save();

        // 7. Envoyer une notification au participant
        const tokenExpoParticipant = await notificationService.getTokenExpo(requestRecipient.recipient?.id ?? 0);
        if (tokenExpoParticipant) {
            await notificationService.save({
                title: 'Sendo',
                content: `Bonjour ${requestRecipient.recipient?.firstname}, le statut de la demande de fonds qui vous concerne a été mis à jour à : ${status}`,
                userId: requestRecipient.recipient?.id ?? 0,
                status: 'SENDED',
                token: tokenExpoParticipant.token,
                type: 'FUND_REQUEST'
            });
        }

        return requestRecipient.reload()
    }

    /**
     * Modifier le status d'une demande de fonds
     * @param fundRequestId 
     * @param status 
     * @param userId 
     * @returns 
     */
    async updateFundRequestStatus(
        fundRequestId: number,
        status: 'CANCELLED'|'PENDING'|'PARTIALLY_FUNDED'|'FULLY_FUNDED',
        userId: number
    ) {
        const fundRequest = await FundRequestModel.findByPk(fundRequestId, {
            include: [
                {
                    model: RequestRecipientModel,
                    as: 'recipients',
                    include: [
                        {
                            model: UserModel,
                            as: 'recipient',
                            attributes: ['id', 'email', 'firstname', 'lastname']
                        }
                    ]
                }
            ]
        });
        if (!fundRequest) {
            throw new Error("Demande de fonds introuvable");
        }
        if (status === 'FULLY_FUNDED' || status === 'PARTIALLY_FUNDED') {
            throw new Error("Vous ne pouvez pas attribuer ce status manuellement")
        }
        if (fundRequest.userId !== userId) {
            throw new Error("Impossible d'effectuer cette action, cette demande ne vous appartient pas")
        }
       
        fundRequest.status = status;
        await fundRequest.save();

        for (const recipient of fundRequest.recipients || []) {
            // Envoyer une notification à chaque participant
            const tokenExpoParticipant = await notificationService.getTokenExpo(recipient.recipient?.id ?? 0);
            if (tokenExpoParticipant) {
                await notificationService.save({
                    title: 'Sendo',
                    content: `Bonjour ${recipient.recipient?.firstname}, le statut de la demande de fonds a été mis à jour à : ${status}`,
                    userId: recipient.recipient?.id ?? 0,
                    status: 'SENDED',
                    token: tokenExpoParticipant.token,
                    type: 'FUND_REQUEST'
                });
            }
        }

        return fundRequest.reload();
    }

    /**
     * Payer une demande de fonds
     * @param requestRecipientId 
     * @param userId 
     * @param data 
     * @returns 
     */
    async recordPayment(
        requestRecipientId: number,
        userId: number,
        data: {
            amount: number;
            currency: TypesCurrency;
            description?: string;
        }
    ) {
        const transaction = await sequelize.transaction();

        try {
            const fundRequestRecipient = await RequestRecipientModel.findByPk(requestRecipientId, {
                include: [
                    { model: FundRequestModel, as: 'requestFund' }
                ]
            })
            const fundRequest = await FundRequestModel.findByPk(fundRequestRecipient?.requestFund?.id, {
                include: [
                    {
                        model: RequestRecipientModel,
                        as: 'recipients'
                    },
                    {
                        model: UserModel,
                        as: 'requesterFund',
                        attributes: ['id', 'email', 'firstname', 'lastname']
                    }
                ]
            })
            
            if (fundRequestRecipient?.requestFund?.status === 'CANCELLED') {
                throw new Error("Cette demande de fonds a été supprimé")
            }

            if (fundRequest?.recipients) {
                // Vérifier si tous les bénéficiaires ont déjà payé
                const allPaid = fundRequest.recipients.every(recepient => 
                    recepient.status === 'PAID'
                );
                
                if (allPaid) {
                    throw new Error("Cette demande de fonds est déjà totalement payée");
                }
            }

            const user = await userService.getUserById(userId)
            
            if (!user?.wallet?.matricule) {
                throw new Error("Le portefeuille ou le matricule de l'utilisateur est introuvable");
            }

            //On débite le wallet du payeur
            if (user.wallet.balance < data.amount) {
                throw new Error("Le solde du portefeuille est insuffisant pour effectuer le paiement");
            }
            await walletService.debitWallet(
                user.wallet.matricule,
                data.amount
            )

            if (!fundRequestRecipient?.requestFund?.userId) {
                throw new Error("L'identifiant du demandeur est introuvable");
            }
            const demandeur = await userService.getUserById(fundRequestRecipient.requestFund.userId)
            if (!demandeur?.wallet?.matricule) {
                throw new Error("Le portefeuille ou le matricule de l'utilisateur est introuvable");
            }

            //On crédite le wallet du demandeur
            await walletService.creditWallet(
                demandeur.wallet.matricule,
                data.amount
            )

            const statusRequest = (fundRequest && fundRequest.amount > data.amount) ? 'PARTIALLY_PAID' : 'PAID'
            await RequestRecipientModel.update(
                { status: statusRequest },
                { where: { id: requestRecipientId }}
            )

            const transaction = await transactionService.createTransaction({
                amount: data.amount,
                currency: data.currency,
                type: typesTransaction['6'], 
                status: typesStatusTransaction['1'],
                userId: fundRequestRecipient?.recipientId ?? 0,
                description: 'Demande de fonds',
                totalAmount: data.amount,
                transactionReference: fundRequestRecipient?.requestFund?.reference,
                receiverId: fundRequestRecipient.requestFund.userId,
                receiverType: 'User',
                method: typesMethodTransaction['3'],
                provider: typesMethodTransaction['3']
            })

            // Après la création de la transaction
            const allPaid = await RequestRecipientModel.findAll({
                where: {
                    fundRequestId: fundRequest?.id,
                    status: 'PAID'
                }
            })

            let newStatus: 'PENDING'|'PARTIALLY_FUNDED'|'FULLY_FUNDED'|'CANCELLED' = 'PENDING';
            if (allPaid && allPaid.length > 0) {
                newStatus = 'FULLY_FUNDED';
            } else if (allPaid.length === 0 && statusRequest === 'PARTIALLY_PAID') {
                newStatus = 'PARTIALLY_FUNDED';
            }

            // On met à jour le status de la demande
            await FundRequestModel.update(
                { status: newStatus },
                { where: { id: fundRequestRecipient?.requestFund?.id }}
            )

            // Envoyer une notification à l'initiateur de la demande de fonds
            const tokenExpo = await notificationService.getTokenExpo(fundRequest?.requesterFund?.id ?? 0);
            if (tokenExpo) {
                await notificationService.save({
                    title: 'Sendo',
                    content: `Vous avez reçu ${data.amount} XAF de ${user.firstname} ${user.lastname}.`,
                    userId: fundRequest?.requesterFund?.id ?? 0,
                    status: 'SENDED',
                    token: tokenExpo.token,
                    type: 'FUND_REQUEST'
                });
            }

            return transaction
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Récupérer côté ADMIN toutes les demandes de fonds filtrées
     * @param limit 
     * @param startIndex 
     * @param status 
     * @param startDate 
     * @param endDate 
     * @returns 
     */
    async fundRequestAllList(
        limit: number, 
        startIndex: number, 
        status?: string, 
        startDate?: string, 
        endDate?: string
    ) {
        const where: Record<string, any> = {};
        if (status) where.status = status;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = getUTCBoundaries(startDate).start;
            if (endDate) where.createdAt[Op.lte] = getUTCBoundaries(endDate).end;
        }

        const fundRequests = await FundRequestModel.findAndCountAll({
            where,
            limit,
            offset: startIndex,
            order: [['createdAt', 'DESC']],
            include: [{
                model: RequestRecipientModel,
                as: 'recipients',
                include: [{
                    model: UserModel,
                    as: 'recipient',
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone']
                }]
            }]
        });

        const recipientIds = fundRequests.rows.flatMap(fr => fr.recipients?.map(r => r.recipientId) || []);

        const payments = await TransactionModel.findAll({
            where: {
                userId: recipientIds,
                type: 'FUND_REQUEST_PAYMENT'
            }
        });

        fundRequests.rows.forEach(fr => {
            fr.recipients?.forEach(r => {
                (r as any).setDataValue('payments', payments.filter(p => p.userId === r.recipientId));
            });
        });

        return fundRequests;
    }

    /**
     * Récupérer une demande de fonds par son ID
     * @param fundRequestId 
     * @returns 
     */
    async fundRequestById(fundRequestId: number) {
        /*const cacheKey = `fundRequestById:${fundRequestId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const fundRequest = await FundRequestModel.findByPk(fundRequestId, {
            include: [{
                model: RequestRecipientModel,
                as: 'recipients',
                include: [{
                    model: UserModel,
                    as: 'recipient',
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone']
                }]
            }]
        });

        if (!fundRequest || !fundRequest.recipients) {
            return fundRequest;
        }

        const recipientIds = fundRequest.recipients.map(r => r.recipientId);

        const payments = await TransactionModel.findAll({
            where: {
                userId: recipientIds,
                type: 'FUND_REQUEST_PAYMENT'
            },
            attributes: ['id', 'transactionId', 'amount', 'totalAmount', 'description', 'userId', 'currency', 'type', 'status']
        });

        fundRequest.recipients.forEach(fr => {
            (fr as any).setDataValue('payments', payments.filter(p => p.userId === fr.recipientId));
        });

        //await redisClient.set(cacheKey, JSON.stringify(fundRequest), { EX: REDIS_TTL });
        return fundRequest;
    }

    /**
     * Récupère toutes les demandes de fonds auxquelles l'utilisateur a participé
     * (en tant que demandeur ou bénéficiaire).
     * @param userId 
     * @param limit 
     * @param startIndex 
     * @param status 
     * @returns 
     */
    async getAllFundRequestsForUser(
        userId: number,
        limit: number,
        startIndex: number,
        status?: 'PARTIALLY_FUNDED' | 'FULLY_FUNDED' | 'CANCELLED' | 'PENDING',
    ) {
        /*const cacheKey = `allFundRequestsForUser:${userId}:${limit}:${startIndex}:${status ?? 'all'}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        // 1. Récupérer les demandes créées par l'utilisateur (demandeur)
        const asRequester = await FundRequestModel.findAll({
            where: status ? { userId, status } : { userId },
            include: [
                { 
                    model: UserModel, 
                    as: "requesterFund", 
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone'] 
                },
                {
                    model: RequestRecipientModel,
                    as: 'recipients',
                    include: [
                    {
                        model: UserModel,
                        as: 'recipient',
                        attributes: ['id', 'firstname', 'lastname', 'email', 'phone']
                    }
                    ]
                }
            ],
            limit,
            offset: startIndex,
            order: [['createdAt', 'DESC']]
        });

        // 2. Récupérer les demandes où l'utilisateur est bénéficiaire
        const recipientWhere: Record<string, any> = { recipientId: userId };
        if (status) {
            recipientWhere.status = status;
        }

        const recipientsResult = await RequestRecipientModel.findAndCountAll({
            where: recipientWhere,
            limit,
            offset: startIndex,
            order: [['createdAt', 'DESC']],
            include: [{
                model: FundRequestModel,
                as: "requestFund",
                include: [
                    { 
                        model: UserModel, 
                        as: "requesterFund", 
                        attributes: ['id', 'firstname', 'lastname', 'email', 'phone'] 
                    },
                    {
                        model: RequestRecipientModel,
                        as: 'recipients',
                        include: [
                        {
                            model: UserModel,
                            as: 'recipient',
                            attributes: ['id', 'firstname', 'lastname', 'email', 'phone']
                        }
                        ]
                    }
                ]
            }]
        });

        // Extraire les demandes de fonds où l'utilisateur est bénéficiaire
        const asRecipient = recipientsResult.rows
            .map(r => r.requestFund)
            .filter(Boolean);

        // Fusionner les demandes sans doublons (clé id)
        const allRequestsMap = new Map<number, FundRequestModel>();
        asRequester.forEach(r => allRequestsMap.set(r.id, r));
        asRecipient.forEach(r => {
            if (r) {
                allRequestsMap.set(r.id, r);
            }
        });

        const allRequests = Array.from(allRequestsMap.values());

        // Récupérer tous les recipientIds pour récupérer les paiements
        const allRecipientIds = allRequests.flatMap(fr => fr.recipients?.map(r => r.recipientId) || []);

        // Récupérer les paiements liés aux recipients
        const payments = await TransactionModel.findAll({
            where: {
                userId: allRecipientIds,
                type: 'FUND_REQUEST_PAYMENT'
            },
            attributes: ['id', 'transactionId', 'amount', 'totalAmount', 'description', 'userId', 'currency', 'type', 'status']
        });

        // Injecter les paiements dans chaque recipient
        allRequests.forEach(fr => {
            fr.recipients?.forEach(r => {
                (r as any).setDataValue('payments', payments.filter(p => p.userId === r.recipientId));
            });
        });

        const response = {
            count: allRequests.length,
            rows: allRequests
        };

        // Mise en cache avec TTL d'une heure
        //await redisClient.set(cacheKey, JSON.stringify(response), { EX: REDIS_TTL });

        return response;
    }

    /**
     * Supprimer une demande de fonds
     * @param fundRequestId 
     * @param userId 
     * @returns Promise<number>
     */
    async deleteFundRequest(fundRequestId: number, userId: number) {
        const fundRequest = await FundRequestModel.findByPk(fundRequestId, {
            include: [
                {
                    model: UserModel,
                    as: 'requesterFund',
                    attributes: ['id', 'firstname', 'lastname', 'email']
                }
            ]
        });
        if (!fundRequest) {
            throw new Error("Demande de fonds non trouvée");
        }

        if (!fundRequest.requesterFund || fundRequest.requesterFund.id !== userId) {
            throw new Error("Vous n'êtes pas autorisé à effectuer cette action")
        }

        // On notifie l'utilisateur que la demande de fonds a été supprimée
        if (fundRequest.requesterFund) {
            const tokenExpo = await notificationService.getTokenExpo(fundRequest.requesterFund.id);
            if (tokenExpo) {
                await notificationService.save({
                    title: 'Sendo',
                    content: `Bonjour ${fundRequest.requesterFund.firstname}, votre demande de fonds a été supprimée.`,
                    userId: fundRequest.requesterFund.id,
                    status: 'SENDED',
                    token: tokenExpo.token,
                    type: 'FUND_REQUEST'
                });
            }
        }

        //On supprime la dépense partagée avec ses participants
        await RequestRecipientModel.destroy({
            where: {
                fundRequestId
            }
        });
        // On supprime la dépense partagée
        return await FundRequestModel.destroy({
            where: {
                id: fundRequestId
            }
        });
    }

    /**
     * Supprimer côté admin une demande de fonds
     * @param fundRequestId 
     * @returns Promise<number>
     */
    async deleteAdminFundRequest(fundRequestId: number) {
        const fundRequest = await FundRequestModel.findByPk(fundRequestId, {
            include: [
                {
                    model: UserModel,
                    as: 'requesterFund',
                    attributes: ['id', 'firstname', 'lastname', 'email']
                }
            ]
        });
        if (!fundRequest) {
            throw new Error("Demande de fonds non trouvée");
        }

        // On notifie l'utilisateur que la demande de fonds a été supprimée
        if (!fundRequest.requesterFund) {
            throw new Error("Demande de fonds sans demandeur");
        }
        const tokenExpo = await notificationService.getTokenExpo(fundRequest.requesterFund.id);
        if (tokenExpo) {
            await notificationService.save({
                title: 'Sendo',
                content: `Bonjour ${fundRequest.requesterFund.firstname}, votre demande de fonds a été supprimée par un administrateur SENDO.`,
                userId: fundRequest.requesterFund.id,
                status: 'SENDED',
                token: tokenExpo.token,
                type: 'FUND_REQUEST'
            });
        }

        //On supprime la dépense partagée avec ses participants
        await RequestRecipientModel.destroy({
            where: {
                fundRequestId
            }
        });
        // On supprime la dépense partagée
        return await FundRequestModel.destroy({
            where: {
                id: fundRequestId
            }
        });
    }
}

export default new FundRequestService();