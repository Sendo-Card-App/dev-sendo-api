import { Router } from "express";
import kycController from "@controllers/kycController";
import { authMiddleware } from "@middlewares/auth";
import { upload, upload_single } from "@config/cloudinary";
import { fileCheck } from "@middlewares/kycMiddleware";
import { hasRole } from "@middlewares/roleMiddleware";
import notificationController from "@controllers/notificationController";
import { paginationMiddleware } from "@middlewares/pagination";

const router = Router();

/**
 * @swagger
 * /notification/send:
 *   post:
 *     summary: Envoyez une notification push dans l'application mobile
 *     description: Les types de notification `SUCCESS_ACCOUNT_VERIFIED`, `INFORMATION`, `MARKETING`, `SUCCESS_KYC_VERIFIED`, `SUCCESS_TRANSFER_FUNDS`, `SUCCESS_DEPOSIT_CARD`, `SUCCESS_DEPOSIT_CARD`, `PAYMENT_FAILED`, `SUCCESS_ADD_SECOND_NUMBER`, `SUCCESS_VERIFY_SECOND_NUMBER`, `SUCCESS_CREATING_CARD`, `ERROR`, `SUCCESS_MODIFY_PASSWORD`, `SUCCESS_MODIFY_ACCOUNT_INFORMATIONS`, `DELETE_ACCOUNT`, `ENABLED_ACCOUNT`, `DISABLED_ACCOUNT`
 *     tags:
 *       - Notifications
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               title:
 *                 type: string
 *               body:
 *                 type: string
 *               type:
 *                 schema:
 *                   type: string
 *                   enum: [SUCCESS_ACCOUNT_VERIFIED, INFORMATION, MARKETING, SUCCESS_KYC_VERIFIED, SUCCESS_TRANSFER_FUNDS, SUCCESS_DEPOSIT_CARD, SUCCESS_DEPOSIT_CARD, PAYMENT_FAILED, SUCCESS_ADD_SECOND_NUMBER, SUCCESS_VERIFY_SECOND_NUMBER, SUCCESS_CREATING_CARD, ERROR, SUCCESS_MODIFY_PASSWORD, SUCCESS_MODIFY_ACCOUNT_INFORMATIONS, DELETE_ACCOUNT, ENABLED_ACCOUNT, 'DISABLED_ACCOUNT']
 *     responses:
 *       201:
 *         description: Notification envoyée avec succ-s
 *       403:
 *         description: Erreur de validation
 *       400:
 *         description: Erreur serveur
 */
router.post(
    '/send', 
    authMiddleware, hasRole(['CUSTOMER']),
    notificationController.sendNotification
);

/**
 * @swagger
 * /notification/list:
 *   get:
 *     summary: Liste toutes les notifications des utilisateurs
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
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [SUCCESS_ACCOUNT_VERIFIED, INFORMATION, MARKETING, SUCCESS_KYC_VERIFIED, SUCCESS_TRANSFER_FUNDS, SUCCESS_DEPOSIT_CARD, SUCCESS_DEPOSIT_CARD, PAYMENT_FAILED, SUCCESS_ADD_SECOND_NUMBER, SUCCESS_VERIFY_SECOND_NUMBER, SUCCESS_CREATING_CARD, ERROR, SUCCESS_MODIFY_PASSWORD, SUCCESS_MODIFY_ACCOUNT_INFORMATIONS, DELETE_ACCOUNT, ENABLED_ACCOUNT, 'DISABLED_ACCOUNT']
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [SENDED, NOT_SENDED] 
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des notifications
 */
router.get(
    '/list',
    authMiddleware, 
    paginationMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'MANAGEMENT_CONTROLLER', 'TECHNICAL_DIRECTOR']),
    notificationController.list
)

/**
 * @swagger
 * /notification/users/{userId}:
 *   get:
 *     summary: Liste toutes les notifications d'un utilisateur
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
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
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [SUCCESS_ACCOUNT_VERIFIED, INFORMATION, MARKETING, SUCCESS_KYC_VERIFIED, SUCCESS_TRANSFER_FUNDS, SUCCESS_DEPOSIT_CARD, SUCCESS_DEPOSIT_CARD, PAYMENT_FAILED, SUCCESS_ADD_SECOND_NUMBER, SUCCESS_VERIFY_SECOND_NUMBER, SUCCESS_CREATING_CARD, ERROR, SUCCESS_MODIFY_PASSWORD, SUCCESS_MODIFY_ACCOUNT_INFORMATIONS, DELETE_ACCOUNT, ENABLED_ACCOUNT, 'DISABLED_ACCOUNT']
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [SENDED, NOT_SENDED] 
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des notifications d'un utilisateur
 */
router.get(
    '/users/:userId',
    authMiddleware, 
    paginationMiddleware, 
    notificationController.getNotificationsUser
)

/**
 * @swagger
 * /notification/{id}/read:
 *   put:
 *     summary: Marquer une notification comme lue
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Notification marquée comme lue
 */
router.put(
    '/:id/read',
    authMiddleware, hasRole(['CUSTOMER']),
    notificationController.markedAsRead
)

export default router;