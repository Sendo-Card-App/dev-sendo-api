import fundRequestController from "@controllers/fundRequestController";
import { authMiddleware } from "@middlewares/auth";
import { checkKYC } from "@middlewares/kycMiddleware";
import { paginationMiddleware } from "@middlewares/pagination";
import { verifyPasscode } from "@middlewares/passcode";
import { hasRole } from "@middlewares/roleMiddleware";
import { Router } from "express";

const router = Router();

/**
 * @swagger
 * /fund-requests/create:
 *   post:
 *     summary: Créer une nouvelle demande de fonds
 *     tags: [Demandes Fonds]
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
 *               - amount
 *               - description
 *               - deadline
 *               - recipients
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 1500.00
 *                 description: Montant demandé
 *               description:
 *                 type: string
 *                 example: "Financement pour achat matériel"
 *                 description: Raison ou description de la demande
 *               deadline:
 *                 type: string
 *                 format: date
 *                 example: "2025-07-15"
 *                 description: Date limite pour répondre à la demande
 *               recipients:
 *                 type: array
 *                 description: Liste des matricule des destinataires
 *                 items:
 *                   type: object
 *                   properties:
 *                     matriculeWallet:
 *                       type: string
 *                       example: "SDO232553"
 *     responses:
 *       201:
 *         description: Demande de fonds créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Demande créée avec succès
 *                 data:
 *                   $ref: '#/components/schemas/FundRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/create",
  authMiddleware, 
  hasRole(['CUSTOMER']), 
  verifyPasscode,
  checkKYC,
  fundRequestController.createRequest
);

 /** 
 * @swagger
 * /fund-requests/my-requests/{userId}:
 *   get:
 *     summary: Récupérer les demandes de fonds initiées par l'utilisateur connecté
 *     tags: [Demandes Fonds]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Identifiant de l'utilisateur
 *     responses:
 *       200:
 *         description: Liste des demandes récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FundRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  "/my-requests/:userId",
  authMiddleware, 
  hasRole(['CUSTOMER']),
  fundRequestController.getMyRequests
);

 /**  
 * @swagger
 * /fund-requests/recipients/{requestRecipientId}/status:
 *   patch:
 *     summary: Mettre à jour le statut d'un destinataire pour une demande (`ACCEPTED` `REJECTED`)
 *     tags: [Demandes Fonds]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestRecipientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la relation destinataire-demande à mettre à jour
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACCEPTED, REJECTED]
 *                 example: ACCEPTED
 *                 description: Nouveau statut du destinataire
 *     responses:
 *       200:
 *         description: Statut mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Statut mis à jour avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Destinataire non trouvé
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch(
  "/recipients/:requestRecipientId/status",
  authMiddleware, 
  hasRole(['CUSTOMER']),
  fundRequestController.updateRequestStatus
);

 /**  
 * @swagger
 * /fund-requests/{fundRequestId}/status:
 *   patch:
 *     summary: Mettre à jour le statut d'une demande (`CANCELLED` `PENDING`)
 *     tags: [Demandes Fonds]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fundRequestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la demande de fonds à mettre à jour
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [CANCELLED, PENDING]
 *                 example: CANCELLED
 *                 description: Nouveau statut de la demande
 *     responses:
 *       200:
 *         description: Statut de la demande mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Statut de la demande mis à jour avec succès
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Destinataire non trouvé
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch(
  "/:fundRequestId/status",
  authMiddleware,
  hasRole(['CUSTOMER', 'SUPER_ADMIN', 'COMPLIANCE_OFFICER']),
  fundRequestController.updateFundRequestStatus
);

 /**
 * @swagger  
 * /fund-requests/recipients/{requestRecipientId}/pay:
 *   post:
 *     summary: Enregistrer un paiement effectué par un destinataire pour une demande
 *     tags: [Demandes Fonds]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: requestRecipientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la relation destinataire-demande pour laquelle le paiement est fait
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - fundRequestId
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 500.00
 *                 description: Montant payé
 *               fundRequestId:
 *                 type: number
 *                 example: 1
 *                 description: ID de la requête de fonds
 *               description:
 *                 type: string
 *                 description: Description du paiement
 *     responses:
 *       201:
 *         description: Paiement enregistré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Paiement enregistré avec succès
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Destinataire ou demande non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * components:
 *   schemas:
 *     FundRequest:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         amount:
 *           type: number
 *           example: 1500.00
 *         description:
 *           type: string
 *           example: "Financement projet X"
 *         deadline:
 *           type: string
 *           format: date
 *           example: "2025-07-15"
 *         status:
 *           type: string
 *           enum: [PENDING, PARTIALLY_FUNDED, FULLY_FUNDED, CANCELLED]
 *           example: PENDING
 *         userId:
 *           type: integer
 *           example: 8
 *         recipients:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 12
 *               status:
 *                 type: string
 *                 enum: [PENDING, ACCEPTED, REJECTED, PAID]
 *                 example: PENDING
 *               recipient:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 2
 *                   firstname:
 *                     type: string
 *                     example: "Alice"
 *                   lastname:
 *                     type: string
 *                     example: "Dupont"
 *
 *     Payment:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         amount:
 *           type: number
 *           example: 500.00
 *         paymentDate:
 *           type: string
 *           format: date-time
 *           example: "2025-06-01T10:30:00Z"
 *         method:
 *           type: string
 *           example: MOBILE_MONEY
 *         requestRecipientId:
 *           type: integer
 *           example: 3
 *         payerId:
 *           type: integer
 *           example: 2
 */
router.post(
  "/recipients/:requestRecipientId/pay",
  authMiddleware, 
  hasRole(['CUSTOMER']), 
  verifyPasscode,
  checkKYC,
  fundRequestController.makePayment
);

/**
 * @swagger
 * /fund-requests/list:
 *   get:
 *     summary: Récupérer toutes les demandes de fonds
 *     tags: [Demandes Fonds]
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
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, PARTIALLY_FUNDED, FULLY_FUNDED, CANCELLED] 
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
 *     responses:
 *       200:
 *         description: Liste des demandes de fonds récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FundRequest'
 */
router.get(
  '/list',
  authMiddleware, 
  paginationMiddleware,
  hasRole(['COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'TECHNICAL_DIRECTOR', 'SUPER_ADMIN', 'CARD_MANAGER', 'SYSTEM_ADMIN']),
  fundRequestController.getAllFundRequests
)

 /** 
 * @swagger
 * /fund-requests/{fundRequestId}:
 *   get:
 *     summary: Récupérer une demande de fonds par son ID
 *     tags: [Demandes Fonds]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fundRequestId
 *         required: true
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Identifiant d'une demande de fonds
 *     responses:
 *       200:
 *         description: Demande de fonds récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FundRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  "/:fundRequestId",
  authMiddleware,
  hasRole(['COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'TECHNICAL_DIRECTOR', 'SUPER_ADMIN', 'CARD_MANAGER', 'SYSTEM_ADMIN', 'CUSTOMER']),
  fundRequestController.getFundRequestById
);

/**
 * @swagger
 * /fund-requests/users/list:
 *   get:
 *     summary: Récupérer toutes les demandes de fonds dont l'utilisateur connecté fait partie
 *     tags: [Demandes Fonds]
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
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, PARTIALLY_FUNDED, FULLY_FUNDED, CANCELLED]
 *     responses:
 *       200:
 *         description: Liste des demandes de fonds récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FundRequest'
 */
router.get(
  '/users/list',
  authMiddleware, 
  paginationMiddleware,
  hasRole(['CUSTOMER']),
  fundRequestController.getAllFundRequestsForUser
)

/**
 * @swagger
 * /fund-requests/{fundRequestId}:
 *   delete:
 *     summary: Supprimer une demande de fonds
 *     tags: [Demandes Fonds]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: fundRequestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la demande de fonds à supprimer
 *     responses:
 *       200:
 *         description: Demande de fonds supprimée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Demande de fonds supprimée avec succès
 *                 data:
 *                   type: object
 *                   description: Objet représentant le résultat de la suppression de la demande de fonds
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Demande de fonds non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete(
  '/:fundRequestId',
  authMiddleware, 
  verifyPasscode, 
  hasRole(['CUSTOMER']),
  fundRequestController.deleteFundRequest
);

/**
 * @swagger
 * /fund-requests/admin/{fundRequestId}:
 *   delete:
 *     summary: Supprimer une demande de fonds côté ADMIN
 *     tags: [Demandes Fonds]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fundRequestId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la demande de fonds à supprimer
 *     responses:
 *       200:
 *         description: Demande de fonds supprimée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Demande de fonds supprimée avec succès
 *                 data:
 *                   type: object
 *                   description: Objet représentant le résultat de la suppression de la demande de fonds
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Demande de fonds non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete(
  '/admin/:fundRequestId',
  authMiddleware,
  hasRole(['SUPER_ADMIN','COMPLIANCE_OFFICER']),
  fundRequestController.deleteAdminFundRequest
);

export default router;