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
 *           properties:
 *             from:
 *               type: string
 *             to:
 *               type: string
 *             subject:
 *               type: string
 *             text:
 *               type: string
 *     responses:
 *       200:
 *         description: Envoyer un email
 *       500:
 *         description: Erreur serveur
 */
router.post("/send", emailController.sendEmail);

export default router;