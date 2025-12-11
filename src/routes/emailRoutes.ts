import emailController from "@controllers/emailController";
import { Router } from "express";

const router = Router();

/**
 * @swagger
 * /email/send:
 *   post:
 *     summary: Envoyer des emails
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               from:
 *                 type: string
 *               to:
 *                 type: string
 *               subject:
 *                 type: string
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Envoyer un email
 *       500:
 *         description: Erreur serveur
 */
router.post("/send", emailController.sendEmail);

/**
 * @swagger
 * /email/send-group:
 *   post:
 *     summary: Envoyer des emails de marketing groupés
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Emails envoyés avec succès
 *       500:
 *         description: Erreur serveur
 */
router.post("/send-group", emailController.sendEmailMarketing);

export default router;