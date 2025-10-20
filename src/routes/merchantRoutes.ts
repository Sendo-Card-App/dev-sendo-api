import merchantController from "@controllers/merchantController";
import { authMiddleware } from "@middlewares/auth";
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

export default router;