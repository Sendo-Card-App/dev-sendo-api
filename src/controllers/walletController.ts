import transactionService from "@services/transactionService";
import walletService from "@services/walletService";
import { TransactionCreate } from "../types/Transaction";
import { sendError, sendResponse } from "@utils/apiResponse";
import { generateAlphaNumeriqueString, generateMatriculeWallet } from "@utils/functions";
import { Request, Response } from "express";
import logger from "@config/logger";
import { successTransferFunds } from "@services/emailService";
import { typesCurrency } from "@utils/constants";
import notificationService from "@services/notificationService";


class WalletController {
    constructor() {
        this.createWallet = this.createWallet.bind(this);
        this.getWalletBalance = this.getWalletBalance.bind(this);
        this.transferFunds = this.transferFunds.bind(this);
    }
    
    async createWallet(req: Request, res: Response) {
        const { userId } = req.body;
        if (!userId) {
            sendError(res, 400, "User ID is required");
        }
        const wallet = {
            userId,
            balance: 0,
            currency: typesCurrency['0'],
            matricule: generateMatriculeWallet()
        }
        try {
            const response = await walletService.createWallet(wallet)

            logger.info("Wallet created", {
                userId: response.userId,
                matricule: response.matricule,
                admin: `Admin ID : ${req.user?.id} - ${req.user?.firstname} ${req.user?.lastname}`
            });

            sendResponse(res, 201, "Wallet created successfully", response);
        } catch (error: any) {
            sendError(res, 500, "Error creating wallet", [error.message]);
        }
    }
    
    async getWalletBalance(req: Request, res: Response) {
        const { userId } = req.params
        if (!userId) {
            sendError(res, 400, "User ID is required");
        }
        try {
            const data = await walletService.getBalanceWallet(parseInt(userId))
            sendResponse(res, 200, "Balance user", data);
        } catch (error: any) {
            sendError(res, 500, "Erreur de récupération", [error.message]);
        }
    }
    
    async transferFunds(req: Request, res: Response) {
        const { fromWallet, toWallet, amount, description } = req.body
        if (!fromWallet || !toWallet || !amount) {
            sendError(res, 400, "Veuillez remplir tous les champs");
        }
        try {
            const walletSender = await walletService.getWalletByMatricule(fromWallet)
            if (walletSender?.user?.id !== req.user?.id) {
                throw new Error('Ce wallet ne vous appartient pas')
            }

            const wallet = await walletService.transferFunds(fromWallet, toWallet, amount, description)

            // On notifie tout le monde
            const tokenSender = await notificationService.getTokenExpo(wallet.sender.user?.id ?? 0)
            await notificationService.save({
                type: 'SUCCESS_TRANSFER_FUNDS',
                userId: wallet.sender.user?.id ?? 0,
                content: `Votre transfert de ${amount} XAF à ${wallet.receiver.user?.firstname} a été effectué avec succès`,
                title: 'Sendo',
                status: 'SENDED',
                token: tokenSender?.token ?? ''
            })
            const tokenReceiver = await notificationService.getTokenExpo(wallet.receiver.user?.id ?? 0)
            await notificationService.save({
                type: 'SUCCESS_TRANSFER_FUNDS',
                userId: wallet.receiver.user?.id ?? 0,
                content: `Vous avez reçu de ${wallet.sender.user?.firstname} une somme de ${amount} XAF sur votre portefeuille SENDO`,
                title: 'Sendo',
                status: 'SENDED',
                token: tokenReceiver?.token ?? ''
            })

            await successTransferFunds(
                wallet.sender.user!, 
                wallet.receiver.user?.email ?? "", 
                parseFloat(amount)
            )

            logger.info("Transfert d'argent SENDO-SENDO", {
                sender: `${wallet.sender.user?.firstname} ${wallet.sender.user?.lastname}`,
                receiver: `${wallet.receiver.user?.firstname} ${wallet.receiver.user?.lastname}`,
                amount: parseFloat(amount)
            });

            sendResponse(res, 200, 'Transfert réussi !', {
                sender: wallet.sender,
                receiver: wallet.receiver,
                transaction: wallet.transaction
            })
        } catch (error: any) {
            sendError(res, 500, "Erreur lors du transfert", [error.message]);
        }
    }

    async creditWalletRequest(req: Request, res: Response) {
        const { method, amount } = req.body
        const file = req.file as Express.Multer.File;
           
        try {
            if (!req.user) throw new Error('Utilisateur non authentifié');
        
            if (!file) {
                throw new Error('Aucun document fourni');
            }

            if (method === 'BANK_TRANSFER') {
                const transaction: TransactionCreate = {
                    userId: req.user?.id || 0,
                    type: 'DEPOSIT',
                    amount: parseFloat(amount),
                    status: 'PENDING',
                    currency: 'XAF',
                    totalAmount: parseFloat(amount),
                    method: 'BANK_TRANSFER',
                    description: file.path,
                    receiverId: req.user?.id || 0,
                    receiverType: 'User'
                }
                const transac = await transactionService.createTransaction(transaction)
                

                logger.info("Recharge du wallet", {
                    userId: req.user?.id,
                    amount: parseFloat(amount)
                });

                sendResponse(res, 201, 'Transaction enregistrée !', transac)
            }
        } catch (error: any) {
            sendError(res, 500, "Erreur lors de la recharge du portefeuille", [error.message]);
        }
    }

    async depositWalletAdmin(req: Request, res: Response) {
        const { matriculeWallet, amount } = req.body
           
        try {
            if (!req.user) throw new Error('Utilisateur non authentifié');
        
            if (!matriculeWallet || !amount) {
                sendError(res, 400, "Veuillez fournir un matriculeWallet et un amount")
                return;
            }
            
            const wallet = await walletService.getWalletByMatricule(matriculeWallet)
            await walletService.creditWallet(wallet.matricule, Number(amount));

            const transaction: TransactionCreate = {
                userId: wallet!.user!.id,
                type: 'DEPOSIT',
                amount: Number(amount),
                status: 'COMPLETED',
                currency: 'XAF',
                totalAmount: Number(amount),
                method: 'WALLET',
                description: "Dépôt par SENDO",
                receiverId: wallet!.user!.id,
                transactionReference: generateAlphaNumeriqueString(12),
                receiverType: 'User'
            }
            const transac = await transactionService.createTransaction(transaction)
            

            logger.info("Recharge du wallet", {
                userId: wallet!.user!.id,
                adminId: req.user?.id,
                amount: Number(amount)
            });

            sendResponse(res, 200, 'Transaction enregistrée !', transac)
        } catch (error: any) {
            sendError(res, 500, "Erreur lors de la recharge du portefeuille", [error.message]);
        }
    }

    async withdrawalWalletAdmin(req: Request, res: Response) {
        const { matriculeWallet, amount } = req.body
           
        try {
            if (!req.user) throw new Error('Utilisateur non authentifié');
        
            if (!matriculeWallet || !amount) {
                sendError(res, 400, "Veuillez fournir un matriculeWallet et un amount")
                return;
            }
            
            const wallet = await walletService.getWalletByMatricule(matriculeWallet)
            await walletService.debitWallet(wallet.matricule, Number(amount));

            const transaction: TransactionCreate = {
                userId: wallet!.user!.id,
                type: 'WITHDRAWAL',
                amount: Number(amount),
                status: 'COMPLETED',
                currency: 'XAF',
                totalAmount: Number(amount),
                method: 'WALLET',
                description: "Retrait par SENDO",
                receiverId: wallet!.user!.id,
                receiverType: 'User'
            }
            const transac = await transactionService.createTransaction(transaction)
            

            logger.info("Retrait du wallet", {
                userId: wallet!.user!.id,
                adminId: req.user?.id,
                amount: Number(amount)
            });

            sendResponse(res, 200, 'Transaction enregistrée !', transac)
        } catch (error: any) {
            sendError(res, 500, "Erreur lors du retrait du portefeuille", [error.message]);
        }
    }

    async getUserByWallet(req: Request, res: Response) {
        const { walletId } = req.params
        try {
            if (!walletId) {
                throw new Error('Veuillez fournir le numéro du compte du portefeuille')
            }
            const wallet = await walletService.getWalletByMatricule(walletId)
            sendResponse(res, 200, 'Wallet avec user retourné', wallet)
        } catch (error: any) {
            sendError(res, 500, "Erreur lors de la récupération du user", [error.message]);
        }
    }
}

export default new WalletController();