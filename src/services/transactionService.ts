import TransactionModel from "@models/transaction.model";
import { TransactionCreate } from "../types/Transaction";
import UserModel from "@models/user.model";
import WalletModel from "@models/wallet.model";
import { Op, Transaction } from "sequelize";
import { getUTCBoundaries } from "@utils/functions";
import walletService from "./walletService";
import mobileMoneyService from "./mobileMoneyService";
import { TypesMethodTransaction, typesMethodTransaction, typesNotification, TypesTransaction, typesTransaction } from "@utils/constants";
import mobileMoneyController from "@controllers/mobileMoneyController";
import notificationService from "./notificationService";
import VirtualCardModel from "@models/virtualCard.model";
import neeroService from "./neeroService";
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

class TransactionService {
    async getAllTransactions(
        limit: number,
        startIndex: number,
        type?: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER',
        status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'BLOCKED',
        method?: 'MOBILE_MONEY' | 'BANK_TRANSFER',
        startDate?: string,
        endDate?: string
    ) {
        /*const cacheKey = `allTransactions:${limit}:${startIndex}:${type ?? 'all'}:${status ?? 'all'}:${method ?? 'all'}:${startDate ?? 'none'}:${endDate ?? 'none'}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const where: Record<string, any> = {};
        if (type) where.type = type;
        if (status) where.status = status;
        if (method) where.method = method;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = getUTCBoundaries(startDate).start;
            if (endDate) where.createdAt[Op.lte] = getUTCBoundaries(endDate).end;
            if (Object.keys(where.createdAt).length === 0) delete where.createdAt;
        }

        const result = await TransactionModel.findAndCountAll({
            where,
            limit,
            offset: startIndex,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone']
                },
                {
                    model: VirtualCardModel,
                    as: 'card'
                }
            ]
        });

        const transactionsWithReceivers = await Promise.all(
            result.rows.map(async (transaction) => {
                const receiver = await transaction.getReceiver();
                return {
                    ...transaction.toJSON(),
                    receiver
                };
            })
        );

        const cachedResult = {
            count: result.count,
            rows: transactionsWithReceivers
        };

        //await redisClient.set(cacheKey, JSON.stringify(cachedResult), { EX: REDIS_TTL });
        return cachedResult;
    }

    async createTransaction(transaction: TransactionCreate, options?: { transaction: Transaction }) {
        return await TransactionModel.create(transaction, { transaction: options?.transaction });
    }

    async getTransaction(transactionId: string) {
        /*const cacheKey = `transaction:${transactionId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const transaction = await TransactionModel.findOne({
            where: { transactionId },
            include: [
                {
                model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone'],
                    include: [
                        {
                            model: WalletModel,
                            as: 'wallet',
                            attributes: ['matricule', 'balance', 'userId', 'status']
                        }
                    ]
                },
                {
                    model: VirtualCardModel,
                    as: 'card'
                }
            ]
        });
        if (!transaction) throw new Error("Transaction introuvable");

        //await redisClient.set(cacheKey, JSON.stringify(transaction), { EX: REDIS_TTL });
        return transaction;
    }

    async getTransactionWithReceiver(transactionId: string) {
        /*const cacheKey = `transactionWithReceiver:${transactionId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const transaction = await TransactionModel.findOne({
            where: { transactionId },
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone'],
                    include: [{
                        model: WalletModel,
                        as: 'wallet',
                        attributes: ['matricule', 'balance', 'userId', 'status']
                    }]
                },
                {
                    model: VirtualCardModel,
                    as: 'card'
                }
            ]
        });
        if (!transaction) throw new Error("Transaction introuvable");

        const receiver = await transaction.getReceiver();

        const result = {
            ...transaction.toJSON(),
            receiver
        };

        //await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }

    async getTransactionByReference(transactionReference: string) {
        const keyRef = transactionReference.trim();
        /*const cacheKey = `transactionByReference:${keyRef}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const transaction = await TransactionModel.findOne({
            where: { transactionReference: keyRef },
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone'],
                    include: [{
                        model: WalletModel,
                        as: 'wallet',
                        attributes: ['matricule', 'balance', 'userId', 'status']
                    }]
                },
                {
                    model: VirtualCardModel,
                    as: 'card'
                }
            ]
        });

        //await redisClient.set(cacheKey, JSON.stringify(transaction), { EX: REDIS_TTL });
        return transaction;
    }

    async getTransactionsUser(
        userId: number,
        limit: number,
        startIndex: number,
        type?: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER',
        status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'BLOCKED',
        method?: 'MOBILE_MONEY' | 'BANK_TRANSFER',
        startDate?: string,
        endDate?: string
    ) {
        /*const cacheKey = `transactionsUser:${userId}:${limit}:${startIndex}:${type ?? 'all'}:${status ?? 'all'}:${method ?? 'all'}:${startDate ?? 'none'}:${endDate ?? 'none'}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const where: Record<string, any> = {
            [Op.or]: [
                { userId },
                { receiverId: userId }
            ]
        };
        if (type) where.type = type;
        if (status) where.status = status;
        if (method) where.method = method;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = getUTCBoundaries(startDate).start;
            if (endDate) where.createdAt[Op.lte] = getUTCBoundaries(endDate).end;
            if (Object.keys(where.createdAt).length === 0) delete where.createdAt;
        }

        const result = await TransactionModel.findAndCountAll({
            where,
            limit,
            offset: startIndex,
            order: [['createdAt', 'DESC']],
            include: [
                { model: VirtualCardModel, as: 'card' }
            ]
        });

        const transactionsWithReceivers = await Promise.all(
            result.rows.map(async (transaction) => {
                const receiver = await transaction.getReceiver();
                const wallet = await WalletModel.findOne({
                where: { userId: transaction.userId },
                    attributes: ['id', 'balance', 'currency', 'matricule']
                });

                return {
                    ...transaction.toJSON(),
                    wallet,
                    receiver
                };
            })
        );

        const user = await UserModel.findByPk(userId, {
            attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
        });

        const cachedResult = {
            transactions: { count: result.count, rows: transactionsWithReceivers },
            user
        };

        //await redisClient.set(cacheKey, JSON.stringify(cachedResult), { EX: REDIS_TTL });
        return cachedResult;
    }

    async checkPendingTransactionsSmobilpay() {
        const pendingTransactions = await TransactionModel.findAll({
            where: {
                status: 'PENDING',
                retryCount: { [Op.lt]: 5 },
                type: { [Op.in]: ['TRANSFER'] }
            }
        });
        console.log('Transactions en attente récupérées : ', pendingTransactions.length);

        for (const transaction of pendingTransactions) {
            try {
                await this.processTransaction(transaction);
            } catch (error) {
                console.error(`Échec du traitement de la transaction ${transaction.id}:`, error);
                await transaction.update({
                    retryCount: transaction.retryCount + 1,
                    lastChecked: new Date()
                }, {
                    where: { id: transaction.id }
                });
            }
        }
    }

    async checkPendingTransactionsNeero() {
        const pendingTransactions = await TransactionModel.findAll({
            where: {
                status: 'PENDING',
                retryCount: { [Op.lt]: 5 },
                type: { [Op.in]: ['WITHDRAWAL', 'DEPOSIT', 'TRANSFER'] }
            },
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    include: [
                        {
                            model: WalletModel,
                            as: 'wallet'
                        }
                    ]
                }
            ]
        });

        for (const transaction of pendingTransactions) {
            try {
                const checkTransaction = await neeroService.getTransactionIntentById(transaction.transactionReference ?? '');
                if (
                    transaction.type === 'DEPOSIT' &&
                    checkTransaction.statusUpdates.some((s: any) => s.status == 'SUCCESSFUL') &&
                    transaction.status === 'PENDING' &&
                    transaction.method === 'MOBILE_MONEY'
                ) {
                    await walletService.creditWallet(
                        transaction.user?.wallet?.matricule ?? '',
                        transaction.amount
                    );
                    transaction.status = 'COMPLETED';
                    await transaction.save();

                    const tokenExpo = await notificationService.getTokenExpo(transaction.user?.id ?? 0);
                    await notificationService.save({
                        userId: transaction.user?.id ?? 0,
                        type: typesNotification['1'],
                        title: 'Sendo',
                        content: `Votre compte a été crédité suite à votre recharge de ${transaction.amount} XAF`,
                        status: 'SENDED',
                        token: tokenExpo?.token ?? ''
                    });
                } else if (
                    transaction.type === 'WITHDRAWAL' &&
                    checkTransaction.statusUpdates.some((s: any) => s.status == 'SUCCESSFUL') &&
                    transaction.status === 'PENDING' &&
                    transaction.method === 'MOBILE_MONEY'
                ) {
                    await walletService.debitWallet(
                        transaction.user?.wallet?.matricule ?? '',
                        transaction.amount
                    );
                    transaction.status = 'COMPLETED';
                    await transaction.save();

                    const tokenExpo = await notificationService.getTokenExpo(transaction.user?.id ?? 0);
                    await notificationService.save({
                        userId: transaction.user?.id ?? 0,
                        type: typesNotification['1'],
                        title: 'Sendo',
                        content: `Votre compte a été débité suite à votre retrait de ${transaction.amount} XAF`,
                        status: 'SENDED',
                        token: tokenExpo?.token ?? ''
                    });
                } else if (
                    transaction.type === 'TRANSFER' &&
                    checkTransaction.statusUpdates.some((s: any) => s.status == 'SUCCESSFUL') &&
                    transaction.status === 'PENDING' &&
                    transaction.method === 'MOBILE_MONEY'
                ) {
                    transaction.status = 'COMPLETED'
                    await transaction.save()
                } else if (
                    checkTransaction.statusUpdates.some((s: any) => s.status == 'FAILED') &&
                    transaction.status === 'PENDING'
                ) {
                    transaction.status = 'FAILED';
                    await transaction.save();

                    const tokenExpo = await notificationService.getTokenExpo(transaction.user?.id ?? 0);
                    await notificationService.save({
                        userId: transaction.user?.id ?? 0,
                        type: typesNotification['1'],
                        title: 'Sendo',
                        content: `Échec de la transaction de ${transaction.amount} XAF`,
                        status: 'SENDED',
                        token: tokenExpo?.token ?? ''
                    });
                }
            } catch (error) {
                console.error(`Échec du traitement de la transaction ${transaction.id}:`, error);
                await transaction.update({
                    retryCount: transaction.retryCount + 1,
                    lastChecked: new Date()
                }, {
                    where: { id: transaction.id }
                });
            }
        }
    }

    private async processTransaction(transaction: TransactionModel) {
        console.log('transaction en cours de check : ', transaction);
        console.log('transactionReference en cours de check : ', transaction.transactionReference);
        if (
            transaction.type === 'TRANSFER' && 
            transaction.method === 'MOBILE_MONEY' &&
            transaction.transactionReference
        ) {
            const verification = await mobileMoneyService.getVerifyTx(transaction.transactionReference);
            console.log('Vérification de la transaction smobilpay : ', verification);
            const newStatus = this.mapExternalStatus(verification[0].status);

            if (transaction.status === 'PENDING' && newStatus !== transaction.status) {
                await this.updateWalletBalance(transaction.transactionId);
            }
        }
    }

    private mapExternalStatus(externalStatus: string): 'PENDING' | 'COMPLETED' | 'FAILED' {
        const statusMap: Record<string, 'PENDING' | 'COMPLETED' | 'FAILED'> = {
            'SUCCESS': 'COMPLETED',
            'FAILED': 'FAILED',
            'PENDING': 'PENDING',
            'ERRORED': 'FAILED'
        };
        return statusMap[externalStatus] || 'FAILED';
    }

    private async updateWalletBalance(transactionId: string) {
        const newTransaction = await this.getTransaction(transactionId);

        if (!newTransaction) {
            throw new Error('Transaction introuvable');
        }
        
        console.log("Transaction trouvée : ", newTransaction);

        // Récupération manuelle du destinataire polymorphe
        const receiverInstance = await TransactionModel.findOne({ where: { transactionId } });
        const receiver = receiverInstance ? await receiverInstance.getReceiver() : null;

        if (
            newTransaction?.type === typesTransaction['2'] &&
            newTransaction.method === typesMethodTransaction['0']
        ) {
            console.log("on initie le transfert mobile money");

            /*if (
                newTransaction.user?.wallet?.balance && 
                (newTransaction.user?.wallet?.balance < newTransaction.amount)
            ) {
                throw new Error("Le solde de l'initiateur est insuffisant")
            }*/

            const result = await mobileMoneyController.initTransfert(
                receiver?.phone ?? '',
                `${receiver?.firstname ?? ''} ${receiver?.lastname ?? ''}`,
                receiver?.address ?? '', 
                newTransaction.amount,
                newTransaction.transactionReference ?? ''
            );

            console.log('Résultat de l\'initialisation du transfert mobile money : ', result);

            if (result && result.status === 'SUCCESS') {
                /*console.log("On débit le portefeuille de l'utilisateur");
                await walletService.debitWallet(
                    newTransaction.user?.wallet?.matricule ?? '',
                    newTransaction.amount
                );*/

                newTransaction.status = 'COMPLETED';
                await newTransaction.save();
            }

            const tokenExpo = await notificationService.getTokenExpo(newTransaction.user?.id ?? 0);
            if (result && result.status === 'SUCCESS' && receiver) {
                if (tokenExpo && newTransaction.user) {
                    await notificationService.save({
                        userId: newTransaction.user.id,
                        type: typesNotification['1'],
                        title: 'Sendo',
                        content: `Votre transfert de ${newTransaction.totalAmount} FCFA à ${receiver?.firstname} ${receiver?.lastname} a été envoyé avec succès.`,
                        status: 'SENDED',
                        token: tokenExpo.token
                    });
                }
            }
        }
    }

    async getLastUserTransactionByType(
        userId: number, 
        type: TypesTransaction,
        method: TypesMethodTransaction,
        amount: number
    ) {
        return await TransactionModel.findOne({
            where: {
                userId: userId,
                type: type,
                method: method,
                amount: amount
            },
            order: [['createdAt', 'DESC']],
            limit: 1
        });
    }

}

export default new TransactionService();
