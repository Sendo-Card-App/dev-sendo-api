import mobileMoneyController from "../controllers/mobileMoneyController";
import { authMiddleware } from "../middlewares/auth";
import { checkKYC } from "../middlewares/kycMiddleware";
import { verifyPasscode } from "../middlewares/passcode";
import { Router } from "express";
import { hasRole } from "../middlewares/roleMiddleware";

const router = Router()

/**
 * @swagger
 * /mobile-money/smobilpay/init/deposit:
 *   post:
 *     summary: Initier une recharge mobile money
 *     tags: [Mobile Money]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *               address:
 *                 type: string 
 *               amount:
 *                 type: number
 *               matriculeWallet:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction mobile initiée avec succès
 *         $ref: '#/components/responses/TransactionMobileMoney'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/smobilpay/init/deposit',
    authMiddleware, 
    verifyPasscode,
    hasRole(['CUSTOMER']),
    mobileMoneyController.initRechargeSmobilpay
)

/**
 * @swagger
 * /mobile-money/smobilpay/init/withdrawal:
 *   post:
 *     summary: Initier une retrait mobile money
 *     tags: [Mobile Money]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *               address:
 *                 type: string 
 *               amount:
 *                 type: number
 *               matriculeWallet:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction mobile initiée avec succès
 *         $ref: '#/components/responses/TransactionMobileMoney'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/smobilpay/init/withdrawal',
    authMiddleware, 
    verifyPasscode, 
    checkKYC,
    hasRole(['CUSTOMER']),
    mobileMoneyController.initDebitSmobilpay
)

/**
 * @swagger
 * /mobile-money/check:
 *   get:
 *     summary: Récupérer une transaction effectuée par son `trid`
 *     tags: [Mobile Money]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: trid
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant unique de la transaction mobile
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           format: ENUM[DEPOSIT, WITHDRAWAL, PAYMENT, TRANSFER]
 *         description: Type de transaction `DEPOSIT` `WITHDRAWAL` `PAYMENT` `TRANSFER`
 *       - in: query
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la transaction
 *     responses:
 *       200:
 *         description: Transaction retournée avec succès
 *         $ref: '#/components/responses/TransactionMobileMoney'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/check',
    authMiddleware,
    hasRole(['CUSTOMER']),
    mobileMoneyController.verifyTransaction
)

/**
 * @swagger
 * /mobile-money/neero/init/deposit:
 *   post:
 *     summary: Initier une recharge mobile money
 *     tags: [Mobile Money]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               amount:
 *                 type: number
 *               matriculeWallet:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction mobile initiée avec succès
 *         $ref: '#/components/responses/TransactionMobileMoney'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/neero/init/deposit',
    authMiddleware, 
    verifyPasscode,
    hasRole(['CUSTOMER']),
    mobileMoneyController.creditWalletNeero
)

/**
 * @swagger
 * /mobile-money/neero/init/withdrawal:
 *   post:
 *     summary: Initier une retrait mobile money
 *     tags: [Mobile Money]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               amount:
 *                 type: number
 *               matriculeWallet:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction mobile initiée avec succès
 *         $ref: '#/components/responses/TransactionMobileMoney'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/neero/init/withdrawal',
    authMiddleware, 
    verifyPasscode, 
    checkKYC,
    hasRole(['CUSTOMER']),
    mobileMoneyController.debitWalletNeero
)

/**
 * @swagger
 * /mobile-money/neero/payment-method:
 *   post:
 *     summary: Créer une méthode de paiement pour soit un numéro de téléphone ou une balance, type `MOBILE` `BALANCE`
 *     tags: [Mobile Money]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 required: false
 *               type:
 *                 type: string
 *                 format: ENUM[MOBILE, BALANCE]
 *                 required: true
 *     responses:
 *       201:
 *         description: Méthode de paiement créée avec succès
 *         $ref: '#/components/responses/TransactionMobileMoney'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/neero/payment-method',
    authMiddleware,
    mobileMoneyController.createPaymentMethod
)

/**
 * @swagger
 * /mobile-money/neero/transactions:
 *   get:
 *     summary: Récupérer toutes les transactions Neero effectuées
 *     tags: [Mobile Money]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction neero récupérées avec succès
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/neero/transactions',
    authMiddleware,
    mobileMoneyController.listTransactionNeero
)

/**
 * @swagger
 * /mobile-money/neero/transactions/{transactionId}:
 *   get:
 *     summary: Récupérer une transaction Neero effectuée par son id
 *     tags: [Mobile Money]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant unique de la transaction neero
 *     responses:
 *       200:
 *         description: Transaction neero récupérée avec succès
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/neero/transactions/:transactionId',
    authMiddleware,
    mobileMoneyController.getTransactionNeeroById
)

export default router