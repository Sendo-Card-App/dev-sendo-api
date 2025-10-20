import CardTransactionDebtsModel from "@models/card-transaction-debts.model";
import UserModel from "@models/user.model";
import VirtualCardModel from "@models/virtualCard.model";
import WalletModel from "@models/wallet.model";


class DebtService {
    async getAllDebts(
        limit: number,
        startIndex: number
    ) {
        return CardTransactionDebtsModel.findAndCountAll({
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
            ]
        })
    }

    async getAllDebtsUser(userId: number) {
        return CardTransactionDebtsModel.findAll({
            where: { userId },
            include: [
                {
                    model: UserModel,
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone'],
                    as: 'user',
                    include: [{
                        model: WalletModel,
                        as: 'wallet'
                    }]
                },
                {
                    model: VirtualCardModel,
                    as: 'card'
                }
            ]
        })
    }

    async getOneDebtUser(id: number, userId: number) {
        return CardTransactionDebtsModel.findOne({
            where: { 
                id,
                userId 
            },
            include: [
                {
                    model: UserModel,
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone'],
                    as: 'user',
                    include: [{
                        model: WalletModel,
                        as: 'wallet'
                    }]
                },
                {
                    model: VirtualCardModel,
                    as: 'card'
                }
            ]
        })
    }

    async getAllDebtsCard(idCard: number) {
        return CardTransactionDebtsModel.findAll({
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
        })
    }

    async getOneDebtCard(id: number, idCard: number) {
        return CardTransactionDebtsModel.findOne({
            where: { 
                id,
                cardId: idCard 
            },
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
        })
    }

    async getOneDebt(idCard: number) {
        return CardTransactionDebtsModel.findOne({
            where: { cardId: idCard }
        })
    }
}

export default new DebtService();