import paymentologyController from "@controllers/paymentologyController";
import { Router } from "express";

const router = Router()

/**
 * @swagger
 * /paymentology/create:
 *   post:
 *     summary: Crée une nouvelle carte paymentology
 *     tags: [Paymentology]
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
    '/create',
    paymentologyController.createVirtualCard
);

export default router