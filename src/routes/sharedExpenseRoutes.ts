import { Router } from "express";
import sharedExpenseController from "../controllers/sharedExpenseController";
import { authMiddleware } from "@middlewares/auth";
import { hasRole } from "@middlewares/roleMiddleware";
import { checkKYC } from "@middlewares/kycMiddleware";
import { verifyPasscode } from "@middlewares/passcode";
import { paginationMiddleware } from "@middlewares/pagination";

const router = Router();

/**
 * @swagger
 * /shared-expense/create:
 *   post:
 *     summary: Créer une dépense partagée
 *     tags: [Dépenses Partagées]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - totalAmount
 *               - description
 *               - participants
 *               - limitDate
 *               - includeMyself
 *             properties:
 *               totalAmount:
 *                 type: number
 *                 example: 150.00
 *                 description: Montant total de la dépense
 *               description:
 *                 type: string
 *                 example: "Dîner entre amis"
 *                 description: Description de la dépense
 *               participants:
 *                 type: array
 *                 description: Liste des participants (hors initiateur si includeMyself est false)
 *                 items:
 *                   type: object
 *                   required:
 *                     - matriculeWallet
 *                   properties:
 *                     matriculeWallet:
 *                       type: string
 *                       example: "SDO232553"
 *                       description: Matricule du portefeuille
 *                     amount:
 *                       type: number
 *                       example: 50.00
 *                       description: Montant attribué au participant (nécessaire si méthode 'manual')
 *               limitDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-06-15"
 *                 description: Date limite pour le paiement
 *               includeMyself:
 *                 type: boolean
 *                 example: true
 *                 description: L'initiateur participe-t-il à la dépense ?
 *               methodCalculatingShare:
 *                 type: string
 *                 enum: [auto, manual]
 *                 example: "auto"
 *                 description: Méthode de calcul des parts (auto = parts égales, manual = montants définis)
 *     responses:
 *       201:
 *         description: Dépense partagée créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dépense partagée créée avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     sharedExpense:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         totalAmount:
 *                           type: number
 *                           example: 150.00
 *                         description:
 *                           type: string
 *                           example: "Dîner entre amis"
 *                         userId:
 *                           type: integer
 *                           example: 8
 *                         initiatorPart:
 *                           type: number
 *                           example: 50.00
 *                         limitDate:
 *                           type: string
 *                           format: date
 *                           example: "2025-06-15"
 *                         status:
 *                           type: string
 *                           example: "PENDING"
 *                     initiator:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 8
 *                         firstname:
 *                           type: string
 *                           example: "John"
 *                         lastname:
 *                           type: string
 *                           example: "Doe"
 *                         phone:
 *                           type: string
 *                           example: "+1234567890"
 *                         email:
 *                           type: string
 *                           example: "admin@gmail.com"
 *                     participants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: integer
 *                             example: 12
 *                           sharedExpenseId:
 *                             type: integer
 *                             example: 1
 *                           part:
 *                             type: number
 *                             example: 50.00
 *                           paymentStatus:
 *                             type: string
 *                             example: "PENDING"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/create',
  authMiddleware, 
  hasRole(['CUSTOMER']), 
  checkKYC, 
  verifyPasscode,
  sharedExpenseController.createExpense
)

/**
 * @swagger
 * /shared-expense/list:
 *   get:
 *     summary: Récupérer toutes les dépenses partagées
 *     tags: [Dépenses Partagées]
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
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, CANCELLED] 
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début pour filtrer les transactions (inclus)
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin pour filtrer les transactions (inclus)
 *     responses:
 *       200:
 *         description: Liste des dépenses partagées récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Liste des dépenses partagées récupérée avec succès
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       totalAmount:
 *                         type: number
 *                         example: 150.00
 *                       description:
 *                         type: string
 *                         example: "Dîner entre amis"
 *                       userId:
 *                         type: integer
 *                         example: 8
 *                       initiatorPart:
 *                         type: number
 *                         example: 50.00
 *                       limitDate:
 *                         type: string
 *                         format: date
 *                         example: "2025-06-15"
 *                       status:
 *                         type: string
 *                         example: "PENDING"
 */
router.get(
  '/list',
  authMiddleware, 
  paginationMiddleware,
  hasRole(['COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'TECHNICAL_DIRECTOR', 'SUPER_ADMIN', 'SYSTEM_ADMIN']),
  sharedExpenseController.getAllExpenses
)

/**
 * @swagger
 * /shared-expense/{idExpense}:
 *   get:
 *     summary: Récupérer une dépense partagée par ID
 *     tags: [Dépenses Partagées]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idExpense
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la dépense partagée à récupérer
 *     responses:
 *       200:
 *         description: Dépense partagée récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dépense partagée récupérée avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     totalAmount:
 *                       type: number
 *                       example: 150.00
 *                     description:
 *                       type: string
 *                       example: "Dîner entre amis"
 *                     userId:
 *                       type: integer
 *                       example: 8
 *                     initiatorPart:
 *                       type: number
 *                       example: 50.00
 *                     limitDate:
 *                       type: string
 *                       format: date
 *                       example: "2025-06-15"
 *                     status:
 *                       type: string
 *                       example: "PENDING"
 *                     initiator:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 8
 *                         firstname:
 *                           type: string
 *                           example: "John"
 *                         lastname:
 *                           type: string
 *                           example: "Doe"
 *                         phone:
 *                           type: string
 *                           example: "+1234567890"
 *                         email:
 *                           type: string
 *                           example: "admin@gmail.com"
 *                     participants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: integer
 *                             example: 12
 *                           sharedExpenseId:
 *                             type: integer
 *                             example: 1
 *                           part:
 *                             type: number
 *                             example: 50.00
 *                           paymentStatus:
 *                             type: string
 *                             example: "PENDING"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get(
    '/:idExpense',
    authMiddleware, 
    //checkKYC,
    hasRole(['COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'TECHNICAL_DIRECTOR', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'CUSTOMER']),
    sharedExpenseController.getExpenseById
)

/**
 * @swagger
 * /shared-expense/{idExpense}/pay:
 *   post:
 *     summary: Payer une dépense partagée
 *     tags: [Dépenses Partagées]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: idExpense
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la dépense partagée à payer
 *     responses:
 *       200:
 *         description: Paiement de la dépense partagée effectué avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Paiement effectué avec succès
 *                 data:
 *                   type: object
 *                   description: Objet participant correspondant au paiement effectué
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 45
 *                       description: ID de la participation à la dépense
 *                     userId:
 *                       type: integer
 *                       example: 12
 *                       description: ID de l'utilisateur participant
 *                     sharedExpenseId:
 *                       type: integer
 *                       example: 7
 *                       description: ID de la dépense partagée
 *                     part:
 *                       type: number
 *                       format: float
 *                       example: 50.00
 *                       description: Montant de la part à payer par le participant
 *                     paymentStatus:
 *                       type: string
 *                       example: "PAID"
 *                       description: Statut du paiement (`PAID` `PENDING`)
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-05-26T14:00:00Z"
 *                       description: Date de création de la participation
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-05-26T15:00:00Z"
 *                       description: Date de la dernière mise à jour
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Dépense partagée ou participation non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/:idExpense/pay',
  authMiddleware,
  hasRole(['CUSTOMER']),
  checkKYC,
  verifyPasscode,
  sharedExpenseController.payExpense
);

/**
 * @swagger
 * /shared-expense/{idExpense}/close:
 *   delete:
 *     summary: Annuler et supprimer une dépense partagée
 *     tags: [Dépenses Partagées]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: idExpense
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la dépense partagée à annuler
 *     responses:
 *       200:
 *         description: Annulation de la dépense partagée effectuée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dépense partagée annulée avec succès
 *                 data:
 *                   type: object
 *                   description: Objet représentant le résultat de l'annulation de la dépense
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Dépense partagée non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete(
  '/:idExpense/close',
  authMiddleware, 
  verifyPasscode,
  hasRole(['CUSTOMER']),
  checkKYC,
  sharedExpenseController.deleteExpense
);

/**
 * @swagger
 * /shared-expense/admin/{idExpense}/close:
 *   delete:
 *     summary: Annuler et supprimer une dépense partagée côté ADMIN
 *     tags: [Dépenses Partagées]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idExpense
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la dépense partagée à annuler
 *     responses:
 *       200:
 *         description: Annulation de la dépense partagée effectuée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dépense partagée annulée avec succès
 *                 data:
 *                   type: object
 *                   description: Objet représentant le résultat de l'annulation de la dépense
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: Dépense partagée non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete(
  '/admin/:idExpense/close',
  authMiddleware,
  hasRole(['SUPER_ADMIN']),
  sharedExpenseController.deleteAdminExpense
);

/**
 * @swagger
 * /shared-expense/{userId}/list:
 *   get:
 *     summary: Récupérer toutes les dépenses crées par un utilisateur
 *     description: Récupérer toutes les dépenses crées par un utilisateur
 *     tags: [Dépenses Partagées]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
 *     responses:
 *       200:
 *         description: Liste des dépenses partagées récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Liste des dépenses partagées récupérée avec succès
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       totalAmount:
 *                         type: number
 *                         example: 150.00
 *                       description:
 *                         type: string
 *                         example: "Dîner entre amis"
 *                       userId:
 *                         type: integer
 *                         example: 8
 *                       initiatorPart:
 *                         type: number
 *                         example: 50.00
 *                       limitDate:
 *                         type: string
 *                         format: date
 *                         example: "2025-06-15"
 *                       status:
 *                         type: string
 *                         example: "PENDING"
 *       403:
 *         description: Accès refusé
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               status: 500
 *               message: "Une erreur est survenu"
 */
router.get(
  '/:userId/list',
  authMiddleware,
  hasRole(['CUSTOMER']),
  sharedExpenseController.getUserSharedExpenses
)

/**
 * @swagger
 * /shared-expense/users/{userId}:
 *   get:
 *     summary: Récupérer toutes les dépenses crées dont fait partie un utilisateur
 *     description: Récupérer toutes les dépenses crées dont fait partie un utilisateur
 *     tags: [Dépenses Partagées]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
 *     responses:
 *       200:
 *         description: Liste des dépenses partagées récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Liste des dépenses partagées récupérée avec succès
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       totalAmount:
 *                         type: number
 *                         example: 150.00
 *                       description:
 *                         type: string
 *                         example: "Dîner entre amis"
 *                       userId:
 *                         type: integer
 *                         example: 8
 *                       initiatorPart:
 *                         type: number
 *                         example: 50.00
 *                       limitDate:
 *                         type: string
 *                         format: date
 *                         example: "2025-06-15"
 *                       status:
 *                         type: string
 *                         example: "PENDING"
 *       403:
 *         description: Accès refusé
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               status: 500
 *               message: "Une erreur est survenu"
 */
router.get(
  '/users/:userId',
  authMiddleware, 
  hasRole(['CUSTOMER']),
  sharedExpenseController.getSharedExpenseIncludeMe
)

/**
 * @swagger
 * /shared-expense/{id}:
 *   put:
 *     summary: Modifier une dépense partagée existante
 *     tags: [Dépenses Partagées]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la dépense à modifier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               totalAmount:
 *                 type: number
 *                 example: 160.00
 *                 description: Nouveau montant total de la dépense (si modifié)
 *               description:
 *                 type: string
 *                 example: "Sortie au restaurant"
 *                 description: Nouvelle description de la dépense (si modifiée)
 *               participants:
 *                 type: array
 *                 description: Nouvelle liste des participants (remplace l'ancienne)
 *                 items:
 *                   type: object
 *                   required:
 *                     - matriculeWallet
 *                   properties:
 *                     matriculeWallet:
 *                       type: string
 *                       example: "SDO232553"
 *                       description: Matricule du portefeuille
 *                     amount:
 *                       type: number
 *                       example: 53.33
 *                       description: Montant attribué au participant (nécessaire si méthode 'manual')
 *               limitDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-07-01"
 *                 description: Nouvelle date limite pour le paiement (si modifiée)
 *               includeMyself:
 *                 type: boolean
 *                 example: false
 *                 description: L'initiateur participe-t-il à la dépense ? (si modifié)
 *               methodCalculatingShare:
 *                 type: string
 *                 enum: [auto, manual]
 *                 example: "manual"
 *                 description: Nouvelle méthode de calcul des parts (si modifiée)
 *     responses:
 *       200:
 *         description: Dépense partagée mise à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dépense partagée mise à jour avec succès
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     totalAmount:
 *                       type: number
 *                       example: 160.00
 *                     description:
 *                       type: string
 *                       example: "Sortie au restaurant"
 *                     userId:
 *                       type: integer
 *                       example: 8
 *                     initiatorPart:
 *                       type: number
 *                       example: 53.33
 *                     limitDate:
 *                       type: string
 *                       format: date
 *                       example: "2025-07-01"
 *                     status:
 *                       type: string
 *                       example: "COMPLETED"
 *                     initiator:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 8
 *                         firstname:
 *                           type: string
 *                           example: "John"
 *                         lastname:
 *                           type: string
 *                           example: "Doe"
 *                         phone:
 *                           type: string
 *                           example: "+1234567890"
 *                         email:
 *                           type: string
 *                           example: "admin@gmail.com"
 *                     participants:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: integer
 *                             example: 12
 *                           sharedExpenseId:
 *                             type: integer
 *                             example: 1
 *                           part:
 *                             type: number
 *                             example: 53.33
 *                           paymentStatus:
 *                             type: string
 *                             example: "PENDING"
 *       400:
 *         description: ID de dépense invalide
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: ID de dépense invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put(
  '/:id',
  authMiddleware, 
  checkKYC, 
  verifyPasscode, 
  hasRole(['CUSTOMER']),
  sharedExpenseController.updateExpense
)

/**
 * @swagger
 * /shared-expense/{id}/cancel:
 *   patch:
 *     summary: Annuler une dépense partagée en fournissant une raison
 *     description: Annuler une dépense partagée
 *     tags: [Dépenses Partagées]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la dépense à annuler
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cancelReason
 *             properties:
 *               cancelReason:
 *                 type: string
 *                 example: "Participant ne souhaite plus participer"
 *                 description: Raison de l'annulation de la dépense
 *     responses:
 *       200:
 *         description: Dépense annulée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Dépense annulée avec succès
 *       400:
 *         description: Requête invalide (ID invalide ou raison manquante)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Une raison d'annulation doit être fournie
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Dépense non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Dépense partagée introuvable
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch(
  '/:id/cancel',
  authMiddleware, 
  checkKYC,
  hasRole(['CUSTOMER', 'SUPER_ADMIN']),
  sharedExpenseController.cancelExpense
)

/**
 * @swagger
 * /shared-expense/{participantId}/refuse-payment:
 *   patch:
 *     summary: Refuser un paiement d'une demande
 *     description: Refuser un paiement d'une demande
 *     tags: [Dépenses Partagées]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: participantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du paiement à refuser
 *     responses:
 *       200:
 *         description: Paiement refusé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Paiement refusé avec succès
 *       400:
 *         description: Requête invalide (ID invalide)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: integer
 *                   example: ID introuvable
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Dépense non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Dépense partagée introuvable
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch(
  '/:participantId/refuse-payment',
  authMiddleware, 
  checkKYC,
  hasRole(['CUSTOMER']),
  sharedExpenseController.cancelPaymentExpense
)

/**
 * @swagger
 * /shared-expense/{id}/update-status:
 *   patch:
 *     summary: Modifier le status d'une dépense partagée
 *     description: Modifier le status d'une dépense partagée `PENDING` `COMPLETED`
 *     tags: [Dépenses Partagées]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la dépense à annuler
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 ENUM: [PENDING, COMPLETED]
 *     responses:
 *       200:
 *         description: Dépense annulée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Status dépense modifié avec succès
 *       400:
 *         description: Requête invalide (ID invalide ou raison manquante)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Une raison d'annulation doit être fournie
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Dépense non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Dépense partagée introuvable
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.patch(
  '/:id/update-status',
  authMiddleware,
  hasRole(['CUSTOMER', 'SUPER_ADMIN']),
  sharedExpenseController.updateStatusExpense
)

export default router;