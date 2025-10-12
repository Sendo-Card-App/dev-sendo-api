import { col, fn, Op } from 'sequelize';
import UserModel from '@models/user.model';
import RoleModel from '@models/role.model';
import WalletModel from '@models/wallet.model';
import TransactionModel from '@models/transaction.model';
import VirtualCardModel from '@models/virtualCard.model';
import RequestModel from '@models/request.model';
import SharedExpenseModel from '@models/shared-expense.model';
import ParticipantSharedExpenseModel from '@models/participant-shared-expense.model';
import FundRequestModel from '@models/fund-request.model';
import TontineModel from '@models/tontine.model';
import MembreTontineModel from '@models/membre-tontine.model';
import CotisationModel from '@models/cotisation.model';
import sequelize from '@config/db';
import { TypesTransaction } from '@utils/constants';
import cardService from './cardService';
import PaymentMethodModel from '@models/payment-method.model';

// Interface pour le typage fort
export interface UserStatistics {
    totalUsers: number;
    dailyRegistrations: Array<{ date: string; count: number }>;
    verificationStats: {
        email: number;
        phone: number;
        kyc: number;
    };
    geographicDistribution: Array<{ region: string | null; count: number }>;
    statusDistribution: Array<{ status: string; count: number }>;
}

class StatisticsService {
    /**
     * Récupère les statistiques complètes des utilisateurs
     */
    static async getUserStatistics(): Promise<UserStatistics> {
        try {
            return await sequelize.transaction(async transaction => {
                const queries = [
                    UserModel.count({ transaction }),
                    
                    UserModel.findAll({
                        attributes: [
                            [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
                            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                        ],
                        where: {
                            createdAt: { [Op.gte]: sequelize.literal('CURRENT_DATE - INTERVAL 7 DAY') }
                        },
                        group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
                        order: sequelize.literal('DATE(`createdAt`) ASC'),
                        transaction
                    }),

                    UserModel.count({ where: { isVerifiedEmail: true }, transaction }),
                    UserModel.count({ where: { isVerifiedPhone: true }, transaction }),
                    UserModel.count({ where: { isVerifiedKYC: true }, transaction }),
                    
                    UserModel.findAll({
                        attributes: [
                            'region',
                            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                        ],
                        group: ['region'],
                        order: [[sequelize.literal('count'), 'DESC']],
                        limit: 5,
                        transaction
                    }),

                    UserModel.findAll({
                        attributes: [
                            'status',
                            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                        ],
                        group: ['status'],
                        transaction
                    })
                ];

                const [
                    totalUsersRaw,
                    dailyRegistrations,
                    emailVerifiedRaw,
                    phoneVerifiedRaw,
                    kycVerifiedRaw,
                    regions,
                    statuses
                ] = await Promise.all(queries);

                // Ensure counts are numbers (not arrays)
                const totalUsers = Array.isArray(totalUsersRaw) ? totalUsersRaw.length : totalUsersRaw;
                const emailVerified = Array.isArray(emailVerifiedRaw) ? emailVerifiedRaw.length : emailVerifiedRaw;
                const phoneVerified = Array.isArray(phoneVerifiedRaw) ? phoneVerifiedRaw.length : phoneVerifiedRaw;
                const kycVerified = Array.isArray(kycVerifiedRaw) ? kycVerifiedRaw.length : kycVerifiedRaw;

                return {
                    totalUsers,
                    dailyRegistrations: Array.isArray(dailyRegistrations)
                    ? dailyRegistrations.map(d => ({
                        date: d.get('date') as string,
                        count: Number(d.get('count'))
                        }))
                    : [],
                    verificationStats: {
                        email: emailVerified,
                        phone: phoneVerified,
                        kyc: kycVerified
                    },
                    geographicDistribution: Array.isArray(regions)
                    ? regions.map(r => ({
                        region: r.region,
                        count: Number(r.get('count'))
                        }))
                    : [],
                    statusDistribution: Array.isArray(statuses)
                    ? statuses.map(s => ({
                        status: s.status,
                        count: Number(s.get('count'))
                        }))
                    : []
                };
            });
        } catch (error) {
            throw new Error(`Échec des statistiques utilisateurs: ${(error as Error).message}`);
        }
    }

    /**
     * Récupère des statistiques sur les wallets
     */
    static async getWalletStatistics() {
        try {
            return await sequelize.transaction(async transaction => {
                const [
                    totalWallets,
                    totalBalanceRaw,
                    averageBalanceRaw,
                    topWallets,
                    currencyDistribution
                ] = await Promise.all([
                    WalletModel.count({ transaction }),

                    WalletModel.sum('balance', { transaction }),

                    WalletModel.findOne({
                        attributes: [[sequelize.fn('AVG', sequelize.col('balance')), 'averageBalance']],
                        raw: true,
                        transaction
                    }),

                    WalletModel.findAll({
                        attributes: ['userId', 'balance'],
                        order: [['balance', 'DESC']],
                        limit: 5,
                        transaction,
                        include: [{ 
                            model: UserModel, 
                            as: 'user', 
                            attributes: ['firstname', 'lastname', 'email', 'phone']
                        }]
                    }),

                    WalletModel.findAll({
                        attributes: ['currency', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                        group: ['currency'],
                        transaction
                    })
                ]);

                const averageBalance = averageBalanceRaw && typeof averageBalanceRaw === 'object' && 'averageBalance' in averageBalanceRaw
                    ? Number((averageBalanceRaw as { averageBalance: string | number }).averageBalance)
                    : 0;

                return {
                    totalWallets,
                    totalBalance: totalBalanceRaw || 0,
                    averageBalance,
                    topWallets: topWallets.map(w => ({
                        userId: w.userId,
                        balance: Number(w.balance),
                        user: {
                            name: w.user?.firstname +' '+ w.user?.lastname,
                            phone: w.user?.phone,
                            email: w.user?.email
                        }
                    })),
                    currencyDistribution: currencyDistribution.map(c => ({
                        currency: c.currency,
                        count: Number(c.get('count'))
                    }))
                };
            });
        } catch (error) {
            throw new Error(`Échec des statistiques wallets: ${(error as Error).message}`);
        }
    }

    /**
     * Récupère des statistiques sur les transactions
     */
    static async getTransactionStatistics(startDate: string, endDate: string) {
        try {
            const whereClause: { [key: string]: any } = {};
            if (startDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.gte]: startDate };
            }
            if (endDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.lte]: endDate };
            }
            return await sequelize.transaction(async transaction => {
                const [
                    totalTransactions,
                    totalAmountRaw,
                    averageAmountRaw,
                    statusDistribution,
                    typeDistribution,
                    recentTransactions
                ] = await Promise.all([
                    // Nombre total de transactions
                    TransactionModel.count({ where: whereClause, transaction }),

                    // Somme totale des montants
                    TransactionModel.sum('totalAmount', { where: whereClause, transaction }),

                    // Montant moyen des transactions
                    TransactionModel.findOne({
                        attributes: [[fn('AVG', col('amount')), 'averageAmount']],
                        where: whereClause,
                        raw: true,
                        transaction
                    }),

                    // Répartition par statut
                    TransactionModel.findAll({
                        attributes: ['status', [fn('COUNT', col('id')), 'count']],
                        where: whereClause,
                        group: ['status'],
                        transaction
                    }),

                    // Répartition par type
                    TransactionModel.findAll({
                        attributes: ['type', [fn('COUNT', col('id')), 'count']],
                        where: whereClause,
                        group: ['type'],
                        transaction
                    }),

                    // Dernières transactions des 7 derniers jours
                    TransactionModel.findAll({
                        where: {
                            ...whereClause,
                            createdAt: {
                                ...(whereClause.createdAt || {}),
                                [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                            }
                        },
                        order: [['createdAt', 'DESC']],
                        limit: 10,
                        transaction
                    })
                ]);

                const averageAmount = averageAmountRaw && typeof averageAmountRaw === 'object' && 'averageAmount' in averageAmountRaw 
                    ? Number((averageAmountRaw as { averageAmount: string | number }).averageAmount) 
                    : 0;

                return {
                    totalTransactions,
                    totalAmount: totalAmountRaw || 0,
                    averageAmount,
                    statusDistribution: statusDistribution.map(s => ({
                        status: s.status,
                        count: Number(s.get('count'))
                    })),
                    typeDistribution: typeDistribution.map(t => ({
                        type: t.type,
                        count: Number(t.get('count'))
                    })),
                    recentTransactions: recentTransactions.map(tx => ({
                        transactionId: tx.transactionId,
                        amount: tx.amount,
                        currency: tx.currency,
                        type: tx.type,
                        status: tx.status,
                        createdAt: tx.createdAt
                    }))
                };
            });
        } catch (error) {
            throw new Error(`Échec des statistiques transactions : ${(error as Error).message}`);
        }
    }

    /**
     * Récupère des statistiques sur le partage entre amis
     */
    static async getSharedExpenseStatistics(startDate: string, endDate: string) {
        try {
            const whereClause: { [key: string]: any } = {};
            if (startDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.gte]: startDate };
            }
            if (endDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.lte]: endDate };
            }
            return await sequelize.transaction(async transaction => {
                const [
                    totalSharedExpenses,
                    statusDistribution,
                    totalAmountSharedRaw,
                    topContributors,
                    recentSharedExpenses,
                    participantsCountByExpenseRaw
                ] = await Promise.all([
                    SharedExpenseModel.count({ where: whereClause, transaction }),

                    SharedExpenseModel.findAll({
                        attributes: ['status', [fn('COUNT', col('id')), 'count']],
                        where: whereClause,
                        group: ['status'],
                        transaction
                    }),

                    SharedExpenseModel.sum('totalAmount', {
                        where: { ...whereClause, status: { [Op.not]: 'CANCELLED' } },
                        transaction
                    }),

                    ParticipantSharedExpenseModel.findAll({
                        attributes: [
                            'userId',
                            [fn('SUM', col('part')), 'totalContributed']
                        ],
                        group: ['userId'],
                        order: [[fn('SUM', col('part')), 'DESC']],
                        limit: 5,
                        transaction,
                        include: [{
                            model: UserModel,
                            as: 'user',
                            attributes: ['firstname', 'lastname']
                        }]
                    }),

                    SharedExpenseModel.findAll({
                        order: [['createdAt', 'DESC']],
                        limit: 5,
                        transaction,
                        include: [{
                            model: UserModel,
                            as: 'initiator',
                            attributes: ['firstname', 'lastname']
                        }],
                        where: whereClause
                    }),

                    ParticipantSharedExpenseModel.findAll({
                        attributes: [
                            'sharedExpenseId',
                            [fn('COUNT', col('id')), 'participantCount']
                        ],
                        group: ['sharedExpenseId'],
                        raw: true,
                        transaction
                    })
                ]);

                // Calcul de la moyenne des participants
                const participantsCountByExpense: Array<{ sharedExpenseId: number; participantCount?: string }> = participantsCountByExpenseRaw;
                const totalParticipants = participantsCountByExpense.reduce((sum, item) => sum + parseInt(item.participantCount ?? '0', 10), 0);
                const averageParticipants = participantsCountByExpense.length > 0 ? totalParticipants / participantsCountByExpense.length : 0;

                return {
                    totalSharedExpenses,
                    averageParticipants,
                    statusDistribution: statusDistribution.map(s => ({
                        status: s.status,
                        count: Number(s.get('count'))
                    })),
                    totalAmountShared: totalAmountSharedRaw || 0,
                    topContributors: topContributors.map(c => ({
                        userId: c.userId,
                        totalContributed: Number(c.get('totalContributed')),
                        user: c.user ? {
                            name: `${c.user.firstname} ${c.user.lastname}`
                        } : null
                    })),
                    recentSharedExpenses: recentSharedExpenses.map(expense => ({
                        id: expense.id,
                        totalAmount: expense.totalAmount,
                        description: expense.description,
                        status: expense.status,
                        initiator: expense.initiator ? `${expense.initiator.firstname} ${expense.initiator.lastname}` : 'Anonyme',
                        createdAt: expense.createdAt
                    }))
                };
            });
        } catch (error) {
            throw new Error(`Échec des statistiques des dépenses partagées : ${(error as Error).message}`);
        }
    }

    /**
     * Récupère des statistiques sur les demandes de fonds
     */
    static async getRequestFundsStatistics(startDate: string, endDate: string) {
        try {
            const whereClause: { [key: string]: any } = {};
            if (startDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.gte]: startDate };
            }
            if (endDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.lte]: endDate };
            }
            return await sequelize.transaction(async transaction => {
                // 1. Nombre total de demandes de fonds
                const totalFundRequests = await FundRequestModel.count({ where: whereClause, transaction });

                // 2. Répartition des demandes par statut
                const statusDistribution = await FundRequestModel.findAll({
                    attributes: ['status', [fn('COUNT', col('id')), 'count']],
                    where: whereClause,
                    group: ['status'],
                    transaction
                });

                // 3. Montant total demandé (hors annulées)
                const totalAmountRequested = await FundRequestModel.sum('amount', {
                    where: { ...whereClause, status: { [Op.not]: 'CANCELLED' } },
                    transaction
                });

                // 4. Top 5 des demandeurs par montant total demandé
                const topRequesters = await FundRequestModel.findAll({
                    attributes: [
                        'userId',
                        [fn('SUM', col('amount')), 'totalRequested']
                    ],
                    where: whereClause,
                    group: ['userId'],
                    order: [[fn('SUM', col('amount')), 'DESC']],
                    limit: 5,
                    transaction,
                    include: [{
                        model: UserModel,
                        as: 'requesterFund',
                        attributes: ['firstname', 'lastname']
                    }]
                });

                // 5. 5 dernières demandes de fonds
                const recentFundRequests = await FundRequestModel.findAll({
                    where: whereClause,
                    order: [['createdAt', 'DESC']],
                    limit: 5,
                    transaction,
                    include: [{
                        model: UserModel,
                        as: 'requesterFund',
                        attributes: ['firstname', 'lastname']
                    }]
                });

                return {
                    total: totalFundRequests,
                    statusDistribution: statusDistribution.map(s => ({
                        status: s.status,
                        count: Number(s.get('count'))
                    })),
                    totalAmountRequested: totalAmountRequested || 0,
                    topRequesters: topRequesters.map(r => ({
                        userId: r.userId,
                        totalRequested: Number(r.get('totalRequested')),
                        user: r.requesterFund ? `${r.requesterFund.firstname} ${r.requesterFund.lastname}` : null
                    })),
                    recent: recentFundRequests.map(request => ({
                        id: request.id,
                        amount: request.amount,
                        description: request.description,
                        status: request.status,
                        requester: request.requesterFund ? `${request.requesterFund.firstname} ${request.requesterFund.lastname}` : 'Anonyme',
                        createdAt: request.createdAt
                    }))
                };
            });
        } catch (error) {
            throw new Error(`Échec des statistiques des demandes de fonds : ${(error as Error).message}`);
        }
    }

    /**
     * Récupère des statistiques sur la eTontine
     */
    static async getTontineStatistics(startDate: string, endDate: string) {
        try {
            const whereClause: { [key: string]: any } = {};
            if (startDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.gte]: startDate };
            }
            if (endDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.lte]: endDate };
            }
            return await sequelize.transaction(async transaction => {
                const [
                    totalTontines,
                    totalAmountRaw,
                    averageAmountRaw,
                    statusDistribution,
                    typeDistribution,
                    topParticipantsRaw,
                    recentTontines
                ] = await Promise.all([
                    TontineModel.count({ transaction, where: whereClause }),

                    TontineModel.sum('montant', { transaction, where: whereClause }),

                    TontineModel.findOne({
                        attributes: [[sequelize.fn('AVG', sequelize.col('montant')), 'averageAmount']],
                        raw: true,
                        transaction,
                        where: whereClause
                    }),

                    TontineModel.findAll({
                        attributes: ['etat', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                        group: ['etat'],
                        transaction,
                        where: whereClause
                    }),

                    TontineModel.findAll({
                        attributes: ['type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                        group: ['type'],
                        transaction,
                        where: whereClause
                    }),

                    // Top participants par somme cotisée
                    CotisationModel.findAll({
                        attributes: [
                            'membreId',
                            [sequelize.fn('SUM', sequelize.col('CotisationModel.montant')), 'totalCotise']
                        ],
                        include: [{
                            model: MembreTontineModel,
                            as: 'membre',
                            include: [
                                {
                                    model: UserModel,
                                    as: 'user',
                                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone']
                                },
                                {
                                    model: TontineModel,
                                    as: 'tontine',
                                    where: whereClause,
                                    attributes: []
                                }
                            ],
                            attributes: []
                        }],
                        group: ['membreId', 'membre.user.id'],
                        order: [[sequelize.literal('totalCotise'), 'DESC']],
                        limit: 5,
                        transaction,
                        raw: true
                    }),

                    TontineModel.findAll({
                        order: [['createdAt', 'DESC']],
                        limit: 5,
                        transaction,
                        where: whereClause
                    })
                ]);

                const averageAmount = averageAmountRaw && typeof averageAmountRaw === 'object' && 'averageAmount' in averageAmountRaw
                    ? Number((averageAmountRaw as { averageAmount: string | number }).averageAmount)
                    : 0;
                const totalCotise = topParticipantsRaw && typeof topParticipantsRaw === 'object' && 'totalCotise' in topParticipantsRaw
                    ? Number((topParticipantsRaw as { totalCotise: string | number }).totalCotise)
                    : 0;

                return {
                    totalTontines,
                    totalAmount: totalAmountRaw || 0,
                    averageAmount,
                    statusDistribution: statusDistribution.map(s => ({
                        status: s.etat,
                        count: Number(s.get('count'))
                    })),
                    typeDistribution: typeDistribution.map(t => ({
                        type: t.type,
                        count: Number(t.get('count'))
                    })),
                    topParticipants: topParticipantsRaw.map(c => ({
                        userId: c?.membre?.user?.id,
                        totalCotise: totalCotise
                    })),
                    recentTontines: recentTontines.map(t => ({
                        id: t.id,
                        montantTotal: t.montant,
                        status: t.etat,
                        createdAt: t.createdAt
                    }))
                };
            });
        } catch (error) {
            throw new Error(`Échec des statistiques tontines : ${(error as Error).message}`);
        }
    }

    /**
     * Récupère des statistiques sur les cartes virtuelles
     */
    static async getVirtualCardStatistics(startDate: string, endDate: string) {
        try {
            const whereClause: { [key: string]: any } = {};
            if (startDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.gte]: startDate };
            }
            if (endDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.lte]: endDate };
            }

            return await sequelize.transaction(async transaction => {
                const [
                    totalCards,
                    statusDistribution,
                    recentCards,
                    totalTrasactionsCardRaw
                ] = await Promise.all([
                    // Nombre total de cartes virtuelles
                    VirtualCardModel.count({ transaction, where: whereClause }),

                    // Répartition par statut
                    VirtualCardModel.findAll({
                        attributes: ['status', [fn('COUNT', col('id')), 'count']],
                        group: ['status'],
                        transaction,
                        where: whereClause
                    }),

                    // Dernières cartes créées (exemple : 5 dernières)
                    VirtualCardModel.findAll({
                        order: [['createdAt', 'DESC']],
                        limit: 5,
                        transaction,
                        where: whereClause
                    }),

                    // Montant total des transactions sur les cartes
                    TransactionModel.sum('totalAmount', {
                        where: {
                            method: 'VIRTUAL_CARD',
                            ...(startDate || endDate ? { createdAt: whereClause.createdAt } : {}),
                            //status: { [Op.not]: 'CANCELLED' }
                        },
                        transaction
                    })
                ]);

                // Récupérer toutes les cartes actives (non terminées)
                const activeCards = await VirtualCardModel.findAll({
                    where: {
                        status: {
                            [Op.notIn]: ['TERMINATED', 'IN_TERMINATION']
                        },
                        ...(startDate || endDate ? { createdAt: whereClause.createdAt } : {})
                    },
                    transaction
                });

                /*let totalBalanceCards = 0;

                // Calculer le solde total cumulé via l'API cardService pour chaque carte active
                for (const card of activeCards) {
                    const paymentMethod = await cardService.getPaymentMethod(undefined, undefined, Number(card.id), 'NEERO_CARD');
                    if (!paymentMethod) {
                        throw new Error("Carte ou portefeuille Sendo introuvable");
                    }
                    const balance = await cardService.getBalance(paymentMethod.paymentMethodId);
                    totalBalanceCards += balance;
                }

                // Ajouter le solde à chaque carte récente
                const recentCardsWithBalance = [];
                for (const card of recentCards) {
                    const paymentMethod = await cardService.getPaymentMethod(undefined, undefined, Number(card.id), undefined);
                    if (!paymentMethod) {
                        throw new Error("Carte ou portefeuille Sendo introuvable");
                    }

                    const balance = await cardService.getBalance(paymentMethod.paymentMethodId);
                    recentCardsWithBalance.push({
                        id: card.id,
                        cardId: card.cardId,
                        cardName: card.cardName,
                        status: card.status,
                        createdAt: card.createdAt,
                        balance
                    });
                }*/

                return {
                    totalCards,
                    statusDistribution: statusDistribution.map(s => ({
                        status: s.status,
                        count: Number(s.get('count'))
                    })),
                    recentCards: activeCards,
                    totalAmountTransactionsCard: totalTrasactionsCardRaw || 0,
                    //totalBalanceCards
                };
            });
        } catch (error) {
            throw new Error(`Échec des statistiques cartes virtuelles : ${(error as Error).message}`);
        }
    }

    /**
     * Récupère des statistiques sur les demandes
     */
    static async getRequestStatistics(startDate: string, endDate: string) {
        try {
            const whereClause: { [key: string]: any } = {};
            if (startDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.gte]: startDate };
            }
            if (endDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.lte]: endDate };
            }
            return await sequelize.transaction(async transaction => {
                const [
                    totalRequests,
                    typeDistribution,
                    statusDistribution,
                    recentRequests
                ] = await Promise.all([
                    // Nombre total de demandes
                    RequestModel.count({ transaction, where: whereClause }),

                    // Répartition par type
                    RequestModel.findAll({
                        attributes: ['type', [fn('COUNT', col('id')), 'count']],
                        group: ['type'],
                        transaction,
                        where: whereClause
                    }),

                    // Répartition par statut
                    RequestModel.findAll({
                        attributes: ['status', [fn('COUNT', col('id')), 'count']],
                        group: ['status'],
                        transaction,
                        where: whereClause
                    }),

                    // Dernières demandes créées (exemple : 5 dernières)
                    RequestModel.findAll({
                        order: [['createdAt', 'DESC']],
                        limit: 5,
                        transaction,
                        where: whereClause,
                    })
                ]);

                return {
                    totalRequests,
                    typeDistribution: typeDistribution.map(t => ({
                        type: t.type,
                        count: Number(t.get('count'))
                    })),
                    statusDistribution: statusDistribution.map(s => ({
                        status: s.status,
                        count: Number(s.get('count'))
                    })),
                    recentRequests: recentRequests.map(req => ({
                        id: req.id,
                        type: req.type,
                        status: req.status,
                        description: req.description,
                        userId: req.userId,
                        reviewedById: req.reviewedById,
                        createdAt: req.createdAt    
                    }))
                };
            });
        } catch (error) {
            throw new Error(`Échec des statistiques demandes : ${(error as Error).message}`);
        }
    }

    /**
     * Statistiques avancées des rôles utilisateurs
     */
    static async getRoleStatistics() {
        return RoleModel.findAll({
            attributes: [
                'name',
                [sequelize.fn('COUNT', sequelize.col('users.id')), 'userCount']
            ],
            include: [{
                model: UserModel,
                attributes: [],
                through: { attributes: [] },
                as: 'users'
            }],
            group: ['RoleModel.id'],
            raw: true
        });
    }

    /**
     * Récupère toutes les commissions Sendo perçues
     */
    static async getSendoFeesStatistics(startDate: string, endDate: string, type?: TypesTransaction) {
        try {
            const whereClause: { [key: string]: any } = {
                //sendoFees: { [Op.gt]: 0 }
            };
            if (startDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.gte]: startDate };
            }
            if (endDate) {
                whereClause.createdAt = { ...(whereClause.createdAt || {}), [Op.lte]: endDate };
            }
            if (type) {
                whereClause.type = type;
            }

            return await sequelize.transaction(async transaction => {
                const [
                    totalFeesRaw,
                    averageFeesRaw,
                    feesByType,
                    recentFees
                ] = await Promise.all([
                    // Somme totale des commissions
                    TransactionModel.sum('sendoFees', { 
                        where: {
                            ...whereClause,
                            status: 'COMPLETED'
                        }, 
                        transaction 
                    }),

                    // Commission moyenne par transaction
                    TransactionModel.findOne({
                        attributes: [[fn('AVG', col('sendoFees')), 'averageFees']],
                        where: {
                            ...whereClause,
                            status: 'COMPLETED'
                        }, 
                        raw: true,
                        transaction
                    }),

                    // Commissions par type de transaction
                    // Ici, si un type est donné, on peut renvoyer juste ce type,
                    // sinon tous les types regroupés
                    TransactionModel.findAll({
                        attributes: ['type', [fn('SUM', col('sendoFees')), 'totalFees']],
                        where: {
                            ...whereClause,
                            status: 'COMPLETED'
                        }, 
                        group: ['type'],
                        transaction
                    }),

                    // Dernières transactions avec commission (exemple : 10 dernières)
                    TransactionModel.findAll({
                        where: whereClause,
                        order: [['createdAt', 'DESC']],
                        limit: 10,
                        transaction
                    })
                ]);
                const totalFees = totalFeesRaw || 0;
                const averageFees = averageFeesRaw && typeof averageFeesRaw === 'object' && 'averageFees' in averageFeesRaw 
                    ? Number((averageFeesRaw as { averageFees: string | number }).averageFees)
                    : 0;

                return {
                    totalFees,
                    averageFees,
                    feesByType: feesByType.map(f => ({
                        type: f.type,
                        totalFees: Number(f.get('totalFees'))
                    })),
                    recentFees: recentFees.map(tx => ({
                        transactionId: tx.transactionId,
                        amount: tx.amount,
                        totalAmount: tx.totalAmount,
                        sendoFees: tx.sendoFees,
                        type: tx.type,
                        status: tx.status,
                        currency: tx.currency,
                        createdAt: tx.createdAt
                    }))
                };
            });
        } catch (error) {
            throw new Error(`Échec des statistiques des commissions : ${(error as Error).message}`);
        }
    }
}

export default StatisticsService;