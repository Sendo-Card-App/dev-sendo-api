import CardTransactionDebtsModel from "@models/card-transaction-debts.model";
import UserModel from "@models/user.model";
import VirtualCardModel from "@models/virtualCard.model";
import WalletModel from "@models/wallet.model";
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

class DebtService {
    async getAllDebts(limit: number, startIndex: number) {
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

        return result;
    }

    async getAllDebtsUser(userId: number) {
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

        return result;
    }

    async getOneDebtUser(id: number, userId: number) {
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

        return result;
    }

    async getAllDebtsCard(idCard: number) {
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

        return result;
    }

    async getOneDebtCard(id: number, idCard: number) {
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

        return result;
    }

    async getOneDebt(idCard: number) {
        const result = await CardTransactionDebtsModel.findOne({ where: { cardId: idCard } });

        return result;
    }

    async getDebtById(id: number) {
        const result = await CardTransactionDebtsModel.findByPk(id);
        return result;
    }
}

export default new DebtService();