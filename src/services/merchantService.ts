import sequelize from "@config/db";
import { CommissionModel } from "@models/commission.model";
import MerchantModel from "@models/merchant.model";
import { PalierModel } from "@models/palier.model";
import TransactionPartnerFeesModel from "@models/transaction-partner-fees.model";
import UserModel from "@models/user.model";
import { TransactionCreate } from "../types/Transaction";
import { typesCurrency, typesMethodTransaction, typesStatusTransaction, typesTransaction } from "@utils/constants";
import { Op } from "sequelize";
import transactionService from "./transactionService";
import { generateAlphaNumeriqueString, getUTCBoundaries } from "@utils/functions";
import TransactionModel from "@models/transaction.model";
import PartnerWithdrawalsModel from "@models/partner-withdrawals.model";
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

export interface ICommission {
    typeCommission: 'POURCENTAGE' | 'FIXE';
    montantCommission: number;
    description?: string | null;
}

export interface IPalier {
    montantMin: string;
    montantMax: string;
    commissionId: number;
    description?: string | null;
}

export interface TransactionPartnerFees {
    transactionId: number;
    partnerId: number;
    amount: number;
    isWithdrawn?: boolean
}

class MerchantService {
    async createCommission(commissionDate: ICommission) {
        return CommissionModel.create(commissionDate);
    }

    async updateCommission(commissionId: number, commissionData: Partial<ICommission>) {
        const commission = await CommissionModel.findByPk(commissionId);
        if (!commission) {
            throw new Error('Commission not found');
        }
        return commission.update(commissionData);
    }

    async findCommissionById(commissionId: number) {
        /*const cacheKey = `commission:${commissionId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const commission = await CommissionModel.findByPk(commissionId);
        if (!commission) throw new Error('Commission not found');

        //await redisClient.set(cacheKey, JSON.stringify(commission), { EX: REDIS_TTL });
        return commission;
    }

    async getAllCommissions() {
        /*const cacheKey = 'allCommissions';
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const commissions = await CommissionModel.findAll();
        //await redisClient.set(cacheKey, JSON.stringify(commissions), { EX: REDIS_TTL });
        return commissions;
    }

    async createPalier(palierData: IPalier) {
        const palier = await CommissionModel.findByPk(palierData.commissionId);
        if (!palier) {
            throw new Error('Commission not found');
        }
        return PalierModel.create(palierData);
    }

    async updatePalier(palierId: number, palierData: Partial<IPalier>) {
        const palier = await PalierModel.findByPk(palierId);
        if (!palier) {
            throw new Error("Palier not found")
        }
        return palier.update(palierData)
    }

    async findPalierById(palierId: number) {
        /*const cacheKey = `palier:${palierId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const palier = await PalierModel.findByPk(palierId, {
            include: [{ model: CommissionModel, as: 'commission' }]
        });
        if (!palier) throw new Error("Palier not found");

        //await redisClient.set(cacheKey, JSON.stringify(palier), { EX: REDIS_TTL });
        return palier;
    }

    async getAllPaliers() {
        /*const cacheKey = 'allPaliers';
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const paliers = await PalierModel.findAll();
        //await redisClient.set(cacheKey, JSON.stringify(paliers), { EX: REDIS_TTL });
        return paliers;
    }

    async findPalierByMontant(montant: number) {
        /*const cacheKey = `palierByMontant:${montant}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const palier = await PalierModel.findOne({
            where: {
                montantMin: { [Op.lte]: montant },
                montantMax: { [Op.gte]: montant }
            },
            include: [{ model: CommissionModel, as: 'commission' }]
        });
        if (!palier) throw new Error(`Aucun palier trouvé pour le montant ${montant}`);

        //await redisClient.set(cacheKey, JSON.stringify(palier), { EX: REDIS_TTL });
        return palier;
    }

    async createTransactionPartnerFees(transaction: TransactionPartnerFees) {
        return await TransactionPartnerFeesModel.create(transaction)
    }

    async depositWalletMerchant(merchantCode: string, amount: number) {
        const transaction = await sequelize.transaction();
        try {
            const merchant = await MerchantModel.findOne({
                where: { code: merchantCode },
                include: [{ model: UserModel, as: 'user' }]
            });
            if (!merchant) throw new Error('Agent introuvable');
    
            // 3. Mise à jour atomique
            await merchant.increment('balance', { by: amount, transaction });

            // 4. Enregistrement de la transaction côté initiateur
            const transactionCreate: TransactionCreate = {
                userId: merchant.userId,
                type: typesTransaction['0'],
                amount: Number(amount),
                receiverId: merchant.user!.id,
                receiverType: 'User',
                status: typesStatusTransaction['1'],
                currency: typesCurrency['0'],
                totalAmount: Number(amount),
                description: "Recharge Sendo",
                provider: typesMethodTransaction['3'],
                method: typesMethodTransaction['4'],
                transactionReference: generateAlphaNumeriqueString(12)
            }
            const transactionCreated = await transactionService.createTransaction(transactionCreate)
            
            await transaction.commit();

            return {
                transaction: transactionCreated,
                merchant
            };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async getAllMerchantTransactions(
        idMerchant: number,
        limit: number,
        startIndex: number,
        status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'BLOCKED',
        startDate?: string,
        endDate?: string
    ) {
        /*const cacheKey = `merchantTransactions:${idMerchant}:${limit}:${startIndex}:${status ?? 'all'}:${startDate ?? 'none'}:${endDate ?? 'none'}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const where: Record<string, any> = { partnerId: idMerchant };

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

        const includeOptions: any = {
            model: TransactionModel,
            as: 'transaction'
        };

        if (status) {
            includeOptions.where = { status };
            includeOptions.required = true;
        }

        const result = await sequelize.transaction(async (t) => {
            const transactionsPartenaires = await TransactionPartnerFeesModel.findAndCountAll({
                where,
                include: [includeOptions],
                limit,
                offset: startIndex,
                order: [['createdAt', 'DESC']],
                transaction: t
            });

            const totalCommissionResult = await TransactionPartnerFeesModel.sum('amount', {
                where: { ...where, isWithdrawn: false },
                transaction: t
            });

            return {
                total: transactionsPartenaires.count,
                rows: transactionsPartenaires.rows,
                totalCommission: totalCommissionResult || 0
            };
        });

        //await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }

    async getMerchantTransactionById(transactionId: number) {
        /*const cacheKey = `merchantTransaction:${transactionId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const transaction = await TransactionPartnerFeesModel.findByPk(transactionId, {
            include: [{ model: TransactionModel, as: 'transaction' }]
        });
        if (!transaction) throw new Error("Transaction introuvable");

        //await redisClient.set(cacheKey, JSON.stringify(transaction), { EX: REDIS_TTL });
        return transaction;
    }

    async saveRequestWithdraw(partnerId: number, amount: number, phone: string) {
        const commissions = await TransactionPartnerFeesModel.findAll({
            where: { partnerId, isWithdrawn: false },
            order: [['createdAt', 'ASC']],
        });

        let sommeCumulee: number = 0;

        for (const commission of commissions) {
            sommeCumulee += commission.amount;
        }

        if (sommeCumulee < amount) {
            throw new Error("Vous ne possédez pas cette somme en commissions générées")
        }

        return await PartnerWithdrawalsModel.create({
            partnerId,
            amount,
            phone
        }); 
    }

    async getRequestWithdraw(idWithdraw: number) {
        return await PartnerWithdrawalsModel.findByPk(idWithdraw, {
            include: [{
                model: MerchantModel,
                as: 'partner',
                include: [{ model: UserModel, as: 'user' }]
            }]
        });
    }

    async retirerCommissionProche(
        idWithdraw: number,
        partnerId: number,
        montantVoulu: number
    ) {
        const requestWithdraw = await PartnerWithdrawalsModel.findByPk(idWithdraw)
        const commissions = await TransactionPartnerFeesModel.findAll({
            where: { partnerId, isWithdrawn: false },
            order: [['createdAt', 'ASC']],
        });

        let sommeCumulee: number = 0;
        let commissionsSelectionnees = [];

        for (const commission of commissions) {
            commissionsSelectionnees.push(commission);
            sommeCumulee += commission.amount;

            if (sommeCumulee >= montantVoulu) {
                break;
            }
        }

        if (commissionsSelectionnees.length === 0) {
            throw new Error('Aucune commission disponible pour ce retrait');
        }

        // Mise à jour de isWithdrawn en transaction
        await sequelize.transaction(async (t) => {
            for (const c of commissionsSelectionnees) {
                await c.update({ isWithdrawn: true }, { transaction: t });
            }

            if (requestWithdraw && sommeCumulee != montantVoulu) {
                requestWithdraw.amount = sommeCumulee
                await requestWithdraw.save()
            }
        });

        return requestWithdraw!.reload();
    }

    async getAllRequestWithdraw(
        status: 'VALIDATED' | 'REJECTED' | 'PENDING',
        limit: number, 
        startIndex: number
    ) {
        /*const cacheKey = `allRequestWithdraw:${status}:${limit}:${startIndex}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const result = await PartnerWithdrawalsModel.findAndCountAll({
            where: status ? { status } : undefined,
            limit,
            offset: startIndex,
            include: [{
                model: MerchantModel,
                as: 'partner',
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'email', 'phone']
                }]
            }]
        });

        //await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }
}

export default new MerchantService();