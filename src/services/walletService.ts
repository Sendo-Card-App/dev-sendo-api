import WalletModel from "@models/wallet.model";
import { WalletCreate } from "../types/Wallet";
import UserModel from "@models/user.model";
import { TransactionCreate } from "../types/Transaction";
import transactionService from "./transactionService";
import { typesCurrency, typesMethodTransaction, typesStatusTransaction, typesTransaction } from "@utils/constants";
import sequelize from '@config/db';
import cardService from "./cardService";
import MerchantModel from "@models/merchant.model";
import merchantService from "./merchantService";
import configService from "./configService";

class WalletService {
    constructor() {
        this.createWallet = this.createWallet.bind(this);
        this.getWalletBalance = this.getWalletBalance.bind(this);
        this.transferFunds = this.transferFunds.bind(this);
        this.getBalanceWallet = this.getBalanceWallet.bind(this);
        this.getWalletByMatricule = this.getWalletByMatricule.bind(this);
    }
    
    async createWallet(wallet: WalletCreate) {
        return WalletModel.create(wallet);
    }

    async getWalletByMatricule(matricule: string) {
        const wallet = await WalletModel.findOne({
            where: { matricule },
            include: [{ 
                model: UserModel, 
                as: 'user', 
                attributes: ['id', 'firstname', 'lastname', 'email', 'phone', 'picture', 'country']
            }]
        });
        if (!wallet) {
            throw new Error('Portefeuille introuvable');
        }
       
        return wallet;
    }
    
    async getWalletBalance(walletId: string | number): Promise<number> {
        const wallet = await WalletModel.findOne({
            where: { id: walletId }
        });

        if (!wallet) throw new Error('Portefeuille introuvable');

        return wallet.balance;
    }

    async transferFunds(
        fromWalletId: string, 
        toWalletId: string, 
        amount: number, 
        description: string,
        userId: number
    ) {
        const transaction = await sequelize.transaction();
        
        try {
            // 1. Récupération avec verrouillage
            const fromWallet = await WalletModel.findOne({
                where: { matricule: fromWalletId },
                transaction,
                include: [{ model: UserModel, as: 'user' }],
                //lock: transaction.LOCK.UPDATE
            });
    
            const toWallet = await WalletModel.findOne({
                where: { matricule: toWalletId },
                transaction,
                include: [{ model: UserModel, as: 'user' }],
                //lock: transaction.LOCK.UPDATE
            });
            
            // 2. Validations initiales
            if (!fromWallet || !toWallet) throw new Error('Portefeuille introuvable');
            if (fromWallet?.user?.id !== userId) throw new Error('Ce wallet ne vous appartient pas')
            if (fromWallet.balance < amount) throw new Error('Solde insuffisant');
            if (fromWallet.currency === 'CAD' && toWallet.currency === 'CAD') throw new Error('Impossible de faire un transfert CAD vers CAD');

            // 3. On calcule les frais de transfert
            let total: number = 0;
            let configFeesValue: number | null = null;
            let amountToIncrement: number = 0;
            if (fromWallet.currency === 'CAD' && toWallet.currency === 'XAF') {
                const feesConfig = await configService.getConfigByName('SENDO_TO_SENDO_TRANSFER_FEES')
                if (!feesConfig) throw new Error('Configuration des frais introuvable');
                const cadSendoValue = await configService.getConfigByName('CAD_SENDO_VALUE')
                if (!cadSendoValue) throw new Error('Configuration CAD value introuvable');

                configFeesValue = amount * (Number(feesConfig.value) / 100)
                total = amount + configFeesValue
                amountToIncrement = amount * Number(cadSendoValue.value)
            } else if (fromWallet.currency === 'XAF' && toWallet.currency === 'CAD') {
                throw new Error('Transfert de XAF vers CAD non autorisé');
            } else {
                configFeesValue = 0
                total = amount
                amountToIncrement = amount
            }  

            // 4. Mise à jour atomique
            await fromWallet.decrement('balance', { by: total, transaction });
            await toWallet.increment('balance', { by: amountToIncrement, transaction });

            // 5. Enregistrement de la transaction côté initiateur et receveur
            const transactionCreate: TransactionCreate = {
                userId: fromWallet?.user?.id || 0,
                type: typesTransaction['4'],
                amount: Number(amount),
                receiverId: toWallet?.user?.id || 0,
                receiverType: 'User',
                status: typesStatusTransaction['1'],
                currency: fromWallet.currency,
                totalAmount: total,
                sendoFees: configFeesValue!,
                description: "Transfert Sendo-Sendo",
                provider: typesMethodTransaction['3'],
                method: typesMethodTransaction['3']
            }
            const transac = await transactionService.createTransaction(transactionCreate, { transaction });

            // 4. On check si la carte possede des dettes
            await settleCardDebtsIfAny(toWallet!.matricule, toWallet!.userId)
            const newToWallet = await toWallet.reload({ transaction })
            
            await transaction.commit();
            
            return {
                sender: fromWallet,
                receiver: newToWallet,
                transaction: transac,
                amountToIncrement
            };
    
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }  
    
    async transferFromAgentToCustomer(idMerchant: number, toWalletId: string, amount: number) {
        const transaction = await sequelize.transaction();
        try {
            const merchant = await MerchantModel.findByPk(idMerchant, {
                include: [{ model: UserModel, as: 'user' }]
            });

            const toWallet = await WalletModel.findOne({
                where: { matricule: toWalletId },
                transaction,
                include: [{ model: UserModel, as: 'user' }],
                //lock: true
            });

            // 2. Validations initiales
            if (!merchant) throw new Error('Agent introuvable');
            if (!toWallet) throw new Error('Portefeuille du client introuvable');
            if (merchant.balance < amount) throw new Error('Solde insuffisant');

            const palier = await merchantService.findPalierByMontant(amount)
            let commission: number | null = null;
            if (palier.commission && palier.commission.typeCommission === 'POURCENTAGE') {
                commission = (palier.commission.montantCommission * amount) / 100
            } else if (palier.commission && palier.commission.typeCommission === 'FIXE') {
                commission = palier.commission.montantCommission
            }
    
            // 3. Mise à jour atomique
            await merchant.decrement('balance', { by: amount, transaction });
            await toWallet.increment('balance', { by: amount, transaction });

            // 4. Enregistrement de la transaction côté initiateur
            const transactionCreate: TransactionCreate = {
                userId: merchant.userId,
                type: typesTransaction['4'],
                amount: Number(amount),
                receiverId: toWallet?.user?.id || 0,
                receiverType: 'User',
                status: typesStatusTransaction['1'],
                currency: typesCurrency['0'],
                totalAmount: Number(amount),
                description: "Recharge Agent-Sendo",
                provider: typesMethodTransaction['3'],
                method: typesMethodTransaction['4'],
                partnerFees: commission!
            }
            const transactionCreated = await transactionService.createTransaction(transactionCreate)
            
            await transaction.commit();

            // On enregistrer la transaction du partenaire
            await merchantService.createTransactionPartnerFees({
                transactionId: transactionCreated.id,
                partnerId: merchant.id,
                amount: commission!,
                isWithdrawn: false
            })

            return {
                transaction: transactionCreated,
                receiver: toWallet.user
            };

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async getBalanceWallet(userId: number) {
        return await WalletModel.findOne({
            where: {
                userId: userId
            },
            attributes: ['balance', 'userId', 'currency']
        })
    }

    async creditWallet(matricule: string, amount: number, reason?: string) {
        const transaction = await sequelize.transaction();

        try {
            const wallet = await this.getWalletByMatricule(matricule)
            let newWallet: WalletModel | null = null;

            if (wallet) {
                /*if (
                    reason === "SPONSORSHIP_FEES" || 
                    reason === "BANK_TRANSFER" ||
                    reason === "MOBILE_MONEY"
                ) {
                    newWallet = await wallet.increment('balance', { by: amount, transaction });
                }*/
               newWallet = await wallet.increment('balance', { by: amount, transaction });
            } else {
                throw new Error("Portefeuille ou configuration introuvable")
            }

            await transaction.commit();
            return newWallet;

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async debitWallet(matricule: string, amount: number, reason?: string) {
        const transaction = await sequelize.transaction();

        try {
            const wallet = await this.getWalletByMatricule(matricule)
            if (!wallet) {
                throw new Error("Portefeuille introuvable")
            }
            
            if (wallet.balance < amount) {
                throw new Error("Solde insuffisant pour cette opération");
            }
            
            let newWallet: WalletModel | null = null;
            newWallet = await wallet.decrement('balance', { by: amount, transaction });

            await transaction.commit();
            return newWallet;

        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}

export default new WalletService();

// Exemple de WalletService.ts (ajoute ceci dans ta classe WalletService)
export async function settleCardDebtsIfAny(matriculeWallet: string, userId: number) {
    // Récupérer la carte virtuelle et ses dettes
    const card = await cardService.getVirtualCard(undefined, undefined, userId);
    if (!card || !card.debts || card.debts.length === 0) return;
    const walletClass = new WalletService()

    // Traiter chaque dette une par une (séquentiel par précaution sur les montants)
    for (const debt of card.debts) {
        const wallet = await walletClass.getBalanceWallet(userId)
        if (wallet!.balance <= 0) break;
        console.log('on paie les dettes : ', card.debts.length)
        const debitAmount = Math.min(wallet!.balance, debt.amount);

        await walletClass.debitWallet(matriculeWallet, debitAmount);

        if (debitAmount >= debt.amount) {
            await cardService.deleteDebt(debt.id);
        } else {
            await cardService.updateDebt(debt.id, debt.amount - debitAmount);
        }

        // Journaliser la transaction de règlement de dette
        const transaction: TransactionCreate = {
            amount: 0,
            type: typesTransaction['3'], // Paiement dette
            status: 'COMPLETED',
            userId,
            currency: typesCurrency['0'],
            totalAmount: debitAmount,
            method: typesMethodTransaction['0'],
            description: `Paiement de la dette : #${debt.intitule}`,
            provider: 'WALLET',
            receiverId: userId,
            receiverType: 'User',
            sendoFees: debitAmount
        };
        await transactionService.createTransaction(transaction);
    }

    // Si toutes les dettes sont soldées, remettre à zéro le compteur de paiements rejetés
    const newCard = await cardService.getVirtualCard(card.cardId, card.id, card.userId);
    if (newCard && newCard.debts && newCard.debts.length === 0) {
        newCard.paymentRejectNumber = 0;
        await newCard.save();
    }
}