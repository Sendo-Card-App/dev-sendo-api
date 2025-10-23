import transactionController from "@controllers/transactionController";
import { authMiddleware } from "@middlewares/auth";
import { paginationMiddleware } from "@middlewares/pagination";
import { hasRole } from "@middlewares/roleMiddleware";
import { Router } from "express";

const router = Router()

/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: Liste toutes les transactions des utilisateurs
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page pour la pagination
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [DEPOSIT, WITHDRAWAL, TRANSFER, PAYMENT, WALLET_TO_WALLET, SHARED_PAYMENT, FUND_REQUEST_PAYMENT, TONTINE_PAYMENT, VIEW_CARD_DETAILS]
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, BLOCKED] 
 *       - in: query
 *         name: method
 *         required: false
 *         schema:
 *           type: string
 *           enum: [MOBILE_MONEY, BANK_TRANSFER, VIRTUAL_CARD, WALLET]
 *         description: Les différentes méthodes de dépôt
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début pour filtrer les transactions (inclus)
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin pour filtrer les transactions (inclus)
 *     tags: [Transactions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des transactions
 */
router.get(
    '',
    authMiddleware, 
    paginationMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER']),
    transactionController.getTransactions
);

/**
 * @swagger
 * /transactions/{transactionId}:
 *   get:
 *     summary: Récupérer tout le contenu d'une transaction grâce à son ID
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         type: string
 *         default: SDO050525.1528.X34303
 *     tags: [Transactions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction trouvée
 *       404:
 *         description: Transaction introuvable
 *       500:
 *         description: Erreur serveur
 */
router.get(
    '/:transactionId',
    authMiddleware,
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER']),
    transactionController.getTransaction
);

/**
 * @swagger
 * /transactions/users/{userId}:
 *   get:
 *     summary: Récupérer toutes les transactions d'un utilisateur
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Identifiant de l'utilisateur
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numéro de page pour la pagination
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Nombre d'éléments par page
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [DEPOSIT, WITHDRAWAL, TRANSFER, PAYMENT, WALLET_TO_WALLET, SHARED_PAYMENT, FUND_REQUEST_PAYMENT, TONTINE_PAYMENT, VIEW_CARD_DETAILS]
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, BLOCKED] 
 *       - in: query
 *         name: method
 *         required: false
 *         schema:
 *           type: string
 *           enum: [MOBILE_MONEY, BANK_TRANSFER, VIRTUAL_CARD, WALLET]
 *         description: Les différentes méthodes de dépôt
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début pour filtrer les transactions (inclus)
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin pour filtrer les transactions (inclus)
 *     tags: [Transactions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Transactions trouvées
 *       404:
 *         description: Utilisateur introuvable
 *       500:
 *         description: Erreur serveur
 */
router.get(
    '/users/:userId',
    authMiddleware, 
    paginationMiddleware,
    //hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER']),
    transactionController.getAllTransactionsUser
)

export default router