import DestinataireModel from "@models/destinataire.model";
import TransactionModel from "@models/transaction.model";
import { ajouterPrefixe237 } from "@utils/functions";

export interface DestinataireCreate {
    country: string;
    firstname: string;
    lastname: string;
    provider: string;
    phone: string;
    address: string;
}

class DestinataireService {
    async createDestinataire(destinataire: DestinataireCreate) {
        const destinataireExistant = await DestinataireModel.findOne({
            where: {
                phone: ajouterPrefixe237(destinataire.phone)
            }
        })
        if (destinataireExistant) return destinataireExistant
        else return await DestinataireModel.create(destinataire)
    }

    async getAllDestinataires(limit: number, startIndex: number) {
        return DestinataireModel.findAll({
            limit,
            offset: startIndex,
            order: [['firstname', 'ASC']]
        })
    }

    async getDestinataire(id: number) {
        return DestinataireModel.findByPk(id)
    }

    async getTransactionsUser(userId: number) {
        const transactions = await TransactionModel.findAll({
            where: {
            userId,
            type: 'TRANSFER',
            method: 'MOBILE_MONEY'
            },
            order: [['createdAt', 'DESC']]
        });

        // Parcours les transactions pour ajouter la cible dynamique (User ou Destinataire)
        const transactionsWithReceivers = await Promise.all(
            transactions.map(async (transaction) => {
                const receiver = await transaction.getReceiver();
                return {
                    ...transaction.toJSON(),
                    destinataire: receiver
                };
            })
        );

        return transactionsWithReceivers;
    }
}

export default new DestinataireService()