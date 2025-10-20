import debtController from "@controllers/debtController";
import { authMiddleware } from "@middlewares/auth";
import { paginationMiddleware } from "@middlewares/pagination";
import { hasRole } from "@middlewares/roleMiddleware";
import { Router } from "express";


const router = Router()

/**
 * @swagger
 * /debts/all:
 *   get:
 *     summary: Recuperer toutes les dettes du systeme
 *     description: Recuperer toutes les dettes du systeme
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
 *     tags: [Debts]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dettes récupérées avec succès
 */
router.get(
    '/all',
    authMiddleware,
    paginationMiddleware,
    hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
    debtController.getAllDebts
)

/**
 * @swagger
 * /debts/users/{userId}:
 *   get:
 *     summary: Récupère les dettes d'un utilisateur
 *     description: Récupère les dettes d'un utilisateur
 *     tags: [Debts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         type: number
 *         default: 123
 *     responses:
 *       200:
 *         description: Dettes récupérées avec succès
 */
router.get(
    '/users/:userId',
    authMiddleware,
    hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
    debtController.getAllDebtsForUser
)

/**
 * @swagger
 * /debts/{idDebt}/{idCard}/pay-from-card:
 *   post:
 *     summary: Payer une dette par son ID a travers la carte
 *     description: Payer une dette par son ID a travers la carte
 *     tags: [Debts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idDebt
 *         required: true
 *         type: number
 *         default: 1
 *       - in: path
 *         name: idCard
 *         required: true
 *         type: number
 *         default: 123
 *     responses:
 *       200:
 *         description: La requête a été initiée avec succès
 */
router.post(
    '/:idDebt/:idCard/pay-from-card',
    authMiddleware,
    hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
    debtController.payOneDebtFromCard
)

/**
 * @swagger
 * /debts/{idCard}/pay-from-card:
 *   post:
 *     summary: Payer toutes les dettes d'une carte virtuelle a travers la carte
 *     description: Payer toutes les dettes d'une carte virtuelle a travers la carte
 *     tags: [Debts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idCard
 *         required: true
 *         type: number
 *         default: 123
 *     responses:
 *       200:
 *         description: La requête a été initiée avec succès
 */
router.post(
    '/:idCard/pay-from-card',
    authMiddleware,
    hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
    debtController.payDebtsFromCard
)

/**
 * @swagger
 * /debts/{idDebt}/{userId}/pay-from-wallet:
 *   post:
 *     summary: Payer une dette par son ID a travers le wallet
 *     description: Payer une dette par son ID a travers le wallet
 *     tags: [Debts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idDebt
 *         required: true
 *         type: number
 *         default: 1
 *       - in: path
 *         name: userId
 *         required: true
 *         type: number
 *         default: 123
 *     responses:
 *       200:
 *         description: La requête a été initiée avec succès
 */
router.post(
    '/:idDebt/:userId/pay-from-wallet',
    authMiddleware,
    hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
    debtController.payOneDebtFromWallet
)

/**
 * @swagger
 * /debts/{userId}/pay-from-wallet:
 *   post:
 *     summary: Payer toutes les dettes d'une carte virtuelle a travers le wallet
 *     description: Payer toutes les dettes d'une carte virtuelle a travers le wallet
 *     tags: [Debts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         type: number
 *         default: 123
 *     responses:
 *       200:
 *         description: La requête a été initiée avec succès
 */
router.post(
    '/:userId/pay-from-wallet',
    authMiddleware,
    hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
    debtController.payDebtsFromWallet
)

export default router;