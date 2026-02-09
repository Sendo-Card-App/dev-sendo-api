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
import { ajouterPrefixe237, generateAlphaNumeriqueString, getUTCBoundaries } from "@utils/functions";
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

    async findPalierByMontant(montant: number, description?: string) {
        /*const cacheKey = `palierByMontant:${montant}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/
        const whereClause: Record<string, any> = {};
        whereClause.montantMin = { [Op.lte]: montant }
        whereClause.montantMax = { [Op.gte]: montant }
        if (description) whereClause.description = description

        const palier = await PalierModel.findOne({
            where: whereClause,
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
        const where: Record<string, any> = { };

        const includeOptions: any = {
            model: TransactionModel,
            as: 'transaction',
            include: [{
                model: UserModel,
                as: 'user',
                attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
            }]
        };

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                const { start } = getUTCBoundaries(startDate);
                where.createdAt[Op.gte] = start;
                includeOptions.where = where;
                includeOptions.required = true;
            }
            if (endDate) {
                const { end } = getUTCBoundaries(endDate);
                where.updatedAt[Op.lte] = end;
                includeOptions.where = where;
                includeOptions.required = true;
            }
            if (Object.keys(where.createdAt).length === 0) {
                delete where.createdAt;
            }
        }

        if (status) {
            includeOptions.where = { status };
            includeOptions.required = true;
        }

        const result = await sequelize.transaction(async (t) => {
            const transactionsPartenaires = await TransactionPartnerFeesModel.findAndCountAll({
                where: { partnerId: idMerchant },
                include: [includeOptions],
                limit,
                offset: startIndex,
                order: [['createdAt', 'DESC']],
                transaction: t
            });

            const totalCommissionResult = await TransactionPartnerFeesModel.sum('amount', {
                where: { 
                    partnerId: idMerchant,
                    ...where, 
                    isWithdrawn: false 
                },
                transaction: t
            });

            return {
                total: transactionsPartenaires.count,
                rows: transactionsPartenaires.rows,
                totalCommission: totalCommissionResult || 0
            };
        });

        return result;
    }

    async getMerchantTransactionById(transactionId: number) {
        const transaction = await TransactionPartnerFeesModel.findByPk(transactionId, {
            include: [{ 
                model: TransactionModel, 
                as: 'transaction',
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
                }]
            }]
        });
        if (!transaction) throw new Error("Transaction introuvable");

        return transaction;
    }

    async saveRequestWithdraw(
        partnerId: number, 
        amount: number, 
        phone: string,
        isFromBalance: boolean = false
    ) {
        if (!isFromBalance) {
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
        } else {
            const merchant = await MerchantModel.findByPk(partnerId);
            if (!merchant) throw new Error("Merchant introuvable");
            if (merchant.balance < amount) throw new Error("Solde insuffisant pour ce retrait");
            await merchant.decrement('balance', { by: amount });
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

    async getRequestWithdrawByParams(phone: string, amount?: number) {
        const where: Record<string, any> = {
            status: 'PENDING',
        };
        if (phone) where.phone = ajouterPrefixe237(phone);
        if (amount) where.amount = amount;

        return await PartnerWithdrawalsModel.findOne({
            where,
            include: [{
                model: MerchantModel,
                as: 'partner'
            }]
        });
    }

    async retirerCommissionProche(
        idWithdraw: number,
        partnerId: number,
        montantVoulu: number
    ) {
        const requestWithdraw = await PartnerWithdrawalsModel.findByPk(idWithdraw)

        if (requestWithdraw && !requestWithdraw.isFromBalance) {
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
        } else {
            return requestWithdraw!;
        }
    }

    async getAllRequestWithdraw(
        status: 'VALIDATED' | 'REJECTED' | 'PENDING',
        limit: number, 
        startIndex: number,
        idMerchant?: number
    ) {
        const whereClause: Record<string, any> = {};
        if (idMerchant) whereClause.partnerId = idMerchant;
        if (status) whereClause.status = status;

        const result = await PartnerWithdrawalsModel.findAndCountAll({
            where: whereClause,
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

        return result;
    }

    async getMerchantById(merchantId: number) {
        const merchant = await MerchantModel.findByPk(merchantId);
        if (!merchant) throw new Error('Merchant not found');
        return merchant;
    }

    async updateStatusRequestWithdraw(requestWithdrawId: number) {
        const requestWithdraw = await PartnerWithdrawalsModel.findByPk(requestWithdrawId, {
            include: [{
                model: MerchantModel,
                as: 'partner',
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'phone', 'email', 'firstname', 'lastname']
                }]
            }]
        })
        if (!requestWithdraw) throw new Error("Requête de retrait introuvable")

        requestWithdraw.status = "REJECTED";
        const newRequest = await requestWithdraw.save()
        return newRequest;
    }
}

export default new MerchantService();