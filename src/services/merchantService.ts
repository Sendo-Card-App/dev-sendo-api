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
        const commission = await CommissionModel.findByPk(commissionId)
        if (!commission) {
            throw new Error('Commission not found');
        }
        return commission
    }

    async getAllCommissions() {
        return CommissionModel.findAll();
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
        const palier = await PalierModel.findByPk(palierId, {
            include: [{
                model: CommissionModel,
                as: 'commission'
            }]
        });
        if (!palier) {
            throw new Error("Palier not found")
        }
        return palier
    }

    async getAllPaliers() {
        return PalierModel.findAll();
    }

    async findPalierByMontant(montant: number) {
        const palier = await PalierModel.findOne({
            where: {
                montantMin: { [Op.lte]: montant },
                montantMax: { [Op.gte]: montant },
            },
            include: [{
                model: CommissionModel,
                as: 'commission',
            }],
        });

        if (!palier) {
            throw new Error(`Aucun palier trouvé pour le montant ${montant}`);
        }

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
        const where: Record<string, any> = {};
        where.partnerId = idMerchant;

        const merchant = await MerchantModel.findByPk(idMerchant);
        if (!merchant) {
            throw new Error("Marchand introuvable");
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

        const includeOptions: any = {
            model: TransactionModel,
            as: 'transaction'
        };

        if (status) {
            includeOptions.where = { status };
            includeOptions.required = true; // INNER JOIN pour filtrage sur status
        }

        // Exécuter les requêtes dans une transaction pour cohérence
        const result = await sequelize.transaction(async (t) => {
            // 1. Récupération paginée des commissions avec transactions
            const transactionsPartenaires = await TransactionPartnerFeesModel.findAndCountAll({
                where,
                include: [includeOptions],
                limit,
                offset: startIndex,
                order: [['createdAt', 'DESC']],
                transaction: t
            });

            // 2. Calcul de la somme totale des commissions dans les mêmes conditions
            const totalCommissionResult = await TransactionPartnerFeesModel.sum('amount', {
                where: {
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
            include: [
                {
                    model: TransactionModel,
                    as: 'transaction'
                }
            ]
        })
        if (!transaction) {
            throw new Error("Transaction introuvable")
        }

        return transaction;
    }

    async saveRequestWithdraw(partnerId: number, amount: number, phone: string) {
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
        const where: Record<string, any> = {};
        if (status) {
            where.status = status;
        }

        return await PartnerWithdrawalsModel.findAndCountAll({
            where,
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
        })
    }
}

export default new MerchantService();