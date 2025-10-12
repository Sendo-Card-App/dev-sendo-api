import contactController from "@controllers/contactController";
import { authMiddleware } from "@middlewares/auth";
import { hasRole } from "@middlewares/roleMiddleware";
import { Router } from "express";

const router = Router();

/**
 * @swagger
 * /contacts/synchronize:
 *   post:
 *     summary: Envoie groupé des contacts
 *     description: Permet de synchroniser les contacts de l'utilisateur. Voir ses contacts qui utilisent l'application.
 *     tags:
 *       - Contacts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contacts
 *             properties:
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - phone
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "John Doe"
 *                     phone:
 *                       type: string
 *                       example: "+237699779977"
 *     responses:
 *       200:
 *         description: Synchronisation effectuée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Contact'
 *       400:
 *         description: |
 *           Erreurs possibles :  
 *           - Format des données invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/synchronize', 
    authMiddleware, hasRole(['CUSTOMER']),
    contactController.synchronizeContacts
);

/**
 * @swagger
 * /contacts/users/{id}:
 *   get:
 *     summary: Récupérer les contacts de l'utilisateur
 *     description: Récupérer les contacts de l'utilisateur
 *     tags:
 *       - Contacts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
 *     responses:
 *       200:
 *         description: Contacts récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Contact'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/users/:id',
    authMiddleware, hasRole(['CUSTOMER']),
    contactController.getContacts
)

/**
 * @swagger
 * /contacts/favorites/{id}:
 *   post:
 *     summary: Ajouter un contact aux favoris
 *     description: Permet d'ajouter un contact aux favoris en utilisant son numéro de téléphone
 *     tags:
 *       - Contacts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - id
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+237699779977"
 *     responses:
 *       200:
 *         description: Contact ajouté aux favoris avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                  type: boolean
 *                  contact:
 *                    type: object
 *                    $ref: '#/components/schemas/Contact'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/favorites/:id',
    authMiddleware, hasRole(['CUSTOMER']),
    contactController.addContactToFavorites
)

/**
 * @swagger
 * /contacts/favorites/{id}:
 *   delete:
 *     summary: Supprimer un contact aux favoris
 *     description: Permet de supprimer un contact aux favoris en utilisant son numéro de téléphone
 *     tags:
 *       - Contacts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - id
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+237699779977"
 *     responses:
 *       200:
 *         description: Contact supprimé des favoris avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                  type: boolean
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete(
    '/favorites/:id',
    authMiddleware, hasRole(['CUSTOMER']),
    contactController.removeContactFromFavorites
)

/**
 * @swagger
 * /contacts/users/{id}/favorites:
 *   get:
 *     summary: Récupérer les contacts favoris de l'utilisateur
 *     description: Récupérer les contacts favoris de l'utilisateur
 *     tags:
 *       - Contacts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
 *     responses:
 *       200:
 *         description: Contacts favoris récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Contact'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/users/:id/favorites',
    authMiddleware, hasRole(['CUSTOMER']),
    contactController.getFavoriteContacts
)

export default router;