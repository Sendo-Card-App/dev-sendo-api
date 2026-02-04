import { typesCurrency, typesMethodTransaction, typesPaymentStatusSharedExpense, typesStatusSharedExpense, typesStatusTransaction, typesTransaction } from "@utils/constants";
import { SharedExpenseCreate } from "../types/SharedExpense";
import SharedExpenseModel from "@models/shared-expense.model";
import ParticipantSharedExpenseModel from "@models/participant-shared-expense.model";
import UserModel from "@models/user.model";
import { getUTCBoundaries } from "@utils/functions";
import { Op } from "sequelize";
import walletService from "./walletService";
import { TransactionCreate } from "../types/Transaction";
import transactionService from "./transactionService";
import WalletModel from "@models/wallet.model";
import notificationService from "./notificationService";
import sequelize from '@config/db';
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

class SharedExpenseService {
    async createExpense(expenseCreate: SharedExpenseCreate) {
        if (!expenseCreate.totalAmount || expenseCreate.totalAmount <= 0) {
            throw new Error("Montant total invalide");
        }
        if (
            !expenseCreate.participants || 
            !Array.isArray(expenseCreate.participants) || 
            expenseCreate.participants.length === 0
        ) {
            throw new Error("Liste des participants invalide");
        }

        // Wallet de l'initiateur
        const walletInit = await UserModel.findByPk(expenseCreate.userId, {
            include: [{ model: WalletModel, as: 'wallet' }],
            attributes: ['id', 'firstname', 'lastname', 'email']
        });
        if (!walletInit || !walletInit.wallet) {
            throw new Error("Wallet de l'initiateur introuvable");
        }

        // Calculer la part égale
        const numerParticipants = expenseCreate.includeMyself ? expenseCreate.participants.length + 1 : expenseCreate.participants.length;
        const part = expenseCreate.totalAmount / numerParticipants;

        const expense: any = {
            totalAmount: expenseCreate.totalAmount,
            description: expenseCreate.description || "",
            userId: expenseCreate.userId,
            initiatorPart: expenseCreate.includeMyself ? part : 0,
            limitDate: expenseCreate.limitDate,
            currency: expenseCreate.currency ?? typesCurrency['0'],
            status: typesStatusSharedExpense['0']
        };

        const neWParticipants = expenseCreate.includeMyself
            ? expenseCreate.participants.concat({ matriculeWallet: walletInit.wallet.matricule })
            : expenseCreate.participants;

        if (expenseCreate.methodCalculatingShare === 'manual') {
            // Si le calcul est manuel, on utilise les montants fournis par les participants
            const totalManualAmount = neWParticipants.reduce((sum, p) => sum + (p.amount || 0), 0);
            if (totalManualAmount !== expenseCreate.totalAmount) {
                throw new Error("Le montant total des parts manuelles ne correspond pas au montant total de la dépense");
            }
            expense.initiatorPart = neWParticipants.find(p => p.matriculeWallet === walletInit.wallet?.matricule)?.amount || 0;
            expense.methodCalculatingShare = 'manual';
        } else {
            // Si le calcul est automatique, on utilise la part calculée
            expense.methodCalculatingShare = 'auto';
        }

        // Récupérer tous les matricules des participants
        const matricules = neWParticipants.map(p => p.matriculeWallet);

        // Récupérer les utilisateurs correspondants via leur wallet.matricule
        const users = await UserModel.findAll({
            include: [{
                model: WalletModel,
                as: 'wallet',
                where: { matricule: matricules },
                required: true
            }]
        });

        // Vérifier que tous les matricules sont valides
        const missingMatricules = matricules.filter(m => !users.some(u => u.wallet?.matricule === m));
        if (missingMatricules.length > 0) {
            throw new Error(`Matricules invalides : ${missingMatricules.join(', ')}`);
        }

        // Construire un mapping matriculeWallet -> userId
        const matriculeToUserId = users.reduce((acc, user) => {
            if (user.wallet?.matricule) {
                acc[user.wallet.matricule] = user.id;
            }
            return acc;
        }, {} as Record<string, number>);

        // Créer la dépense partagée
        const sharedExpense = await SharedExpenseModel.create(expense, {
            include: [
                {
                    model: ParticipantSharedExpenseModel,
                    as: 'participants',
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['id', 'firstname', 'lastname', 'email']
                    }]
                }
            ]
        });

        // Création des participants
        await ParticipantSharedExpenseModel.bulkCreate(
            neWParticipants.map(p => ({
                userId: matriculeToUserId[p.matriculeWallet],
                sharedExpenseId: sharedExpense.id,
                part: expense.methodCalculatingShare === 'manual' ? (p.amount || 0) : part,
                paymentStatus: typesPaymentStatusSharedExpense['0']
            }))
        );

        // Récupération des participants avec les utilisateurs associés
        const participants = await ParticipantSharedExpenseModel.findAll({
            where: {
                sharedExpenseId: sharedExpense.id,
                userId: neWParticipants.map(p => matriculeToUserId[p.matriculeWallet])
            },
            include: [{
                model: UserModel,
                as: 'user',
                attributes: ['id', 'firstname', 'lastname', 'email']
            }]
        });

        // Envoyer une notification à l'initiateur
        const tokenExpoInit = await notificationService.getTokenExpo(walletInit.id);
        if (tokenExpoInit) {
            await notificationService.save({
                title: 'Sendo',
                content: `Votre demande de partage de ${sharedExpense.totalAmount} XAF a été envoyée à ${sharedExpense.participants?.length} amis. En attente de participation.`,
                userId: walletInit.id,
                status: 'SENDED',
                token: tokenExpoInit.token,
                type: 'SHARED_EXPENSE'
            });
        }

        // Envoyer une notification à chaque participant
        for (const participant of participants) {
            const tokenExpo = await notificationService.getTokenExpo(participant.user?.id ?? 0)
            if (tokenExpo) {
                await notificationService.save({
                    title: 'Sendo',
                    content: `${walletInit.firstname} vous invite à participer à un partage de ${sharedExpense.totalAmount} XAF. Votre part : ${participant.part} ${expense.currency}. Accepter ou refuser.`,
                    userId: participant?.user?.id ?? 0,
                    status: 'SENDED',
                    token: tokenExpo.token,
                    type: 'SHARED_EXPENSE'
                }); 
            }
        }

        return {
            sharedExpense,
            initiator: walletInit,
            participants
        };
    }

    // Récupérer une dépense par ID
    async getExpenseById(id: number) {
        /*const cacheKey = `sharedExpenseById:${id}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const sharedExpense = await SharedExpenseModel.findByPk(id, {
            include: [
                {
                    model: UserModel,
                    as: 'initiator',
                    attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
                },
                {
                    model: ParticipantSharedExpenseModel,
                    as: 'participants',
                    attributes: ['userId', 'sharedExpenseId', 'part', 'paymentStatus'],
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['firstname', 'lastname', 'phone', 'email']
                    }]
                }
            ]
        });

        /*if (sharedExpense) {
            await redisClient.set(cacheKey, JSON.stringify(sharedExpense), { EX: REDIS_TTL });
        }*/

        return sharedExpense;
    }

    // Lister toutes les dépenses
    async getAllExpenses(
        limit: number,
        startIndex: number,
        status?: 'PENDING' | 'COMPLETED' | 'CANCELLED',
        startDate?: string,
        endDate?: string
    ) {
        /*const cacheKey = `sharedExpenses:${limit}:${startIndex}:${status ?? 'all'}:${startDate ?? 'none'}:${endDate ?? 'none'}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const where: Record<string, any> = {};
        if (status) {
            where.status = status;
        }
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                const { start } = getUTCBoundaries(startDate);
                where.createdAt[Op.gte] = start;
            }
            if (endDate) {
                const { end } = getUTCBoundaries(endDate);
                where.createdAt[Op.lte] = end;
            }
            if (Object.keys(where.createdAt).length === 0) {
                delete where.createdAt;
            }
        }

        const result = await SharedExpenseModel.findAndCountAll({
            where,
            limit,
            offset: startIndex,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: UserModel,
                    as: 'initiator',
                    attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
                },
                {
                    model: ParticipantSharedExpenseModel,
                    as: 'participants',
                    attributes: ['userId', 'sharedExpenseId', 'part', 'paymentStatus'],
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['firstname', 'lastname', 'phone', 'email', 'id'],
                        include: [{
                            model: WalletModel,
                            as: 'wallet',
                            attributes: ['matricule', 'balance']
                        }]
                    }]
                }
            ]
        });

        //await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }

    async payExpense(
        sharedExpenseId: number, 
        userId: number
    ) {
        const transaction = await sequelize.transaction();

        try {
            const participant = await ParticipantSharedExpenseModel.findOne({
                where: {
                    sharedExpenseId,
                    userId
                },
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'email'],
                    include: [{ model: WalletModel, as: 'wallet' }]
                }]
            });

            const sharedExpense = await SharedExpenseModel.findByPk(sharedExpenseId, {
                include: [
                    { 
                        model: UserModel, 
                        as: 'initiator', 
                        attributes: ['id', 'firstname', 'lastname', 'email'],
                        include: [{ model: WalletModel, as: 'wallet' }]
                    }, 
                    {
                        model: ParticipantSharedExpenseModel,
                        as: 'participants',
                        attributes: ['userId', 'sharedExpenseId', 'part', 'paymentStatus']
                    }
                ]
            });
            
            if (!participant) {
                throw new Error("Participant non trouvé pour cette dépense");
            }
            if (participant.paymentStatus === typesPaymentStatusSharedExpense['1']) {
                throw new Error("Vous avez déjà été payé cette dépense");
            }
            if (sharedExpense?.status === typesStatusSharedExpense['2']) {
                throw new Error("Cette dépense a été annulée");
            }
            if (sharedExpense?.status === typesStatusSharedExpense['1']) {
                throw new Error("Cette dépense est déjà complétée");
            }

            //participant.paymentStatus = typesPaymentStatusSharedExpense['3'];
            const matricule = participant.user?.wallet?.matricule ?? '';
            if ((participant.user?.wallet?.balance ?? 0) < participant.part) {
                throw new Error("Le solde du portefeuille est insuffisant pour effectuer le paiement");
            }

            const transactionCreate: TransactionCreate = {
                amount: participant.part,
                description: 'Dépense partagée',
                userId,
                type: typesTransaction['5'],
                status: typesStatusTransaction['1'],
                currency: sharedExpense?.currency ?? typesCurrency['0'],
                totalAmount: participant.part,
                method: typesMethodTransaction['0'],
                provider: 'WALLET',
                receiverId: participant.userId,
                receiverType: 'User'
            }
            const transaction = await transactionService.createTransaction(transactionCreate)

            // On débite le wallet du payeur
            await walletService.debitWallet(
                matricule,
                participant.part,
                "Paiement dépense partagée",
                participant.user?.id,
                transaction.id
            )

            // On crédite le wallet de l'initiateur
            await walletService.creditWallet(
                sharedExpense?.initiator?.wallet?.matricule ?? '',
                participant.part,
                "Paiement dépense partagée",
                sharedExpense?.initiator?.id,
                transaction.id
            )
            
            // Mettre à jour le statut de paiement du participant
            participant.paymentStatus = typesPaymentStatusSharedExpense['1'];
            await participant.save();

            //Si tout le monde a payé, on met à jour le statut de la dépense
            const allPaid = await ParticipantSharedExpenseModel.count({
                where: {
                    sharedExpenseId,
                    paymentStatus: typesPaymentStatusSharedExpense['1']
                }
            });
            if (allPaid === sharedExpense?.participants?.length) {
                sharedExpense.status = typesStatusSharedExpense['1'];
                sharedExpense.save();
            }

            // Envoyer une notification à l'initiateur
            const tokenExpoInit = await notificationService.getTokenExpo(sharedExpense?.initiator?.id ?? 0);
            if (tokenExpoInit && participant.user) {
                await notificationService.save({
                    title: 'Sendo',
                    content: `Bonne nouvelle ! ${participant.user.firstname} a contribué ${participant.part} XAF à votre partage.`,
                    userId: sharedExpense?.initiator?.id ?? 0,
                    status: 'SENDED',
                    token: tokenExpoInit.token,
                    type: 'SHARED_EXPENSE'
                });
            }

            // Envoyer une notification au participant
            const tokenExpoParticipant = await notificationService.getTokenExpo(participant?.user?.id ?? 0);
            if (tokenExpoParticipant) {
                await notificationService.save({
                    title: 'Sendo',
                    content: `Vous avez contribué ${participant.part} XAF au partage de ${sharedExpense?.initiator?.firstname}. Merci`,
                    userId: participant?.user?.id ?? 0,
                    status: 'SENDED',
                    token: tokenExpoParticipant.token,
                    type: 'SHARED_EXPENSE'
                });
            }

            //On recharge le participant pour retourner les données mises à jour
            const neWParticipant = participant.reload();
            return neWParticipant;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async closeExpense(
        sharedExpenseId: number, 
        userId: number
    ) {
        const sharedExpense = await SharedExpenseModel.findByPk(sharedExpenseId, {
            include: [
                {
                    model: UserModel,
                    as: 'initiator',
                    attributes: ['firstname', 'lastname', 'email', 'id']
                },
                {
                    model: ParticipantSharedExpenseModel,
                    as: 'participants',
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['id', 'firstname', 'lastname', 'email']
                    }]
                }
            ]
        });
        if (!sharedExpense) {
            throw new Error("Dépense partagée non trouvée");
        }
        if (sharedExpense.userId !== userId) {
            throw new Error("Vous n'êtes pas l'initiateur de cette dépense");
        }
        if (sharedExpense.status === typesStatusSharedExpense['1']) {
            throw new Error("Cette dépense a déjà été clôturée");
        }

        // Envoyer une notification au participant
        if (sharedExpense.participants && sharedExpense.initiator) {
            for (const participant of sharedExpense.participants) {
                const tokenExpoParticipant = await notificationService.getTokenExpo(participant?.user?.id ?? 0);
                if (tokenExpoParticipant) {
                    await notificationService.save({
                        title: 'Sendo',
                        content: `La dépense partagée a été clôturée par l'initiateur ${sharedExpense.initiator.firstname} ${sharedExpense.initiator.lastname}`,
                        userId: participant?.user?.id ?? 0,
                        status: 'SENDED',
                        token: tokenExpoParticipant.token,
                        type: 'SHARED_EXPENSE'
                    });
                }
            }
        }
        
        //On supprime la dépense partagée avec ses participants
        await ParticipantSharedExpenseModel.destroy({
            where: {
                sharedExpenseId
            }
        });

        // On supprime la dépense partagée
        const deleted = await SharedExpenseModel.destroy({
            where: {
                id: sharedExpense.id
            }
        });

        return deleted
    }

    async closeAdminExpense(
        sharedExpenseId: number
    ) {
        const sharedExpense = await SharedExpenseModel.findByPk(sharedExpenseId, {
            include: [
                {
                    model: UserModel,
                    as: 'initiator',
                    attributes: ['firstname', 'lastname', 'email', 'id']
                },
                {
                    model: ParticipantSharedExpenseModel,
                    as: 'participants',
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['id', 'firstname', 'lastname', 'email']
                    }]
                }
            ]
        });
        if (!sharedExpense) {
            throw new Error("Dépense partagée non trouvée");
        }
        if (sharedExpense.status === typesStatusSharedExpense['1']) {
            throw new Error("Cette dépense a déjà été clôturée");
        }

        // Envoyer une notification au participant
        if (sharedExpense.participants && sharedExpense.initiator) {
            for (const participant of sharedExpense.participants) {
                const tokenExpoParticipant = await notificationService.getTokenExpo(participant?.user?.id ?? 0);
                if (tokenExpoParticipant) {
                    await notificationService.save({
                        title: 'Sendo',
                        content: `La dépense partagée #${sharedExpense.id} a été clôturée par SENDO. Raison : ${sharedExpense.cancelReason}`,
                        userId: participant?.user?.id ?? 0,
                        status: 'SENDED',
                        token: tokenExpoParticipant.token,
                        type: 'SHARED_EXPENSE'
                    });
                }
            }
        }
        
        //On supprime la dépense partagée avec ses participants
        await ParticipantSharedExpenseModel.destroy({
            where: {
                sharedExpenseId
            }
        });
        
        // On supprime la dépense partagée
        const deleted = await SharedExpenseModel.destroy({
            where: {
                id: sharedExpenseId
            }
        });

        return deleted
    }

    async listUserSharedExpense(userId: number) {
        /*const cacheKey = `listUserSharedExpense:${userId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const sharedExpenses = await SharedExpenseModel.findAll({
            where: { userId },
            include: [
                {
                    model: UserModel,
                    as: 'initiator',
                    attributes: ['id', 'firstname', 'lastname', 'phone', 'email'],
                },
                {
                    model: ParticipantSharedExpenseModel,
                    as: 'participants',
                    attributes: ['userId', 'sharedExpenseId', 'part', 'paymentStatus'],
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['firstname', 'lastname', 'phone', 'email', 'id'],
                        include: [{
                            model: WalletModel,
                            as: 'wallet',
                            attributes: ['matricule', 'balance']
                        }]
                    }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        //await redisClient.set(cacheKey, JSON.stringify(sharedExpenses), { EX: REDIS_TTL });
        return sharedExpenses;
    }

    async listSharedExpenseIncludeMe(userId: number) {
        /*const cacheKey = `listSharedExpenseIncludeMe:${userId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const sharedExpenses = await ParticipantSharedExpenseModel.findAll({
            where: { userId },
            include: [{
                model: SharedExpenseModel,
                as: 'sharedExpense',
                foreignKey: 'userId'
            }],
            order: [['createdAt', 'DESC']]
        });

        //await redisClient.set(cacheKey, JSON.stringify(sharedExpenses), { EX: REDIS_TTL });
        return sharedExpenses;
    }

    async updateExpenseWithRecalculation(
        expenseId: number,
        updateData: {
            participants?: Array<{
                matriculeWallet: string;
                amount?: number;
            }>;
            includeMyself?: boolean;
            methodCalculatingShare?: 'auto' | 'manual';
            totalAmount?: number;
            description?: string;
            limitDate?: Date;
        }
    ) {
        return sequelize.transaction(async (t) => {
            // 1. Récupérer la dépense existante
            const expense = await SharedExpenseModel.findByPk(expenseId, { 
                transaction: t 
            });
            if (!expense) {
                throw new Error('Dépense partagée non trouvée');
            }

            // 2. Récupérer le wallet de l’initiateur
            const initiatorUser = await UserModel.findByPk(expense.userId, {
                include: [{ model: WalletModel, as: 'wallet' }],
                transaction: t,
            });
            if (!initiatorUser || !initiatorUser.wallet) {
                throw new Error("Wallet de l'initiateur introuvable");
            }

            // 3. Préparer la liste des participants (mise à jour ou nouvelle)
            let participantsData = updateData.participants ?? [];

            // Ajouter l’initiateur si includeMyself est vrai
            if (updateData.includeMyself) {
                const initiatorMatricule = initiatorUser.wallet.matricule;
                if (!participantsData.some(p => p.matriculeWallet === initiatorMatricule)) {
                    participantsData = [...participantsData, { matriculeWallet: initiatorMatricule, amount: 0 }];
                }
            }

            if (!participantsData.length) {
                throw new Error("Liste des participants invalide");
            }

            // 4. Récupérer les utilisateurs liés aux matricules
            const matricules = participantsData.map(p => p.matriculeWallet);
            const users = await UserModel.findAll({
                include: [{
                    model: WalletModel,
                    as: 'wallet',
                    where: { matricule: matricules },
                    required: true
                }],
                transaction: t
            });

            // Vérifier que tous les matricules sont valides
            const missingMatricules = matricules.filter(m => !users.some(u => u.wallet?.matricule === m));
            if (missingMatricules.length > 0) {
                throw new Error(`Matricules invalides : ${missingMatricules.join(', ')}`);
            }

            const matriculeToUserId = users.reduce((acc, user) => {
                if (user.wallet?.matricule) {
                    acc[user.wallet.matricule] = user.id;
                }
                return acc;
            }, {} as Record<string, number>);

            // 5. Calcul des parts
            const totalAmount = updateData.totalAmount ?? expense.totalAmount;
            let initiatorPart = 0;
            let methodCalculatingShare = updateData.methodCalculatingShare ?? expense.methodCalculatingShare;

            if (methodCalculatingShare === 'manual') {
                const totalManualAmount = participantsData.reduce((sum, p) => sum + (p.amount || 0), 0);
                if (totalManualAmount !== totalAmount) {
                    throw new Error("Le montant total des parts manuelles ne correspond pas au montant total de la dépense");
                }
                initiatorPart = participantsData.find(p => p.matriculeWallet === initiatorUser.wallet?.matricule)?.amount || 0;
            } else {
                // Calcul automatique : part égale
                const nbParticipants = updateData.includeMyself ? participantsData.length : participantsData.length;
                const part = totalAmount / nbParticipants;
                initiatorPart = updateData.includeMyself ? part : 0;
                // Mettre à jour les parts dans participantsData
                participantsData = participantsData.map(p => ({
                    ...p,
                    amount: part
                }));
            }

            // 6. Mise à jour de la dépense
            await expense.update({
                totalAmount,
                description: updateData.description ?? expense.description,
                initiatorPart,
                limitDate: updateData.limitDate ?? expense.limitDate,
                methodCalculatingShare
            }, { transaction: t });

            // 7. Mise à jour des participants
            // Suppression des anciens participants liés à cette dépense
            await ParticipantSharedExpenseModel.destroy({
                where: { sharedExpenseId: expenseId },
                transaction: t
            });

            // Création des nouveaux participants
            await ParticipantSharedExpenseModel.bulkCreate(
                participantsData.map(p => ({
                    userId: matriculeToUserId[p.matriculeWallet],
                    sharedExpenseId: expenseId,
                    part: p.amount || 0,
                    paymentStatus: typesPaymentStatusSharedExpense['0']
                })),
                { transaction: t }
            );

            // 8. Recharger la dépense avec participants
            return expense.reload({
                include: [
                    { 
                        model: UserModel, 
                        as: 'initiator', 
                        attributes: ['id', 'firstname', 'lastname', 'email'] 
                    },
                    { 
                        model: ParticipantSharedExpenseModel, 
                        as: 'participants',
                        include: [
                            { 
                                model: UserModel, 
                                as: 'user', 
                                attributes: ['id', 'firstname', 'lastname', 'email'] 
                            }
                        ]
                    }
                ],
                transaction: t
            });
        });
    }

    async cancelSharedExpense(
        expenseId: number,
        cancelReason: string
    ) {
        const expense = await SharedExpenseModel.findByPk(expenseId, {
            include: [
                {
                    model: UserModel,
                    as: 'initiator',
                    attributes: ['id', 'firstname', 'lastname', 'email']
                },
                {
                    model: ParticipantSharedExpenseModel,
                    as: 'participants',
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['id', 'firstname', 'lastname', 'email']
                    }]
                }
            ]
        });
        if (!expense) {
            throw new Error('Dépense partagée introuvable');
        }

        if (expense.status === 'CANCELLED') {
            throw new Error('La dépense est déjà annulée');
        }

        await expense.update({
            status: typesStatusSharedExpense['2'],
            cancelReason
        });

        // Envoyer une notification au participant
        if (expense.participants) {
            for (const participant of expense.participants) {
                const tokenExpoParticipant = await notificationService.getTokenExpo(participant?.user?.id ?? 0);
                if (tokenExpoParticipant) {
                    await notificationService.save({
                        title: 'Sendo',
                        content: `La demande #${expense.id} vient d'etre annulée avec pour raison : ${cancelReason}`,
                        userId: participant?.user?.id ?? 0,
                        status: 'SENDED',
                        token: tokenExpoParticipant.token,
                        type: 'SHARED_EXPENSE'
                    });
                }
            }
        }

        return expense.reload();
    }

    async cancelPaymentSharedExpense(
        participantId: number
    ) {
        const participantSharedExpense = await ParticipantSharedExpenseModel.findByPk(participantId, {
            include: [{
                model: UserModel,
                as: 'user',
                attributes: ['id', 'firstname', 'lastname', 'email']
            }]
        })
        if (!participantSharedExpense) {
            throw new Error("Demande de paiement introuvable")
        }

        await participantSharedExpense!.update({
            paymentStatus: 'REFUSED'
        })

        // Envoyer une notification au participant
        const tokenExpoParticipant = await notificationService.getTokenExpo(participantSharedExpense!.user!.id);
        if (tokenExpoParticipant) {
            await notificationService.save({
                title: 'Sendo',
                content: `Vous venez d'annuler la demande de paiement #${participantSharedExpense?.sharedExpenseId}`,
                userId: participantSharedExpense!.user!.id,
                status: 'SENDED',
                token: tokenExpoParticipant.token,
                type: 'SHARED_EXPENSE'
            });
        }

        return participantSharedExpense!.reload();
    }

    async updateStatusSharedExpense(
        expenseId: number,
        status: 'PENDING' | 'COMPLETED'
    ) {
        const expense = await SharedExpenseModel.findByPk(expenseId, {
            include: [
                {
                    model: UserModel,
                    as: 'initiator',
                    attributes: ['id', 'firstname', 'lastname', 'email']
                },
                {
                    model: ParticipantSharedExpenseModel,
                    as: 'participants',
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['id', 'firstname', 'lastname', 'email']
                    }]
                }
            ]
        });
        if (!expense) {
            throw new Error('Dépense partagée introuvable');
        }

        await expense.update({
            status
        });

        // Envoyer une notification au participant
        if (expense.participants && expense.participants.length > 0) {
            for (const participant of expense.participants) {
                const tokenExpoParticipant = await notificationService.getTokenExpo(participant?.user?.id ?? 0);
                if (tokenExpoParticipant) {
                    await notificationService.save({
                        title: 'Sendo',
                        content: `Le status de cette demande ${expense.description} vient d'être modifié. Nouveau status : ${status}`,
                        userId: participant?.user?.id ?? 0,
                        status: 'SENDED',
                        token: tokenExpoParticipant.token,
                        type: 'SHARED_EXPENSE'
                    });
                }
            }
        }

        return expense.reload();
    }
}

export default new SharedExpenseService()