import merchantController from "@controllers/merchantController";
import { authMiddleware } from "@middlewares/auth";
import { paginationMiddleware } from "@middlewares/pagination";
import { verifyPasscode } from "@middlewares/passcode";
import { hasRole } from "@middlewares/roleMiddleware";
import { Router } from "express";

const router = Router();

/**
 * @swagger
 * /merchant/commission:
 *   post:
 *     summary: Créer un nouvelle commission
 *     description: Créer un nouvelle commission **typeCommission** `POURCENTAGE` `FIXE`
 *     tags:
 *       - Merchant
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               typeCommission:
 *                 type: string
 *                 enum: [POURCENTAGE, FIXE]
 *                 description: Type de la commission
 *               montantCommission:
 *                 type: number
 *                 description: Montant de la commission
 *               description:
 *                 type: string
 *                 required: false
 *     responses:
 *       201:
 *         description: Nouvelle commission creee avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: 
 *                   type: number
 *                 typeCommission:
 *                   type: string
 *                   enum: [POURCENTAGE, FIXE]
 *                   description: Type de la commission
 *                 montantCommission:
 *                   type: number
 *                   description: Montant de la commission
 *                 description:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/commission',
    authMiddleware,
    hasRole(['SUPER_ADMIN', 'MANAGEMENT_CONTROLLER', 'TECHNICAL_DIRECTOR']),
    merchantController.createCommission
)

/**
 * @swagger
 * /merchant/commission/{id}:
 *   put:
 *     summary: Modifier une commission creee
 *     description: Modifier une commission creee **typeCommission** `POURCENTAGE` `FIXE`
 *     tags:
 *       - Merchant
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la commission à modifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               typeCommission:
 *                 type: string
 *                 enum: [POURCENTAGE, FIXE]
 *                 description: Type de la commission
 *               montantCommission:
 *                 type: number
 *                 description: Montant de la commission
 *               description:
 *                 type: string
 *                 required: false
 *     responses:
 *       200:
 *         description: Nouvelle commission modifiee avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: 
 *                   type: number
 *                 typeCommission:
 *                   type: string
 *                   enum: [POURCENTAGE, FIXE]
 *                   description: Type de la commission
 *                 montantCommission:
 *                   type: number
 *                   description: Montant de la commission
 *                 description:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put(
    '/commission/:id',
    authMiddleware,
    hasRole(['SUPER_ADMIN']),
    merchantController.updateCommission
)

/**
 * @swagger
 * /merchant/commission/{id}:
 *   get:
 *     summary: Recuperer une commission par son ID
 *     description: Recuperer une commission par son ID
 *     tags:
 *       - Merchant
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la commission
 *     responses:
 *       200:
 *         description: Commission trouvee avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: 
 *                   type: number
 *                 typeCommission:
 *                   type: string
 *                   enum: [POURCENTAGE, FIXE]
 *                   description: Type de la commission
 *                 montantCommission:
 *                   type: number
 *                   description: Montant de la commission
 *                 description:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/commission/:id',
    authMiddleware,
    hasRole(['SUPER_ADMIN', 'MANAGEMENT_CONTROLLER', 'TECHNICAL_DIRECTOR']),
    merchantController.getCommission
)

/**
 * @swagger
 * /merchant/commissions:
 *   get:
 *     summary: Récupérer toutes les commissions du système
 *     description: Récupérer toutes les commissions du système
 *     tags:
 *       - Merchant
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Commissions récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: 
 *                       type: number
 *                     typeCommission:
 *                       type: string
 *                       enum: [POURCENTAGE, FIXE]
 *                       description: Type de la commission
 *                     montantCommission:
 *                       type: number
 *                       description: Montant de la commission
 *                     description:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/commissions',
    authMiddleware,
    hasRole(['SUPER_ADMIN', 'MANAGEMENT_CONTROLLER', 'TECHNICAL_DIRECTOR']),
    merchantController.getAllCommissions
)

/**
 * @swagger
 * /merchant/palier:
 *   post:
 *     summary: Créer un nouveau palier pour une commission
 *     description: Créer un nouveau palier pour une commission
 *     tags:
 *       - Merchant
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               montantMin:
 *                 type: number
 *                 description: Montant minimum du palier
 *               montantMax:
 *                 type: number
 *                 description: Montant maximum du palier
 *               commissionId:
 *                 type: number
 *                 description: ID de la commission associée
 *               description:
 *                 type: string
 *                 required: false
 *     responses:
 *       201:
 *         description: Palier cree avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: 
 *                   type: number
 *                 montantMin:
 *                   type: number
 *                 montantMax:
 *                   type: number
 *                 commissionId:
 *                   type: number
 *                 description:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/palier',
    authMiddleware,
    hasRole(['SUPER_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER']),
    merchantController.createPalier
)

/**
 * @swagger
 * /merchant/palier/{id}:
 *   put:
 *     summary: Modifier un palier pour une commission
 *     description: Modifier un palier pour une commission
 *     tags:
 *       - Merchant
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du palier à modifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               montantMin:
 *                 type: number
 *                 description: Montant minimum du palier
 *               montantMax:
 *                 type: number
 *                 description: Montant maximum du palier
 *               commissionId:
 *                 type: number
 *                 description: ID de la commission associée
 *               description:
 *                 type: string
 *                 required: false
 *     responses:
 *       200:
 *         description: Palier modifie avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: 
 *                   type: number
 *                 montantMin:
 *                   type: number
 *                 montantMax:
 *                   type: number
 *                 commissionId:
 *                   type: number
 *                 description:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put(
    '/palier/:id',
    authMiddleware,
    hasRole(['SUPER_ADMIN']),
    merchantController.updatePalier
)

/**
 * @swagger
 * /merchant/palier/{id}:
 *   get:
 *     summary: Recuperer un palier pour une commission
 *     description: Recuperer un palier pour une commission
 *     tags:
 *       - Merchant
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du palier
 *     responses:
 *       200:
 *         description: Palier recupere avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: 
 *                   type: number
 *                 montantMin:
 *                   type: number
 *                 montantMax:
 *                   type: number
 *                 commissionId:
 *                   type: number
 *                 description:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/palier/:id',
    authMiddleware,
    hasRole(['SUPER_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER']),
    merchantController.getPalier
)

/**
 * @swagger
 * /merchant/paliers:
 *   get:
 *     summary: Récupérer tous les paliers du système
 *     description: Récupérer tous les paliers du système 
 *     tags:
 *       - Merchant
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Paliers récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: 
 *                       type: number
 *                     montantMin:
 *                       type: number
 *                     montantMax:
 *                       type: number
 *                     commissionId:
 *                       type: number
 *                     description:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/paliers',
    authMiddleware,
    hasRole(['SUPER_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER']),
    merchantController.getAllPaliers
)

/**
 * @swagger
 * /merchant/credit-wallet:
 *   post:
 *     summary: Créditer la balance d'un marchant `Admin`
 *     description: Créditer la balance d'un marchant `Admin`
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               merchantCode:
 *                 type: string
 *                 description: Code du marchant
 *                 required: true
 *               amount:
 *                 type: integer
 *                 description: Montant à créditer
 *                 required: true
 *     responses:
 *       200:
 *         description: Transaction effectuée avec succès
 *       400:
 *         description: Champs manquants
 *       404:
 *         description: Portefeuille introuvable
 *       500:
 *         description: Erreur lors du transfert
 */
router.post(
    '/credit-wallet',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER']),
    merchantController.rechargerWalletMerchant
)

/**
 * @swagger
 * /merchant/transfer-funds:
 *   post:
 *     summary: Transférer des fonds d'un compte marchant à un portefeuille Sendo
 *     description: Transférer des fonds d'un compte marchant à un portefeuille Sendo
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               toWallet:
 *                 type: string
 *                 description: Matricule du portefeuille du receveur
 *                 required: true
 *               amount:
 *                 type: integer
 *                 description: Montant à transférer
 *                 required: true
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
    hasRole(['MERCHANT']),
    merchantController.rechargerWalletCustomer
)

/**
 * @swagger
 * /merchant/transactions/{transactionId}:
 *   get:
 *     summary: Récupère les détails d'une transaction d'un marchant
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: number
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction récupérée avec succès
 *       500:
 *         description: Transaction introuvable
 */
router.get(
    '/transactions/:transactionId',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER', 'MERCHANT']),
    merchantController.getMerchantTransactionById
);

/**
 * @swagger
 * /merchant/transactions/{idMerchant}/all:
 *   get:
 *     summary: Liste toutes les transactions d'un marchant
 *     parameters:
 *       - in: path
 *         name: idMerchant
 *         required: true
 *         schema:
 *           type: number
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
 *           enum: [PENDING, COMPLETED, FAILED, BLOCKED] 
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
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste de toutes les transactions
 */
router.get(
    '/transactions/:idMerchant/all',
    authMiddleware, 
    paginationMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER', 'MERCHANT']),
    merchantController.getAllMerchantTransactions
);

/**
 * @swagger
 * /merchant/withdrawal-request:
 *   post:
 *     summary: Enregistrer une demande de retrait mobile money d'un marchand
 *     tags: [Merchant]
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
 *               amountToWithdraw:
 *                 type: number
 *               idMerchant:
 *                 type: number
 *     responses:
 *       200:
 *         description: Demande de retrait enregistrée avec succès
 *         $ref: '#/components/responses/TransactionMobileMoney'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/withdrawal-request',
    authMiddleware, 
    verifyPasscode,
    hasRole(['MERCHANT']),
    merchantController.requestWithdraw
);

/**
 * @swagger
 * /merchant/init/withdrawal-request/{idRequestWithdraw}:
 *   post:
 *     summary: Initier le paiement d'une demande de retrait mobile money d'un marchand
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idRequestWithdraw
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la demande de retrait
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
    '/init/withdrawal-request/:idRequestWithdraw',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER']),
    merchantController.initPaymentRequestWithdraw
)

/**
 * @swagger
 * /merchant/withdrawal-request/all:
 *   get:
 *     summary: Liste toutes les demandes de retrait des marchands
 *     parameters:
 *       - in: query
 *         name: idMerchant
 *         required: false
 *         schema:
 *           type: number
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
 *           enum: [VALIDATED, REJECTED, PENDING, FAILED] 
 *     tags: [Merchant]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Demandes de retrait récupérées
 */
router.get(
    '/withdrawal-request/all',
    authMiddleware, 
    paginationMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER', 'MERCHANT']),
    merchantController.getAllRequestWithdraw
);

export default router;