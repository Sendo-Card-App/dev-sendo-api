import { upload_bankReleve } from "@config/cloudinary";
import walletController from "@controllers/walletController";
import { authMiddleware } from "@middlewares/auth";
import { checkKYC } from "@middlewares/kycMiddleware";
import { verifyPasscode } from "@middlewares/passcode";
import { checkCountry, hasRole } from "@middlewares/roleMiddleware";
import { Router } from "express";

const router = Router();

/**
 * @swagger
 * /wallet:
 *   post:
 *     summary: Crée un nouveau wallet
 *     tags: [Wallets]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: number
 *     responses:
 *       201:
 *         description: Portefeuille créé
 */
router.post(
    '', 
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
    walletController.createWallet
);

/**
 * @swagger
 * /wallet/balance/{id}:
 *   get:
 *     summary: Recuperer le solde du portefeuille d'un utilisateur par son ID
 *     description: Recupere le solde du portefeuille d'un utilisateur par son ID
 *     tags: [Wallets]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           format: int64
 *         description: ID unique de l'utilisateur
 *     responses:
 *       200:
 *         description: Solde récupéré
 *       404:
 *         description: Utilisateur non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Erreur serveur
 */
router.get(
    '/balance/:userId',
    authMiddleware, 
    verifyPasscode, 
    //checkKYC, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'CUSTOMER', 'CUSTOMER_ADVISER']),
    walletController.getWalletBalance
);

/**
 * @swagger
 * /wallet/transfer-funds:
 *   post:
 *     summary: Transférer des fonds d'un portefeuille à un autre
 *     description: Transférer des fonds d'un portefeuille SENDO à un autre
 *     tags: [Wallets]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromWallet:
 *                 type: string
 *                 description: Matricule du portefeuille de l'envoyeur
 *                 required: true
 *               toWallet:
 *                 type: string
 *                 description: Matricule du portefeuille du receveur
 *                 required: true
 *               amount:
 *                 type: integer
 *                 description: Montant à transférer
 *                 required: true
 *               description:
 *                 type: string
 *                 description: Description de la transaction
 *                 required: false
 *     responses:
 *       200:
 *         description: Transaction effectuée avec succès
 *       400:
 *         description: Solde insuffisant
 *       404:
 *         description: Portefeuille introuvable
 *       500:
 *         description: Erreur lors du transfert
 */
router.post(
    '/transfer-funds',
    authMiddleware, 
    verifyPasscode, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CUSTOMER']),
    walletController.transferFunds
)

/**
 * @swagger
 * /wallet/recharge:
 *   post:
 *     summary: Recharger son portefeuille
 *     description: On peut recharger son portefeuille de plusieurs façons. Les différents types de method `MOBILE_MONEY` `BANK_TRANSFER` et `INTERAC`
 *     tags: [Wallets]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               method:
 *                 type: string
 *                 description: Les différents types de method `MOBILE_MONEY` `BANK_TRANSFER` et `INTERAC`
 *               amount:
 *                 type: integer
 *                 description: Montant de la transaction
 *               bankFile:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Transaction effectuée avec succès
 *       400:
 *         description: Solde insuffisant
 *       404:
 *         description: Portefeuille introuvable
 *       500:
 *         description: Erreur lors du transfert
 */
router.post(
    '/recharge',
    authMiddleware, 
    verifyPasscode, 
    checkKYC, 
    hasRole(['CUSTOMER']), 
    upload_bankReleve,
    walletController.creditWalletRequest
)

/**
 * @swagger
 * /wallet/deposit:
 *   post:
 *     summary: Recharger un portefeuille côté `ADMIN`
 *     description: Recharger un portefeuille côté `ADMIN`
 *     tags: [Wallets]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               matriculeWallet:
 *                 type: string
 *                 description: Matricule du portefeuille
 *               amount:
 *                 type: integer
 *                 description: Montant de la transaction
 *     responses:
 *       200:
 *         description: Transaction effectuée avec succès
 *       404:
 *         description: Portefeuille introuvable
 *       500:
 *         description: Erreur lors de la recharge
 */
router.post(
    '/deposit',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER']),
    walletController.depositWalletAdmin
)

/**
 * @swagger
 * /wallet/withdrawal:
 *   post:
 *     summary: Débiter un montant d'un portefeuille côté `ADMIN`
 *     description: Débiter un montant d'un portefeuille côté `ADMIN`
 *     tags: [Wallets]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               matriculeWallet:
 *                 type: string
 *                 description: Matricule du portefeuille
 *               amount:
 *                 type: integer
 *                 description: Montant de la transaction
 *     responses:
 *       200:
 *         description: Transaction effectuée avec succès
 *       404:
 *         description: Portefeuille introuvable
 *       500:
 *         description: Erreur lors du retrait
 */
router.post(
    '/withdrawal',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER']), 
    walletController.withdrawalWalletAdmin
)

/**
 * @swagger
 * /wallet/{walletId}:
 *   get:
 *     summary: Recuperer un portefeuille et un user par le numéro de compte du wallet
 *     description: Recuperer un portefeuille et un user par le numéro de compte du wallet
 *     tags: [Wallets]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         description: Numéro de compte du wallet
 *     responses:
 *       200:
 *         description: Portefeuille et utilisateur récupéré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: integer
 *                 currency:
 *                   type: string
 *                   format: ENUM[XAF, USD, EUR, CAD]
 *                 status:
 *                   type: string
 *                   format: ENUM[ACTIVE, BLOCKED]
 *                 matricule:
 *                   type: string
 *                 userId:
 *                   type: integer
 *                 user:
 *                   type: UserModel
 *       404:
 *         description: Portefeuille introuvable
 *       500:
 *         description: Erreur serveur
 */
router.get(
    '/:walletId',
    authMiddleware, 
    //checkKYC, 
    hasRole(['CUSTOMER', 'MERCHANT']),
    walletController.getUserByWallet
);

/**
 * @swagger
 * /wallet/request-withdrawal:
 *   post:
 *     summary: Demander un transfert de son compte vers son compte Interac
 *     description: Demande de retrait sur un compte en CAD
 *     tags: [Wallets]
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
 *               matriculeWallet:
 *                 type: string
 *                 description: Matricule du portefeuille
 *               amount:
 *                 type: integer
 *                 description: Montant de la transaction
 *               emailInterac:
 *                 type: string
 *                 description: Email du compte Interac
 *               questionInterac:
 *                 type: string
 *                 description: Question lié au compte Interac
 *               responseInterac:
 *                 type: string
 *                 description: Réponse liée à la question du compte Interac
 *     responses:
 *       200:
 *         description: Transaction enregistrée avec succès
 *       404:
 *         description: Portefeuille introuvable
 *       500:
 *         description: Erreur lors du retrait
 */
router.post(
    '/request-withdrawal',
    authMiddleware, 
    verifyPasscode, 
    checkKYC,
    hasRole(['CUSTOMER']), 
    walletController.requestWithdraw
)

export default router;