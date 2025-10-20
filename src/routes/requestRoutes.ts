import { Router } from 'express';
import requestController from '@controllers/requestController';
import { hasRole } from '@middlewares/roleMiddleware';
import { authMiddleware } from '@middlewares/auth';
import { paginationMiddleware } from '@middlewares/pagination';
import { upload_request } from '@config/cloudinary';

const router = Router();

/**
 * @swagger
 * /requests/ask:
 *   post:
 *     summary: Effectuer une demande
 *     description: Les demandes sont de types `NIU_REQUEST`
 *     tags:
 *       - Requests
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 format: ENUM[NIU_REQUEST]
 *               description:
 *                 type: string
 *                 example: "Non obligatoire"
 *     responses:
 *       201:
 *         description: Demande enregistrée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                 status:
 *                   type: string
 *                 description:
 *                   type: string
 *                 userId:
 *                   type: integer
 *       500:
 *         description: Erreur lors de la création de la demande
 *       404:
 *         description: Portefeuille ou configuration introuvable
 */
router.post(
    '/ask',
    authMiddleware, 
    hasRole(['CUSTOMER']),
    requestController.askRequest
)


/**
 * @swagger
 * /requests/list:
 *   get:
 *     summary: Récupérer tous les demandes
 *     description: Récupérer tous les demandes
 *     tags:
 *       - Requests
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         type: integer
 *         default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         type: integer
 *         default: 10
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [NIU_REQUEST]
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PROCESSED, REJECTED, UNPROCESSED]
 *     responses:
 *       200:
 *         description: Liste de toutes les demandes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Request'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/list',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'CARD_MANAGER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER']), 
    paginationMiddleware,
    requestController.listRequests
)

/**
 * @swagger
 * /requests/{id}:
 *   put:
 *     summary: Mettre à jour le status d'une demande
 *     description: Voici les status des demandes `PROCESSED`, `UNPROCESSED`, `REJECTED`
 *     tags: [Requests]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 format: ENUM[PROCESSED, UNPROCESSED, REJECTED]
 *               reason:
 *                 type: string
 *               request:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Status de la demande mis à jour
 *       404:
 *         description: Demande non trouvé
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
router.put(
    '/:id',
    authMiddleware, 
    hasRole(['COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'SUPER_ADMIN', 'CUSTOMER']),
    upload_request,
    requestController.updateStatusRequest
)

/**
 * @swagger
 * /requests/users/{id}:
 *   get:
 *     summary: Récupérer tous les demandes d'un utilisateur
 *     description: Récupérer tous les demandes d'un utilisateur
 *     tags:
 *       - Requests
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         type: integer
 *         default: 1
 *       - in: query
 *         name: page
 *         required: false
 *         type: integer
 *         default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         type: integer
 *         default: 10
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [NIU_REQUEST]
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PROCESSED, REJECTED, UNPROCESSED]
 *     responses:
 *       200:
 *         description: Liste de toutes les demandes de l'utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Request'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/users/:id',
    authMiddleware, 
    paginationMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'CARD_MANAGER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER']), 
    requestController.listRequestUser
)

export default router;