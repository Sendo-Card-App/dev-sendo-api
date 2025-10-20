import { Router } from "express";
import conversationController from "@controllers/conversationController";
import { authMiddleware } from "@middlewares/auth";
import { hasRole } from "@middlewares/roleMiddleware";
import { paginationMiddleware } from "@middlewares/pagination";
import messageController from "@controllers/messageController";
import { upload_files_message } from "@config/cloudinary";

const router = Router();

/**
 * @swagger
 * /chat/conversations:
 *   post:
 *     summary: Crée une nouvelle conversation
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Conversation créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/conversations", 
  authMiddleware, 
  hasRole(['CUSTOMER']),
  conversationController.createConversation
);

/**
 * @swagger
 * /chat/conversations/{userId}:
 *   get:
 *     summary: Liste des conversations de l'utilisateur
 *     description: Récupère la liste des conversations de l'utilisateur
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         type: integer
 *         default: 1
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des conversations de l'utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Conversation'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    "/conversations/:userId",
    authMiddleware,
    hasRole(['CUSTOMER', 'CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN']),
    conversationController.getUserConversations
)

// /**
//  * @swagger
//  * /chat/conversations/open:
//  *   get:
//  *     summary: Liste des conversations ouvertes des utilisateurs
//  *     description: Récupère la liste des conversations ouvertes des utilisateurs
//  *     tags: [Chat]
//  *     security:
//  *       - BearerAuth: []
//  *     responses:
//  *       200:
//  *         description: Liste des conversations ouvertes des utilisateurs
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 $ref: '#/components/schemas/Conversation'
//  *       401:
//  *         $ref: '#/components/responses/Unauthorized'
//  *       403:
//  *         $ref: '#/components/responses/Forbidden'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.get(
//   '/conversations/open',
//   authMiddleware,
//   hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN']),
//   conversationController.getOpenConversations
// )

/**
 * @swagger
 * /chat/conversations/{conversationId}/change-status:
 *   put:
 *     summary: Changer le status d'une conversation
 *     description: Changer le status d'une conversation, `OPEN` `CLOSE`
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         type: string
 *         description: ID de la conversation à modifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 format: ENUM[OPEN, CLOSED, PENDING]
 *     responses:
 *       200:
 *         description: Status de la conversation modifiée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *               description: Status de la conversation modifiée avec succès
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put(
    '/conversations/:conversationId/change-status',
    authMiddleware,
    hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN']),
    conversationController.changeStatusConversation
)

/**
 * @swagger
 * /chat/conversations:
 *   get:
 *     summary: Liste des conversations
 *     description: Récupère la liste de toutes les conversations
 *     tags: [Chat]
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         type: integer
 *         default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         type: integer
 *         default: 10
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, OPEN, CLOSED]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste de toutes les conversations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Conversation'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/conversations',
    authMiddleware, paginationMiddleware,
    hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN']),
    conversationController.getAllConversations
)

/**
 * @swagger
 * /chat/messages:
 *   post:
 *     summary: Envoyer un message dans une conversation
 *     description: Envoyer un message dans une conversation, senderType `CUSTOMER` `ADMIN`
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       description: Données du message à envoyer
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               conversationId:
 *                 type: string
 *                 format: uuid
 *               content:
 *                 type: string
 *               senderType:
 *                 type: string
 *                 format: ENUM[CUSTOMER, ADMIN]
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *             required:
 *               - conversationId
 *               - content
 *     responses:
 *       201:
 *         description: Message envoyé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/messages",
  authMiddleware,
  upload_files_message,
  messageController.sendMessage
);

/**
 * @swagger
 * /chat/upload:
 *   post:
 *     summary: Upload des fichiers en pièce jointe
 *     description: Permet d'envoyer plusieurs fichiers en pièces jointes via multipart/form-data.
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *             required:
 *               - attachments
 *     responses:
 *       200:
 *         description: Fichiers uploadés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 files:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Chemins des fichiers uploadés
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  "/upload", 
  authMiddleware, 
  upload_files_message, 
  messageController.uploadFilesMessage
);

/**
 * @swagger
 * /chat/messages/{messageId}:
 *   delete:
 *     summary: Supprimer un message (réservé aux admins)
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID du message à supprimer
 *     responses:
 *       200:
 *         description: Message supprimé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Message supprimé
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete(
  "/messages/:messageId",
  authMiddleware,
  hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN']),
  messageController.deleteMessage
);

/**
 * @swagger
 * /chat/conversations/{conversationId}/messages:
 *   get:
 *     summary: Récupérer les messages d'une conversation
 *     description: Récupère la liste des messages d'une conversation.
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la conversation.
 *     responses:
 *       200:
 *         description: Liste des messages de la conversation.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  "/conversations/:conversationId/messages",
  authMiddleware,
  hasRole(['CUSTOMER', 'CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN']),
  messageController.getMessagesByConversation
);

// /**
//  * @swagger
//  * /chat/conversations/{conversationId}:
//  *   get:
//  *     summary: Récupérer les informations d'une conversation
//  *     description: Récupère les inforamtions d'une conversation.
//  *     tags: [Chat]
//  *     security:
//  *       - BearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: conversationId
//  *         required: true
//  *         schema:
//  *           type: string
//  *           format: uuid
//  *         description: ID de la conversation.
//  *     responses:
//  *       200:
//  *         description: Informations de la conversation.
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               $ref: '#/components/schemas/Message'
//  *       401:
//  *         $ref: '#/components/responses/Unauthorized'
//  *       403:
//  *         $ref: '#/components/responses/Forbidden'
//  *       500:
//  *         $ref: '#/components/responses/ServerError'
//  */
// router.get(
//   '/conversations/:conversationId',
//   authMiddleware,
//   hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
//   conversationController.getConversation
// )

/**
 * @swagger
 * /chat/messages/{messageId}:
 *   get:
 *     summary: Récupérer un message par ID
 *     description: Récupère un message spécifique par son ID.
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID du message à récupérer.
 *     responses:
 *       200:
 *         description: Message trouvé.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  "/messages/:messageId",
  authMiddleware,
  hasRole(['CUSTOMER', 'CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN']),
  messageController.getMessageById
);

/**
 * @swagger
 * /chat/messages/{messageId}:
 *   put:
 *     summary: Mettre à jour un message (admin)
 *     description: Met à jour un message existant (réservé aux admins).
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID du message à mettre à jour.
 *     requestBody:
 *       description: Données du message à mettre à jour.
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Nouveau contenu du message.
 *               read:
 *                 type: boolean
 *                 description: Statut de lecture du message.
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Message mis à jour avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put(
  "/messages/:messageId",
  authMiddleware,
  upload_files_message,
  messageController.updateMessage
);

export default router;