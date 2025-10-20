import { CashinCashout, CollectPayload } from "../types/SmobilPay";
import { sendError, sendResponse } from "@utils/apiResponse";
import { ajouterPrefixe237, detectMoneyTransferType, detectOperator, detectOtherMoneyTransferType, generateAlphaNumeriqueString, mapNeeroStatusToSendo, roundToNextMultipleOfFive } from "@utils/functions";
import { Request, Response } from "express";
import mobileMoneyService from "@services/mobileMoneyService";
import { TransactionCreate } from "../types/Transaction";
import { typesCurrency, typesMethodTransaction, typesStatusTransaction, TypesTransaction, typesTransaction } from "@utils/constants";
import transactionService from "@services/transactionService";
import walletService, { settleCardDebtsIfAny } from "@services/walletService";
import WalletModel from "@models/wallet.model";
import destinataireService from "@services/destinataireService";
import neeroService, { CashInPayload, CashOutPayload, PaymentMethodCreate, PaymentMethodPayload } from "@services/neeroService";
import PaymentMethodModel from "@models/payment-method.model";
import configService from "@services/configService";
import notificationService from "@services/notificationService";
import cardService from "@services/cardService";
import logger from "@config/logger";

// Fonction d'attente générique
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class MobileMoneyController {
    async initRechargeSmobilpay(req: Request, res: Response) {
        const { phone, email, name, address, amount, matriculeWallet } = req.body
        try {
            if (
                !phone || !email || !name || !address || !amount || !matriculeWallet
            ) {
                sendError(res, 403, 'Tous les champs doivent être fournis')
            }

            // Vérification de l'opérateur à appeler
            let cashin: CashinCashout[] | null = null;
            const operator = detectOperator(phone)
            if (operator.operator === 'Orange') {
                cashin = await mobileMoneyService.getCashinOrCashout(process.env.SMOBILPAY_CASHIN_ORANGE_SERVICE, 'cashin')
            } else if (operator.operator === 'MTN') {
                cashin = await mobileMoneyService.getCashinOrCashout(process.env.SMOBILPAY_CASHIN_MTN_SERVICE, 'cashin')
            }
            
            if (!cashin || !Array.isArray(cashin) || cashin.length === 0) {
                throw new Error("Aucun cashout disponible");
            }
            const payItemId = cashin[0].payItemId
            const serviceid = cashin[0].serviceid
            console.log('phone number  : ', operator.phone)
            //exécution du endpoint pour vérifier la destination
            const destination = await mobileMoneyService.getDestination(phone, serviceid)
            if (destination.status !== 'VERIFIED') {
                throw new Error('Le compte du destinataire est suspect')
            }

            //Si tout est OK, on poursuit
            const postQuote = await mobileMoneyService.postQuote(payItemId, parseInt(amount));

            const payload: CollectPayload = {
                customerPhonenumber: operator.phone,
                customerEmailaddress: email,
                customerName: name,
                customerAddress: address,
                serviceNumber: operator.phone,
                trid: generateAlphaNumeriqueString(12),
                amount: parseInt(amount),
                quoteId: postQuote.quoteId
            }
            const postCollect = await mobileMoneyService.postCollect(payload)

            // Ajout du délai de 10 secondes
            await wait(10000);

            const verifyTx = await mobileMoneyService.getVerifyTx(postCollect.trid)

            const transactionToCreate: TransactionCreate = {
                amount: parseInt(amount),
                type: typesTransaction['0'],
                status: verifyTx[0].status === 'SUCCESS' ? typesStatusTransaction['1'] : typesStatusTransaction['0'],
                userId: req.user!.id,
                currency: typesCurrency['0'],
                totalAmount: parseInt(amount),
                method: typesMethodTransaction['0'],
                provider: verifyTx[0].merchant,
                transactionReference: verifyTx[0].trid,
                receiverId: req.user!.id,
                receiverType: 'User'
            }
            const transaction = await transactionService.createTransaction(transactionToCreate)

            let wallet: WalletModel | null = null;
            if (verifyTx[0].status === 'SUCCESS') {
                //Créditer le wallet du demandeur
                wallet = await walletService.creditWallet(
                    matriculeWallet, 
                    parseInt(amount), 
                    "MOBILE_MONEY"
                )
            }

            logger.info("Recharge smobilpay initiée", {
                user: `${req.user?.firstname} ${req.user?.lastname}`,
                amount: parseInt(amount),
                provider: verifyTx[0].merchant
            });
            
            sendResponse(res, 200, 'La requête a été initié avec succès', {
                mobileMoney: verifyTx[0],
                transaction,
                wallet
            })
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }

    async initDebitSmobilpay(req: Request, res: Response) {
        const { phone, email, name, address, amount, matriculeWallet } = req.body
        try {
            if (
                !phone || !email || !name || !address || !amount || !matriculeWallet
            ) {
                sendError(res, 403, 'Tous les champs doivent être fournis')
            }
            if (!req.user || !req.user.id) {
                sendError(res, 401, 'Veuillez vous connecter')
            }

            // Vérification de l'opérateur à appeler
            let cashout: CashinCashout[] | null = null;
            const operator = detectOperator(phone)
            if (operator.operator === 'Orange') {
                cashout = await mobileMoneyService.getCashinOrCashout(process.env.SMOBILPAY_CASHOUT_ORANGE_SERVICE, 'cashout')
            } else if (operator.operator === 'MTN') {
                cashout = await mobileMoneyService.getCashinOrCashout(process.env.SMOBILPAY_CASHOUT_MTN_SERVICE, 'cashout')
            }
            
            if (!cashout || !Array.isArray(cashout) || cashout.length === 0) {
                throw new Error("Aucun cashout disponible");
            }

            const payItemId = cashout[0].payItemId

            //Si tout est OK, on poursuit
            const postQuote = await mobileMoneyService.postQuote(payItemId, parseInt(amount));

            const payload: CollectPayload = {
                customerPhonenumber: operator.phone,
                customerEmailaddress: email,
                customerName: name,
                customerAddress: address,
                serviceNumber: operator.phone,
                trid: generateAlphaNumeriqueString(12),
                amount: parseInt(amount),
                quoteId: postQuote.quoteId
            }
            const postCollect = await mobileMoneyService.postCollect(payload)

            // Ajout du délai de 10 secondes
            await wait(10000);

            const verifyTx = await mobileMoneyService.getVerifyTx(postCollect.trid)

            const transactionToCreate: TransactionCreate = {
                amount: parseInt(amount),
                type: typesTransaction['1'],
                status: verifyTx[0].status === 'SUCCESS' ? typesStatusTransaction['1'] : typesStatusTransaction['0'],
                userId: req.user!.id,
                currency: typesCurrency['0'],
                totalAmount: parseInt(amount),
                method: typesMethodTransaction['0'],
                provider: verifyTx[0].merchant,
                transactionReference: verifyTx[0].trid,
                receiverId: req.user!.id,
                receiverType: 'User'
            }
            const transaction = await transactionService.createTransaction(transactionToCreate)

            let wallet: WalletModel | null = null;
            if (verifyTx[0].status === 'SUCCESS') {
                //Débiter le wallet du demandeur
                wallet = await walletService.debitWallet(
                    matriculeWallet, 
                    parseInt(amount), 
                    "MOBILE_MONEY"
                )
            }

            logger.info("Débit smobilpay initié", {
                user: `${req.user?.firstname} ${req.user?.lastname}`,
                amount: parseInt(amount),
                provider: verifyTx[0].merchant
            });
            
            sendResponse(res, 200, 'La requête a été initié avec succès', {
                mobileMoney: verifyTx[0],
                transaction,
                wallet
            })
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }

    async verifyTransaction(req: Request, res: Response) {
        const { trid, type, transactionId } = req.query
        try {
            if (!trid) {
                sendError(res, 403, 'Veuillez l\'id de la transaction')
            }

            const typeTransaction: TypesTransaction = type as TypesTransaction;

            const verifyTx = await mobileMoneyService.getVerifyTx(trid as string)
            const amount = parseInt(String(verifyTx[0].priceLocalCur))

            //On récupère la transaction
            const transaction = await transactionService.getTransaction(transactionId as string)
            const matricule = transaction?.user?.wallet?.matricule;
            if (!matricule) {
                throw new Error("Matricule du portefeuille introuvable");
            }

            let wallet: WalletModel | null = null;
            if (
                verifyTx[0].status === 'SUCCESS' && 
                typeTransaction === 'WITHDRAWAL' &&
                transaction?.status === 'PENDING'
            ) {
                //Débiter le wallet du demandeur
                wallet = await walletService.debitWallet(
                    matricule, 
                    amount, 
                    "MOBILE_MONEY"
                )
            } else if (
                verifyTx[0].status === 'SUCCESS' && 
                typeTransaction === 'DEPOSIT' &&
                transaction?.status === 'PENDING'
            ) {
                //Créditer le wallet du demandeur
                wallet = await walletService.creditWallet(
                    matricule, 
                    amount, 
                    "MOBILE_MONEY"
                )
            }

            sendResponse(res, 200, 'Transaction retournée', {
                mobileMoney: verifyTx[0],
                transaction,
                wallet
            })
        } catch (error: any) {
            console.log('Nous sommes dans le controller', error)
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }

    async initTransfert(
        phone: string, 
        name: string, 
        address: string, 
        amount: number,
        transactionReference: string
    ) {
        if (
            !phone || !name || !address || !amount
        ) {
            throw new Error('Tous les paramètres doivent être fournis');
        }
        try {
            // Vérification de l'opérateur à appeler
            let cashin: CashinCashout[] | null = null;
            const operator = detectOperator(phone)
            if (operator.operator === 'Orange') {
                cashin = await mobileMoneyService.getCashinOrCashout(process.env.SMOBILPAY_CASHIN_ORANGE_SERVICE, 'cashin')
            } else if (operator.operator === 'MTN') {
                cashin = await mobileMoneyService.getCashinOrCashout(process.env.SMOBILPAY_CASHIN_MTN_SERVICE, 'cashin')
            }
            
            if (!cashin || !Array.isArray(cashin) || cashin.length === 0) {
                throw new Error("Aucun cashout disponible");
            }

            const payItemId = cashin[0]?.payItemId
            const serviceid = cashin[0]?.serviceid

            //exécution du endpoint pour vérifier la destination
            const destination = await mobileMoneyService.getDestination(phone, serviceid)
            if (destination.status !== 'VERIFIED') {
                throw new Error('Le compte du destinataire est suspect')
            }

            //Si tout est OK, on poursuit
            const postQuote = await mobileMoneyService.postQuote(payItemId, amount);

            const payload: CollectPayload = {
                customerPhonenumber: operator.phone,
                customerEmailaddress: "",
                customerName: name,
                customerAddress: address,
                serviceNumber: operator.phone,
                trid: transactionReference,
                amount,
                quoteId: postQuote.quoteId
            }
            const postCollect = await mobileMoneyService.postCollect(payload)

            // Ajout du délai de 3 secondes
            await wait(10000);

            const verifyTx = await mobileMoneyService.getVerifyTx(postCollect.trid)
            
            return verifyTx[0]
        } catch (error: any) {
            return false
        }
    }

    async listTrasnfertsUser(req: Request, res: Response) {
        try {
            if (!req.user || !req.user.id) {
                sendError(res, 401, 'Veuillez vous connecter');
                return;
            }
            const transactions = await destinataireService.getTransactionsUser(req.user.id)
            sendResponse(res, 200, 'Liste des transactions récupérée avec succès', transactions);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async creditWalletNeero(req: Request, res: Response) {
        const { amount, matriculeWallet, phone } = req.body
        try {
            if (!amount || !matriculeWallet || !phone) {
                sendError(res, 403, 'Tous les champs doivent être fournis')
            }

            // 1. Conversion du montant en nombre entier
            const amountNum = Number(amount);

            // 2. Vérification que le montant est un nombre valide
            if (isNaN(amountNum) || !Number.isInteger(amountNum)) {
                sendError(res, 400, "Le montant doit être un nombre entier valide");
                return;
            }

            // 3. Vérifier les limites
            if (amountNum < 500 || amountNum > 500000) {
                sendError(res, 400, "Le montant doit être compris entre 500 et 500000 XAF");
                return;
            }

            // 4. Vérification que le montant est un multiple de 50
            if (amountNum % 50 !== 0) {
                sendError(res, 400, "Le montant doit être un multiple de 50");
                return;
            }

            if (!req.user || !req.user.id) {
                sendError(res, 401, 'Veuillez vous connecter');
                return;
            }

            const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
            if (!paymentMethodMerchant) {
                throw new Error("Erreur lors de la récupération de la source")
            }

            let payload: CashInPayload | undefined;

            const paymentMethodsUser = await mobileMoneyService.getPaymentMethodUser(req.user!.id)
            if (!paymentMethodsUser) {
                throw new Error("Erreur de récupération des méthodes de paiement de l'utilisateur")
            }
            
            let paymentMethod: PaymentMethodModel;
            let created: boolean;
            
            const configPourcentage = await configService.getConfigByName('SENDO_DEPOSIT_PERCENTAGE')
            const configFees = await configService.getConfigByName('SENDO_DEPOSIT_FEES')
            const percentage = Number(configPourcentage?.value ?? 0);
            const fixedFee = Number(configFees?.value ?? 0);
            const fees = Math.ceil(amountNum * (percentage / 100) + fixedFee);
            
            if (
                paymentMethodsUser.paymentMethods && 
                (
                    paymentMethodsUser.paymentMethods.length === 0 || 
                    !paymentMethodsUser.paymentMethods.find(p => p.phone === phone)
                )
            ) {
                [paymentMethod, created] = await mobileMoneyService.createPaymentMethod(ajouterPrefixe237(phone), req.user.id)

                payload = {
                    //amount: roundToNextMultipleOfFive(amountNum + fees),
                    amount: roundToNextMultipleOfFive(amountNum),
                    currencyCode: 'XAF',
                    confirm: true,
                    paymentType: 'MERCHANT_COLLECTION',
                    sourcePaymentMethodId: paymentMethod.paymentMethodId,
                    destinationPaymentMethodId: paymentMethodMerchant?.paymentMethodId || ''
                }
            } else if (paymentMethodsUser.paymentMethods && paymentMethodsUser.paymentMethods.length >= 1) {
                payload = {
                    amount: roundToNextMultipleOfFive(amountNum),
                    currencyCode: 'XAF',
                    confirm: true,
                    paymentType: 'MERCHANT_COLLECTION',
                    sourcePaymentMethodId: paymentMethodsUser.paymentMethods.find(p => p.phone === phone)?.paymentMethodId || '',
                    destinationPaymentMethodId: paymentMethodMerchant?.paymentMethodId || ''
                }
            } else {
                throw new Error("Aucune méthode de paiement valide trouvée pour l'utilisateur");
            }

            if (!payload) {
                throw new Error("Le payload de cashout n'a pas pu être généré.");
            }

            const transactionToCreate: TransactionCreate = {
                amount: amountNum,
                type: typesTransaction['0'],
                status: 'PENDING',
                userId: req.user!.id,
                currency: typesCurrency['0'],
                totalAmount: amountNum + parseInt(`${fees}`),
                method: typesMethodTransaction['0'],
                provider: detectOtherMoneyTransferType(phone),
                sendoFees: parseInt(`${fees}`),
                description: "Dépôt sur le portefeuille",
                receiverId: req.user!.id,
                receiverType: 'User'
            }
            const transaction = await transactionService.createTransaction(transactionToCreate)
            
            const cashin = await neeroService.createCashInPayment(payload)

            transaction.transactionReference = cashin.id;
            await transaction.save()
            
            await wait(10000)

            const neeroTransaction = await neeroService.getTransactionIntentById(cashin.id)
            transaction.status = mapNeeroStatusToSendo(neeroTransaction.status);
            await transaction.save()

            const newTransaction = await transaction.reload()
            
            if (
                newTransaction.status === 'COMPLETED' && 
                newTransaction.type === 'DEPOSIT' &&
                newTransaction.method === 'MOBILE_MONEY'
            ) {
                const wallet = await walletService.getWalletByMatricule(matriculeWallet)
                await walletService.creditWallet(
                    wallet.matricule,
                    newTransaction.amount
                )

                // On check si la carte possede des dettes
                console.log('On check si la carte possede des dettes')
                await settleCardDebtsIfAny(wallet.matricule, newTransaction.userId)

                const token = await notificationService.getTokenExpo(req?.user?.id ?? 0)
                await notificationService.save({
                    title: 'Sendo',
                    content: `Votre recharge de ${newTransaction.amount} XAF s'est effectuée avec succès`,
                    userId: req.user!.id,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'SUCCESS_DEPOSIT_WALLET'
                })
            }

            logger.info("Recharge neero initiée", {
                user: `${req.user?.firstname} ${req.user?.lastname}`,
                amount: amountNum,
                provider: detectOtherMoneyTransferType(phone)
            });
            
            sendResponse(res, 200, 'La requête a été initiée avec succès', {
                mobileMoney: neeroTransaction,
                transaction
            })
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }

    async debitWalletNeero(req: Request, res: Response) {
        const { amount, matriculeWallet, phone } = req.body
        try {
            if (
                !amount || !matriculeWallet || !phone
            ) {
                sendError(res, 403, 'Tous les champs doivent être fournis')
            }

            if (!req.user || !req.user.id) {
                sendError(res, 401, 'Veuillez vous connecter');
                return;
            }

            const amountNum = Number(amount);
        
            // 1. Vérifier que c'est un nombre entier
            if (!Number.isInteger(amountNum)) {
                sendError(res, 400, "Le montant doit être un nombre entier (sans décimales)");
                return;
            }
            
            // 2. Vérifier les limites
            if (amountNum < 500 || amountNum > 500000) {
                sendError(res, 400, "Le montant doit être compris entre 500 et 500000 XAF");
                return;
            }

            const configPourcentage = await configService.getConfigByName('SENDO_WITHDRAWAL_PERCENTAGE')
            const configFees = await configService.getConfigByName('SENDO_WITHDRAWAL_FEES')
            const percentage = Number(configPourcentage?.value ?? 0);
            const fixedFee = Number(configFees?.value ?? 0);
            const fees = Math.ceil(amountNum * (percentage / 100) + fixedFee);

            const wallet = await walletService.getBalanceWallet(req.user.id)
            if (!wallet) {
                throw new Error("Portefeuille introuvable")
            }
            
            const total = amountNum + fees;
            if (wallet.balance < total) {
                throw new Error(`Solde insuffisant, veuillez avoir ${total} XAF votre compte pour effectuer ce retrait`)
            }

            const paymentMethodMerchant = await neeroService.getPaymentMethodMarchant()
            if (!paymentMethodMerchant) {
                throw new Error("Erreur lors de la récupération de la source")
            }

            let payload: CashOutPayload | undefined;

            const paymentMethodsUser = await mobileMoneyService.getPaymentMethodUser(req.user.id)
            if (!paymentMethodsUser) {
                throw new Error("Erreur de récupération des méthodes de paiement de l'utilisateur")
            }
            
            let paymentMethod: PaymentMethodModel;
            let created: boolean;
            
            if (
                paymentMethodsUser.paymentMethods && 
                (
                    paymentMethodsUser.paymentMethods.length === 0 || 
                    !paymentMethodsUser.paymentMethods.find(p => p.phone === phone)
                )
            ) {
                [paymentMethod, created] = await mobileMoneyService.createPaymentMethod(phone, req.user.id)

                payload = {
                    amount: amountNum,
                    currencyCode: 'XAF',
                    confirm: true,
                    paymentType: detectMoneyTransferType(phone).transferType,
                    sourcePaymentMethodId: paymentMethodMerchant?.paymentMethodId || '',
                    destinationPaymentMethodId: paymentMethod.paymentMethodId
                }
            } else if (paymentMethodsUser.paymentMethods && paymentMethodsUser.paymentMethods.length >= 1) {
                payload = {
                    amount: amountNum,
                    currencyCode: 'XAF',
                    confirm: true,
                    paymentType: detectMoneyTransferType(phone).transferType,
                    sourcePaymentMethodId: paymentMethodMerchant?.paymentMethodId || '',
                    destinationPaymentMethodId: paymentMethodsUser.paymentMethods.find(p => p.phone === phone)?.paymentMethodId ?? ''
                }
            } else {
                throw new Error("Aucune méthode de paiement valide trouvée pour l'utilisateur");
            }

            if (!payload) {
                throw new Error("Le payload de cashout n'a pas pu être généré.");
            }

            const transactionToCreate: TransactionCreate = {
                amount: amountNum,
                type: typesTransaction['1'],
                status: 'PENDING',
                userId: req.user!.id,
                currency: typesCurrency['0'],
                totalAmount: total,
                method: typesMethodTransaction['0'],
                provider: detectOtherMoneyTransferType(phone),
                sendoFees: parseInt(`${fees}`),
                description: "Retrait sur le portefeuille",
                receiverId: req.user!.id,
                receiverType: 'User'
            }
            const transaction = await transactionService.createTransaction(transactionToCreate)
            
            const cashout = await neeroService.createCashOutPayment(payload)
            transaction.transactionReference = cashout.id;
            await transaction.save()

            await wait(5000)

            const neeroTransaction = await neeroService.getTransactionIntentById(cashout.id)

            transaction.status = mapNeeroStatusToSendo(neeroTransaction.status);
            await transaction.save()
            const newTransaction = await transaction.reload()
            
            if (
                newTransaction.type === 'WITHDRAWAL' && 
                newTransaction.status === 'COMPLETED' &&
                newTransaction.method === 'MOBILE_MONEY'
            ) {
                if (newTransaction.amount > 0) {
                    await walletService.debitWallet(
                        matriculeWallet,
                        newTransaction.amount
                    )
                }
                const token = await notificationService.getTokenExpo(req?.user?.id ?? 0)
                await notificationService.save({
                    title: 'Sendo',
                    content: `Votre retrait de ${newTransaction.amount} XAF s'est effectué avec succès`,
                    userId: req?.user?.id ?? 0,
                    status: 'SENDED',
                    token: token?.token ?? '',
                    type: 'SUCCESS_WITHDRAWAL_WALLET'
                })
            }

            logger.info("Débit neero initié", {
                user: `${req.user?.firstname} ${req.user?.lastname}`,
                amount: amountNum,
                provider: detectOtherMoneyTransferType(phone)
            });
            
            sendResponse(res, 200, 'La requête de débit a été initiée avec succès', {
                mobileMoney: neeroTransaction,
                transaction: newTransaction
            })
        } catch (error: any) {
            console.log("error local : ", error.message)
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }

    async createPaymentMethod(req: Request, res: Response) {
        const { phoneNumber, type } = req.body
        try {
            if ((type === 'MOBILE' && !phoneNumber) || !type) {
                sendError(res, 403, 'Veuillez fournir tous les champs')
            }

            if (!req.user || !req.user.id) {
                sendError(res, 401, 'Veuillez vous connecter');
                return;
            }

            const typeCasted = type === 'MOBILE' ? 'MOBILE_MONEY' : 'NEERO_MERCHANT';
            let payloadPaymentMethod: PaymentMethodPayload;
            if (type === 'MOBILE') {
                payloadPaymentMethod = {
                    type: typeCasted,
                    mobileMoneyDetails: {
                        phoneNumber,
                        countryIso: 'CM',
                        mobileMoneyProvider: detectOtherMoneyTransferType(phoneNumber)
                    },
                    personDetails: {
                        personId: req.user.id,
                        accountId: req.user.wallet?.matricule ?? '',
                        paymentRequestId: null
                    }
                }
            } else if (type === 'BALANCE') {
                payloadPaymentMethod = {
                    type: typeCasted,
                    neeroMerchantDetails: {
                        merchantKey: process.env.NEERO_MERCHANT_KEY || '',
                        storeId: process.env.NEERO_ID_STORE || '',
                        balanceId: process.env.NEERO_ID_BALANCE || '',
                        operatorId: parseInt(process.env.NEERO_SENDO_KEY as string)
                    }
                }
            } else {
                throw new Error("Type de moyen de paiement invalide.");
            }

            const paymentMethod = await neeroService.createPaymentMethod(payloadPaymentMethod)

            if (!paymentMethod.id) {
                throw new Error("L'identifiant du moyen de paiement est manquant.");
            }

            const paymentMethodModel: PaymentMethodCreate = {
                type: typeCasted,
                paymentMethodId: paymentMethod.id,
                phone: phoneNumber,
                userId: typeCasted === 'MOBILE_MONEY' ? req.user.id : (typeCasted === 'NEERO_MERCHANT' ? null : undefined)
            }
            await neeroService.findOrSavePaymentMethod(paymentMethodModel)

            sendResponse(res, 201, "PaymentMethod créé avec succès", paymentMethod)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async listTransactionNeero(req: Request, res: Response) {
        try {
            const transactions = await neeroService.listTransactionIntents()
            sendResponse(res, 200, 'Transactions neero récupérées avec succès', transactions)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }

    async getTransactionNeeroById(req: Request, res: Response) {
        const { transactionId } = req.params
        try {
            const transaction = await neeroService.getTransactionIntentById(transactionId)
            sendResponse(res, 200, 'Transaction neero récupérée avec succès', transaction)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }
}

export default new MobileMoneyController()