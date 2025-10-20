import { Router } from "express";
import pubController from "@controllers/pubController";
import { authMiddleware } from "@middlewares/auth";
import { hasRole } from "@middlewares/roleMiddleware";
import { paginationMiddleware } from "@middlewares/pagination";
import { upload_pub } from "@config/cloudinary";

const router = Router();

/**
 * @swagger
 * /admin/pubs:
 *   get:
 *     summary: Récupère la liste des publicités
 *     tags: [Publicités]
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
 *         description: Publicités récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       imageUrl:
 *                         type: string
 *                       price:
 *                         type: number
 *                       description:
 *                         type: string
 *                       link:
 *                         type: string
 *       500:
 *         description: Erreur serveur
 */
router.get(
    '',
    authMiddleware, 
    paginationMiddleware,
    pubController.getPubs
);

/**
 * @swagger
 * /admin/pubs/{id}:
 *   get:
 *     summary: Récupère une publicité par son ID
 *     tags: [Publicités]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la publicité
 *     responses:
 *       200:
 *         description: Publicité récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     imageUrl:
 *                       type: string
 *                     price:
 *                       type: number
 *                     description:
 *                       type: string
 *                     link:
 *                       type: string
 *       400:
 *         description: ID de la publicité requis
 *       404:
 *         description: Publicité introuvable
 *       500:
 *         description: Erreur serveur
 */
router.get(
    '/:id',
    authMiddleware,
    hasRole(['SUPER_ADMIN', 'CUSTOMER']),
    pubController.getPubById
);

/**
 * @swagger
 * /admin/pubs:
 *   post:
 *     summary: Crée une nouvelle publicité
 *     tags: [Publicités]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               name:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *                 required: true
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *               link:
 *                 type: string
 *     responses:
 *       201:
 *         description: Publicité créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     imageUrl:
 *                       type: string
 *                     price:
 *                       type: number
 *                     description:
 *                       type: string
 *                     link:
 *                       type: string
 *       400:
 *         description: L'URL de l'image est requise
 *       500:
 *         description: Erreur serveur
 */
router.post(
    '',
    authMiddleware, 
    upload_pub,
    hasRole(['SUPER_ADMIN']),
    (req, res) => pubController.createPub(req, res)
);

/**
 * @swagger
 * /admin/pubs/{id}:
 *   put:
 *     summary: Met à jour une publicité
 *     tags: [Publicités]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la publicité
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageUrl
 *             properties:
 *               name:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *               link:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Publicité modifiée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     imageUrl:
 *                       type: string
 *                     price:
 *                       type: number
 *                     description:
 *                       type: string
 *                     link:
 *                       type: string
 *       400:
 *         description: ID de la publicité et URL de l'image requis
 *       500:
 *         description: Erreur serveur
 */
router.put(
    '/:id',
    authMiddleware,
    hasRole(['SUPER_ADMIN']),
    pubController.updatePub
);

/**
 * @swagger
 * /admin/pubs/{id}:
 *   delete:
 *     summary: Supprime une publicité
 *     tags: [Publicités]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la publicité
 *     responses:
 *       204:
 *         description: Publicité supprimée avec succès
 *       400:
 *         description: ID de la publicité requis
 *       500:
 *         description: Erreur serveur
 */
router.delete(
    '/:id',
    authMiddleware,
    hasRole(['SUPER_ADMIN']),
    pubController.deletePub
);

export default router;