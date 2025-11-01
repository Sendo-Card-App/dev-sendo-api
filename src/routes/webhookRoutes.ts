import webhookController from "@controllers/webhookController";
import { Router } from "express";
import bodyParser from 'body-parser';
import { paginationMiddleware } from "@middlewares/pagination";
import { authMiddleware } from "@middlewares/auth";

const router = Router()

/**
 * @swagger
 * /webhook/neero:
 *   post:
 *     summary: Récupérer le contenu d'une webhook envoyé par Neero suite à une transaction
 *     tags: [Webhook]
 *     responses:
 *       200:
 *         description: Webhook récupéré avec succès
 */
router.post(
    '/neero',
    bodyParser.raw({ type: 'application/json' }),
    webhookController.neero
)

/**
 * @swagger
 * /webhook/neero/events:
 *   get:
 *     summary: Récupérer le contenu de tous les webhooks envoyé par Neero
 *     tags: [Webhook]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [transactionIntent.statusUpdated, partyOnboardingSession.statusUpdated, cardManagement.onlineTransactions]
 *           default: "transactionIntent.statusUpdated"
 *         description: Type d'event reçu
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
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début pour filtrer les webhook (inclus)
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin pour filtrer les webhook (inclus)
 *     responses:
 *       200:
 *         description: Webhooks récupérés avec succès
 */
router.get(
    '/neero/events',
    authMiddleware,
    paginationMiddleware,
    webhookController.getEvents
)

/**
 * @swagger
 * /webhook/neero/events/{id}:
 *   get:
 *     summary: Récupérer le contenu d'un webhook envoyé par Neero
 *     tags: [Webhook]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Identifiant de l'utilisateur
 *     responses:
 *       200:
 *         description: Webhook récupéré avec succès
 *       404:
 *         description: Webhook introuvable
 *       500:
 *         description: Erreur serveur
 */
router.get(
    '/neero/events/:id',
    authMiddleware,
    webhookController.getEventById
)

export default router