import { CommissionModel } from "@models/commission.model";
import { PalierModel } from "@models/palier.model";

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
}

export default new MerchantService();