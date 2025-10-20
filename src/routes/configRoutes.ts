import configController from "@controllers/configController";
import { authMiddleware } from "@middlewares/auth";
import { paginationMiddleware } from "@middlewares/pagination";
import { hasRole } from "@middlewares/roleMiddleware";
import { Router } from "express";

const router = Router();

// /**
//  * @swagger
//  * /configs:
//  *   post:
//  *     summary: Créer une nouvelle valeur configurable
//  *     tags: [Configs]
//  *     security:
//  *       - BearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               name:
//  *                 type: string
//  *               value:
//  *                 type: number
//  *               description:
//  *                 type: string
//  *     responses:
//  *       201:
//  *         description: Configuration créée
//  */
router.post(
    '',
    authMiddleware, hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
    configController.create
)

/**
 * @swagger
 * /configs:
 *   get:
 *     summary: Liste toutes les valeurs configurables
 *     tags: [Configs]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des configurations
 */
router.get(
    '',
    authMiddleware,
    configController.list
)

/**
 * @swagger
 * /configs/{id}:
 *   put:
 *     summary: Mettre à jour la valeur d'une configuration
 *     tags: [Configs]
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
 *           application/json:
 *             schema:
 *               type: object
 *             properties:
 *               value:
 *                 type: number
 *     responses:
 *       200:
 *         description: Configuration mise à jour
 *       404:
 *         description: Configuration non trouvé
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
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
    configController.update
)

/**
 * @swagger
 * /configs/convert-devise:
 *   get:
 *     summary: Convertir une somme d'un montant à un autre
 *     tags: [Configs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           example: "XAF"
 *         description: Devise source (code ISO 4217)
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           example: "USD"
 *         description: Devise cible (code ISO 4217)
 *       - in: query
 *         name: amount
 *         required: true
 *         type: number
 *     responses:
 *       200:
 *         description: Valeur convertie de la monnaie
 *       404:
 *         description: Donnée non trouvée
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
/*router.get(
    '/convert-devise',
    authMiddleware,
    configController.showCurrencyValue
)*/

/**
 * @swagger
 * /configs/get-one-value:
 *   get:
 *     summary: Récupère la valeur d'une monnaie en une autre
 *     tags: [Configs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           example: "XAF"
 *         description: Devise source (code ISO 4217)
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           example: "EUR"
 *         description: Devise cible (code ISO 4217)
 *     responses:
 *       200:
 *         description: Valeur convertie de la monnaie
 *       404:
 *         description: Donnée non trouvée
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
/*router.get(
    '/get-one-value',
    authMiddleware,
    configController.getOneValue
)*/

/**
 * @swagger
 * /configs/get-multi-value:
 *   get:
 *     summary: Récupère la valeur d'une monnaie en plusieurs autres monnaies
 *     tags: [Configs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           example: "XAF"
 *         description: Devise source (code ISO 4217)
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           example: "USD,EUR,GBP,JPY"
 *         description: Devises cibles séparées par des virgules
 *     responses:
 *       200:
 *         description: Valeur convertie de la monnaie
 *       404:
 *         description: Donnée non trouvée
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
/*router.get(
    '/get-multi-value',
    authMiddleware,
    configController.getMultiValue
)*/

export default router;