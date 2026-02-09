import FundSubscriptionController from "@controllers/fundSubscriptionController";
import { authMiddleware } from "@middlewares/auth";
import { paginationMiddleware } from "@middlewares/pagination";
import { verifyPasscode } from "@middlewares/passcode";
import { hasRole } from "@middlewares/roleMiddleware";
import { Router } from "express";

const router = Router();

/**
 * @swagger
 * /fund-subscriptions/funds:
 *   get:
 *     summary: Récupérer tous les tarifs d'investissement
 *     tags: [Fonds Bloqués]
 *     security:
 *       - BearerAuth: []
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
 *     responses:
 *       200:
 *         description: Liste des demandes de souscriptions récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FundSubscription'
 */
router.get(
    "/funds", 
    authMiddleware,
    paginationMiddleware,
    FundSubscriptionController.listFundSubscriptions
);

/**
 * @swagger  
 * /fund-subscriptions/subscribe:
 *   post:
 *     summary: Souscrire à un fond bloqué (investire)
 *     tags: [Fonds Bloqués]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fundId
 *               - currency
 *             properties:
 *               fundId:
 *                 type: string
 *                 description: ID du fond bloqué
 *               currency:
 *                 type: string
 *                 description: monnaie du fond bloqué
 *                 enum: [XAF, CAD]
 *                 example: "XAF"
 *     responses:
 *       200:
 *         description: Souscription réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Souscription réussie
 *                 data:
 *                   $ref: '#/components/schemas/FundSubscription'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/subscribe",
  authMiddleware,
  verifyPasscode,
  hasRole(['CUSTOMER']),
  FundSubscriptionController.subscribe
);

/**
 * @swagger
 * /fund-subscriptions/subscriptions:
 *   get:
 *     summary: Récupérer toutes les demandes de souscriptions à un fond bloqué
 *     tags: [Fonds Bloqués]
 *     security:
 *       - BearerAuth: []
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
 *         name: userId
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [ACTIVE, MATURED, CLOSED] 
 *       - in: query
 *         name: currency
 *         required: false
 *         schema:
 *           type: string
 *           enum: [XAF, CAD] 
 *     responses:
 *       200:
 *         description: Liste des demandes de fonds récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FundSubscription'
 */
router.get(
    "/subscriptions", 
    authMiddleware,
    paginationMiddleware,
    FundSubscriptionController.filteredSubscriptions
);

/**
 * @swagger  
 * /fund-subscriptions/withdrawals/request:
 *   post:
 *     summary: Effectuer une demande de retrait de fonds
 *     tags: [Fonds Bloqués]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscriptionId
 *               - type
 *             properties:
 *               subscriptionId:
 *                 type: string
 *                 description: ID de la souscription
 *               type:
 *                 type: string
 *                 description: Type de retrait
 *                 enum: [INTEREST_ONLY, FULL_WITHDRAWAL]
 *                 example: "INTEREST_ONLY"
 *     responses:
 *       200:
 *         description: Souscription réussie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Demande envoyée
 *                 data:
 *                   $ref: '#/components/schemas/WithdrawalFundRequest'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/withdrawals/request",
  authMiddleware,
  hasRole(['CUSTOMER']),
  FundSubscriptionController.request
);

/**
 * @swagger  
 * /fund-subscriptions/withdrawals/process:
 *   post:
 *     summary: Traiter une demande de retrait de fonds
 *     tags: [Fonds Bloqués]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *               - action
 *             properties:
 *               requestId:
 *                 type: string
 *                 description: ID de la demande de retrait
 *               action:
 *                 type: string
 *                 description: Type d'action
 *                 enum: [APPROVED, REJECTED]
 *                 example: "APPROVED"
 *     responses:
 *       200:
 *         description: Demande approuvée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Demande approuvée
 *                 data:
 *                   $ref: '#/components/schemas/WithdrawalFundRequest'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/withdrawals/process",
  authMiddleware,
  hasRole(['SUPER_ADMIN', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER']),
  FundSubscriptionController.process
);

/**
 * @swagger
 * components:
 *   schemas:
 *     FundSubscription:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         userId:
 *           type: number
 *           example: 1
 *         fundId:
 *           type: number
 *           example: 1
 *         amount:
 *           type: number
 *           example: 100000
 *         commissionRate:
 *           type: number
 *           example: 2.5
 *         interestAmount:
 *           type: number
 *           example: 15000
 *         startDate:
 *           type: string
 *           format: date
 *           example: "2025-07-15"
 *         endDate:
 *           type: string
 *           format: date
 *           example: "2025-07-15"
 *         currency:
 *           type: string
 *           enum: [XAF, CAD]
 *           example: "XAF"
 *         status:
 *           type: string
 *           enum: [ACTIVE, MATURED, CLOSED]
 *           example: "ACTIVE"
 * 
 *     WithdrawalFundRequest:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         userId:
 *           type: number
 *           example: 1
 *         subscriptionId:
 *           type: number
 *           example: 1
 *         type:
 *           type: string
 *           enum: [INTEREST_ONLY, FULL_WITHDRAWAL]
 *           example: "INTEREST_ONLY"
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *           example: "PENDING"
 *         processedAt:
 *           type: string
 *           format: date
 *           example: "2025-07-15"
 */

export default router;