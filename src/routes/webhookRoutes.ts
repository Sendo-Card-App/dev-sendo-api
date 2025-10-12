import webhookController from "@controllers/webhookController";
import { Router } from "express";
import bodyParser from 'body-parser';

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

export default router