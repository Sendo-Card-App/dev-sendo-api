import destinataireController from "@controllers/destinataireController";
import mobileMoneyController from "@controllers/mobileMoneyController";
import { authMiddleware } from "@middlewares/auth";
import { checkKYC } from "@middlewares/kycMiddleware";
import { verifyPasscode } from "@middlewares/passcode";
import { checkCountry, hasRole } from "@middlewares/roleMiddleware";
import { Router } from "express";

const router = Router()

/**
 * @swagger
 * /transfer-money/init:
 *   post:
 *     summary: Initier un transfert d'argent vers l'étranger
 *     tags: [Transfert Argent]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               country:
 *                 type: string
 *               amount:
 *                 type: number
 *               firstname:
 *                 type: string
 *               lastname:
 *                 type: string
 *               phone:
 *                 type: string 
 *               address:
 *                 type: string 
 *               description:
 *                 type: string
 *                 required: false
 *     responses:
 *       200:
 *         description: Transaction d'argent initiée avec succès
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/init',
    authMiddleware, 
    verifyPasscode, 
    checkKYC, 
    hasRole(['CUSTOMER']),
    checkCountry(['Canada']),
    destinataireController.initTransfert
)

/**
 * @swagger
 * /transfer-money/init-to-know-destinataire:
 *   post:
 *     summary: Initier un transfert d'argent vers l'étranger à destinataire connu
 *     tags: [Transfert Argent]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destinataireId:
 *                 type: number
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *                 required: false
 *     responses:
 *       200:
 *         description: Transaction d'argent initiée avec succès
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/init-to-know-destinataire',
    authMiddleware, 
    hasRole(['CUSTOMER']), 
    checkKYC, 
    verifyPasscode,
    checkCountry(['Canada']),
    destinataireController.initTransfertFromDestinataire
)

/**
 * @swagger
 * /transfer-money/list:
 *   get:
 *     summary: Récupérer tous mes transferts d'argent
 *     tags: [Transfert Argent]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Transferts récupérés avec succès
 *       404:
 *         description: Utilisateur introuvable, veuillez vous connecter
 *       500:
 *         description: Erreur lors de la récupération
 */
router.get(
    '/list',
    authMiddleware, hasRole(['CUSTOMER']),
    mobileMoneyController.listTrasnfertsUser
)

export default router