import CardTransactionDebtsModel from "@models/card-transaction-debts.model";
import UserModel from "@models/user.model";
import VirtualCardModel from "@models/virtualCard.model";
import WalletModel from "@models/wallet.model";
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

class DebtService {
    async getAllDebts(limit: number, startIndex: number) {
        const cacheKey = `allDebts:${limit}:${startIndex}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const result = await CardTransactionDebtsModel.findAndCountAll({
            offset: startIndex,
            limit,
            include: [
                {
                    model: UserModel,
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone'],
                    as: 'user'
                },
                {
                    model: VirtualCardModel,
                    as: 'card'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }

    async getAllDebtsUser(userId: number) {
        const cacheKey = `allDebtsUser:${userId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const result = await CardTransactionDebtsModel.findAll({
            where: { userId },
            include: [
                {
                    model: UserModel,
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone'],
                    as: 'user',
                    include: [{ model: WalletModel, as: 'wallet' }]
                },
                {
                    model: VirtualCardModel,
                    as: 'card'
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }

    async getOneDebtUser(id: number, userId: number) {
        const cacheKey = `oneDebtUser:${id}:${userId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const result = await CardTransactionDebtsModel.findOne({
            where: { id, userId },
            include: [
                {
                    model: UserModel,
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone'],
                    as: 'user',
                    include: [{ model: WalletModel, as: 'wallet' }]
                },
                { 
                    model: VirtualCardModel, 
                    as: 'card' 
                }
            ]
        });

        if (result) {
            await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        }
        return result;
    }

    async getAllDebtsCard(idCard: number) {
        const cacheKey = `allDebtsCard:${idCard}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const result = await CardTransactionDebtsModel.findAll({
            where: { cardId: idCard },
            include: [
                {
                    model: UserModel,
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone'],
                    as: 'user'
                },
                {
                    model: VirtualCardModel,
                    as: 'card'
                }
            ]
        });

        await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }

    async getOneDebtCard(id: number, idCard: number) {
        const cacheKey = `oneDebtCard:${id}:${idCard}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const result = await CardTransactionDebtsModel.findOne({
            where: { id, cardId: idCard },
            include: [
                {
                    model: UserModel,
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone'],
                    as: 'user'
                },
                {
                    model: VirtualCardModel,
                    as: 'card'
                }
            ]
        });

        if (result) {
            await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        }
        return result;
    }

    async getOneDebt(idCard: number) {
        const cacheKey = `oneDebt:${idCard}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const result = await CardTransactionDebtsModel.findOne({ where: { cardId: idCard } });

        if (result) {
            await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        }
        return result;
    }

    async getDebtById(id: number) {
        const cacheKey = `debtById:${id}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const result = await CardTransactionDebtsModel.findByPk(id);

        if (result) {
            await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        }
        return result;
    }
}

export default new DebtService();