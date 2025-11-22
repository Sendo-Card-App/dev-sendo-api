import destinataireService, { DestinataireCreate } from "@services/destinataireService";
import transactionService from "@services/transactionService";
import { TransactionCreate } from "../types/Transaction";
import { sendError, sendResponse } from "@utils/apiResponse";
import { typesCurrency, typesMethodTransaction, typesStatusTransaction, typesTransaction } from "@utils/constants";
import { Request, Response } from "express";
import configService from "@services/configService";
import { ajouterPrefixe237, detectOperator, troisChiffresApresVirgule } from "@utils/functions";
import logger from "@config/logger";

class DestinataireController {
    async initTransfert(req: Request, res: Response) {
        const {
            country,
            amount,
            firstname,
            lastname,
            phone,
            address
        } = req.body
        try {
            if (
                !country || 
                !amount || 
                !firstname || 
                !lastname || 
                !phone ||  
                !address
            ) {
                sendError(res, 403, 'Veuillez fournir tous les paramètres')
                return
            }
            if (!req.user) {
                sendError(res, 401, "Utilisateur non authentifié")
                return
            }

            if (Number(amount) >= 500000) {
                sendError(res, 403, 'Le montant à envoyer doit être inférieur à 500000 francs CFA')
                return
            }

            const configMinAmout = await configService.getConfigByName('MIN_AMOUNT_TO_TRANSFER_FROM_CANADA')
            if (Number(amount) < Number(configMinAmout!.value)) {
                sendError(res, 403, `Le montant minimum d\'envoi est de ${Number(configMinAmout!.value)} francs CFA`)
                return
            }
            
            const operator = detectOperator(phone)
            const payload: DestinataireCreate = {
                country,
                firstname,
                lastname,
                phone: ajouterPrefixe237(operator.phone),
                provider: operator.operator,
                address
            }
            const response = await destinataireService.createDestinataire(payload)

            const configCadReal = await configService.getConfigByName('CAD_REAL_TIME_VALUE')
            const configCadSendo = await configService.getConfigByName('SENDO_VALUE_CAD_CA_CAM')
            const configTransferFees = await configService.getConfigByName('TRANSFER_FEES')
            const amountToCAD = Number(amount) / Number(configCadSendo!.value)

            /*const transactionToCreate: TransactionCreate = {
                amount: troisChiffresApresVirgule(Number(amountToCAD)),
                type: typesTransaction['2'],
                status: typesStatusTransaction['0'],
                userId: req.user.id,
                receiverId: response.id,
                receiverType: 'Destinataire',
                currency: typesCurrency['3'],
                totalAmount: troisChiffresApresVirgule(Number(amountToCAD)) + Number(configTransferFees!.value),
                description: description,
                method: typesMethodTransaction['0'],
                provider: payload.provider,
                sendoFees: Number(configTransferFees!.value),
                exchangeRates: Number(configCadSendo!.value) - Number(configCadReal!.value),
                transactionReference: generateAlphaNumeriqueString(12)
            }*/
           const transactionToCreate: TransactionCreate = {
                amount: troisChiffresApresVirgule(Number(amountToCAD)),
                type: typesTransaction['2'],
                status: typesStatusTransaction['0'],
                userId: req.user.id,
                receiverId: response!.id,
                receiverType: 'Destinataire',
                currency: typesCurrency['3'],
                totalAmount: troisChiffresApresVirgule(Number(amountToCAD)) + Number(configTransferFees!.value),
                description: 'Transfert CA-CAM',
                method: typesMethodTransaction['0'],
                provider: payload.provider,
                sendoFees: Number(configTransferFees!.value),
                exchangeRates: Number(configCadSendo!.value) - Number(configCadReal!.value)
            }
            const transaction = await transactionService.createTransaction(transactionToCreate)

            logger.info("Transfert initié", {
                amount: amountToCAD,
                user: `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`,
                receiver: `Destinataire ID : ${response!.id} - ${response!.firstname} ${response!.lastname}`
            });

            sendResponse(res, 200, 'Transfert initié', {
                transaction,
                receiver: response
            })
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }

    async initBankTransfert(req: Request, res: Response) {
        const {
            amount,
            bankName,
            nameAccount,
            accountNumber
        } = req.body
        try {
            if (
                !amount || 
                !bankName || 
                !nameAccount || 
                !accountNumber
            ) {
                sendError(res, 403, 'Veuillez fournir tous les paramètres')
                return
            }
            if (!req.user) {
                sendError(res, 401, "Utilisateur non authentifié")
                return
            }

            if (Number(amount) >= 500000) {
                sendError(res, 403, 'Le montant à envoyer doit être inférieur à 500000 francs CFA')
                return
            }

            const configMinAmout = await configService.getConfigByName('MIN_AMOUNT_TO_TRANSFER_FROM_CANADA')
            if (Number(amount) < Number(configMinAmout!.value)) {
                sendError(res, 403, `Le montant minimum d\'envoi est de ${Number(configMinAmout!.value)} francs CFA`)
                return
            }

            const payload: DestinataireCreate = {
                firstname: nameAccount,
                lastname: '****',
                provider: 'BANK',
                accountNumber,
                address: bankName
            }
            const response = await destinataireService.createDestinataire(payload)

            const configCadSendo = await configService.getConfigByName('SENDO_VALUE_CAD_CA_CAM')
            const configTransferFees = await configService.getConfigByName('TRANSFER_FEES')
            const amountToCAD = Number(amount) / Number(configCadSendo!.value)

            const transactionToCreate: TransactionCreate = {
                amount: troisChiffresApresVirgule(Number(amountToCAD)),
                type: typesTransaction['2'],
                status: typesStatusTransaction['0'],
                userId: req.user.id,
                receiverId: response!.id,
                receiverType: 'Destinataire',
                bankName,
                accountNumber,
                currency: typesCurrency['3'],
                totalAmount: troisChiffresApresVirgule(Number(amountToCAD)) + Number(configTransferFees!.value),
                description: 'Transfert CA-CAM',
                method: typesMethodTransaction['1'],
                provider: 'BANK',
                sendoFees: Number(configTransferFees!.value)
            }
            const transaction = await transactionService.createTransaction(transactionToCreate)

            logger.info("Bank transfert initié", {
                amount: troisChiffresApresVirgule(amountToCAD),
                user: `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`,
                receiver: `Destinataire : ${bankName} - ${nameAccount} - ${accountNumber}`
            });

            sendResponse(res, 200, 'Transfert initié', {
                transaction,
                receiver: {
                    bankName,
                    nameAccount,
                    accountNumber
                }
            })
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }

    async initTransfertFromDestinataire(req: Request, res: Response) {
        const { destinataireId, amount } = req.body
        try {
            if (!destinataireId || !amount) {
                sendError(res, 403, 'Veuillez fournir tous les paramètres')
                return
            }
            if (!req.user) {
                sendError(res, 401, "Utilisateur non authentifié")
                return
            }
            const configMinAmout = await configService.getConfigByName('MIN_AMOUNT_TO_TRANSFER_FROM_CANADA')
            if (parseInt(amount) < (configMinAmout?.value ?? 0)) {
                sendError(res, 403, `Le montant minimum d\'envoi est de ${configMinAmout?.value} francs CFA`)
                return
            }

            const destinataire = await destinataireService.getDestinataire(parseInt(destinataireId))
            if (!destinataire) {
                sendError(res, 404, "Destinataire introuvable")
                return
            }

            const configCadReal = await configService.getConfigByName('CAD_REAL_TIME_VALUE')
            const configCadSendo = await configService.getConfigByName('CAD_SENDO_VALUE')
            const configTransferFees = await configService.getConfigByName('TRANSFER_FEES')
            const amountToCAD = Number(amount) / Number(configCadSendo!.value)
            
            /*const transactionToCreate: TransactionCreate = {
                amount: amountToCAD,
                type: typesTransaction['2'],
                status: typesStatusTransaction['0'],
                userId: req.user.id,
                receiverId: destinataire.id,
                receiverType: 'Destinataire',
                currency: typesCurrency['0'],
                totalAmount: amountToCAD + Number(configTransferFees!.value),
                description: description,
                method: typesMethodTransaction['0'],
                provider: destinataire.provider,
                sendoFees: Number(configTransferFees!.value),
                exchangeRates: Number(configCadReal!.value) - Number(configCadSendo!.value),
                transactionReference: generateAlphaNumeriqueString(12)
            }*/
           const transactionToCreate: TransactionCreate = {
                amount: troisChiffresApresVirgule(Number(amountToCAD)),
                type: typesTransaction['2'],
                status: typesStatusTransaction['0'],
                userId: req.user.id,
                receiverId: destinataire.id,
                receiverType: 'Destinataire',
                currency: typesCurrency['3'],
                totalAmount: troisChiffresApresVirgule(Number(amountToCAD)) + Number(configTransferFees!.value),
                description: 'Transfert CA-CAM',
                method: typesMethodTransaction['0'],
                provider: destinataire.provider,
                sendoFees: Number(configTransferFees!.value),
                exchangeRates: Number(configCadSendo!.value) - Number(configCadReal!.value)
            }
            const transaction = await transactionService.createTransaction(transactionToCreate)

            logger.info("Transfert initié", {
                amount: amount,
                user: `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`,
                receiver: `Destinataire ID : ${destinataire.id} - ${destinataire.firstname} ${destinataire.lastname}`
            });

            sendResponse(res, 200, 'Transfert initié', {
                transaction,
                receiver: destinataire
            })
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', error.message)
        }
    }
}

export default new DestinataireController()