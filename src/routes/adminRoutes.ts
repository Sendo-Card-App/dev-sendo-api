import { Router } from 'express';
import adminController from '@controllers/adminController';
import { hasRole } from '@middlewares/roleMiddleware';
import { authMiddleware } from '@middlewares/auth';
import { paginationMiddleware } from '@middlewares/pagination';
import statisticController from '@controllers/statisticController';
import userController from '@controllers/userController';

const router = Router();

/**
 * @swagger
 * /admin/kyc/list:
 *   get:
 *     summary: Récupérer tous les documents KYC
 *     description: Retourne tous les documents KYC
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: typeAccount
 *         required: true
 *         type: string
 *         enum: ['MERCHANT', 'CUSTOMER']
 *         default: 'CUSTOMER'
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
 *           enum: [PENDING, REJECTED, APPROVED]
 *     responses:
 *       200:
 *         description: Liste de tous les documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/KycDocument'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/kyc/list', 
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'COMPLIANCE_OFFICER', 'CARD_MANAGER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER']), 
    paginationMiddleware,
    adminController.getAllDocuments
);

/**
 * @swagger
 * /admin/kyc/{userId}/list:
 *   get:
 *     summary: Récupérer tous les documents KYC d'un utilisateur
 *     description: Retourne tous les documents KYC d'un utilisateur
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         type: integer
 *         default: 1
 *     responses:
 *       200:
 *         description: Liste de tous les documents d'un utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/KycDocument'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/kyc/:userId/list', 
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'COMPLIANCE_OFFICER', 'CARD_MANAGER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER']), 
    adminController.getDocumentsUser
);


/**
 * @swagger
 * /admin/kyc/pending:
 *   get:
 *     summary: Récupérer les documents KYC en attente
 *     description: |
 *       **Accès** : ADMIN ou VALIDATOR  
 *       Retourne tous les documents KYC avec le statut "PENDING"
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: typeAccount
 *         required: true
 *         type: string
 *         enum: ['MERCHANT', 'CUSTOMER']
 *         default: 'CUSTOMER'
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
 *     responses:
 *       200:
 *         description: Liste des documents en attente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/KycDocument'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/kyc/pending', 
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'COMPLIANCE_OFFICER', 'CARD_MANAGER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER']),  
    paginationMiddleware,
    adminController.getPendingDocuments
);

/**
 * @swagger
 * /admin/kyc/bulk-review:
 *   post:
 *     summary: Traitement groupé de documents KYC
 *     description: |
 *       **Accès** : ADMIN ou VALIDATOR  
 *       Permet d'approuver/rejeter plusieurs documents en une seule requête
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documents
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                     - status
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 123
 *                     status:
 *                       type: string
 *                       enum: [APPROVED, REJECTED]
 *                     rejectionReason:
 *                       type: string
 *                       example: "Document illisible"
 *     responses:
 *       200:
 *         description: Documents mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/KycDocument'
 *       400:
 *         description: |
 *           Erreurs possibles :  
 *           - Format des données invalide  
 *           - Documents introuvables
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/kyc/bulk-review', 
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'COMPLIANCE_OFFICER']),
    adminController.bulkReview
);

/**
 * @swagger
 * /admin/kyc/{id}/review:
 *   put:
 *     summary: Valider ou rejeter un document KYC
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du document KYC
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               rejectionReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Statut du document mis à jour
 *       403:
 *         description: Accès refusé
 */
router.put(
    '/kyc/:id/review', 
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'COMPLIANCE_OFFICER']), 
    adminController.reviewDocument
);

/**
 * @swagger
 * /admin/roles:
 *   post:
 *     summary: Créer un nouveau role
 *     description: |
 *       **Accès** : ADMIN  
 *       Permet de créer un nouveau role dans le système
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nouveau role créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: 
 *                   type: number
 *                 name:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/roles',
    authMiddleware, 
    hasRole(['SUPER_ADMIN']),
    adminController.createRole
)

/**
 * @swagger
 * /admin/roles/{id}:
 *   put:
 *     summary: Mettre à jour le nom d'un role
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du role
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role mis à jour
 *       403:
 *         description: Accès refusé
 */
router.put(
    '/roles/:id',
    authMiddleware, 
    hasRole(['SUPER_ADMIN']),
    adminController.updateRoleUser
)

/**
 * @swagger
 * /admin/roles:
 *   get:
 *     summary: Récupérer tous les roles du système
 *     description: |
 *       **Accès** : ADMIN ou VALIDATOR  
 *       Retourne tous les roles du système
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Roles récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/roles',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'COMPLIANCE_OFFICER', 'CARD_MANAGER', 'MANAGEMENT_CONTROLLER', 'CUSTOMER_ADVISER']),
    adminController.getRoles
)

/**
 * @swagger
 * /admin/users/attribute-role:
 *   put:
 *     summary: Mettre à jour le role d'un utilisateur
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               rolesId:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: User role mis à jour
 *       403:
 *         description: Accès refusé
 */
router.put(
    '/users/attribute-role',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN']),
    adminController.attributeRole
)

/**
 * @swagger
 * /admin/users/remove-role:
 *   delete:
 *     summary: Supprimer un role à un utilisateur
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               roleId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: User role supprimé
 *       403:
 *         description: Accès refusé
 */
router.delete(
    '/users/remove-role',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN']),
    adminController.removeRoleUser
)

/**
 * @swagger
 * /admin/users/change-status:
 *   put:
 *     summary: Changer le status d'un compte utilisateur
 *     description: Changer le status d'un compte utilisateur à partir de son email
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Email du compte.
 *       - in: query
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *         description: Status à assigner `ACTIVE`, `SUSPENDED`
 *     responses:
 *       '200':
 *         description: Success response with the new status of the user.
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example:
 *               status: 200
 *               message: Le status du compte a été mis à jour
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
router.put(
    '/users/change-status',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN']),
    adminController.updateStatusUser
)

/**
 * @swagger
 * /admin/users/merchant/change-status:
 *   put:
 *     summary: Changer le status d'un compte marchant à partir de son ID
 *     description: Changer le status d'un compte marchant à partir de son id
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du compte marchant.
 *       - in: query
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *         description: Status à assigner `ACTIVE`, `REFUSED`
 *     responses:
 *       '200':
 *         description: Success response with the new status of the user.
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example:
 *               status: 200
 *               message: Le status du compte a été mis à jour
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
router.put(
    '/users/merchant/change-status',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN']),
    userController.updateStatusMerchant
)

/**
 * @swagger
 * /admin/wallets/change-status:
 *   put:
 *     summary: Changer le status d'un portefeuille
 *     description: Changer le status d'un portefeuille à partir de son matricule
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: matriculeWallet
 *         schema:
 *           type: string
 *         description: Matricule du wallet.
 *       - in: query
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *         description: Status à assigner `ACTIVE`, `BLOCKED`
 *     responses:
 *       '200':
 *         description: Success response with the new role of the user.
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example:
 *               status: 200
 *               message: Le status du portefeuille a été mis à jour
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
router.put(
    '/wallets/change-status',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN']),
    adminController.updateStatusWallet
)

/**
 * @swagger
 * /admin/transaction/change-status:
 *   put:
 *     summary: Changer le status d'une transaction
 *     description: Changer le status d'une transaction effectuée qui nécessite une validation
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la transaction.
 *       - in: query
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *         description: Les différents status `PENDING` et `COMPLETED` et `FAILED` et `BLOCKED`
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transactionReference:
 *                 type: string
 *               bankName:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status de la transaction changé avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *             example:
 *               status: 200
 *               message: Le status de la transaction a été mis à jour
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
router.put(
    '/transaction/change-status',
    authMiddleware, 
    hasRole(['COMPLIANCE_OFFICER', 'SUPER_ADMIN']),
    adminController.changeStatusTransaction
)

/**
 * @swagger
 * /admin/statistics:
 *   get:
 *     summary: Récupérer toutes les statistiques du système
 *     description: |
 *       **Accès** : SUPER_ADMIN, SYSTEM_ADMIN ou TECHNICAL_DIRECTOR  
 *       Retourne toutes les statistiques du système, incluant utilisateurs, wallets, transactions, cartes virtuelles et demandes.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début pour filtrer les statistiques (inclus)
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin pour filtrer les statistiques (inclus)
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: object
 *                       description: Statistiques sur les utilisateurs
 *                       properties:
 *                         totalUsers:
 *                           type: integer
 *                           example: 1542
 *                         dailyRegistrations:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                                 format: date
 *                                 example: "2025-05-12"
 *                               count:
 *                                 type: integer
 *                                 example: 23
 *                         verification:
 *                           type: object
 *                           properties:
 *                             email:
 *                               type: integer
 *                               example: 1200
 *                             phone:
 *                               type: integer
 *                               example: 1100
 *                             kyc:
 *                               type: integer
 *                               example: 800
 *                         regions:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               region:
 *                                 type: string
 *                                 nullable: true
 *                                 example: "Littoral"
 *                               count:
 *                                 type: integer
 *                                 example: 542
 *                         statuses:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 example: "active"
 *                               count:
 *                                 type: integer
 *                                 example: 1300
 *                     wallets:
 *                       type: object
 *                       description: Statistiques sur les wallets
 *                       properties:
 *                         totalWallets:
 *                           type: integer
 *                           example: 1000
 *                         totalBalance:
 *                           type: number
 *                           format: float
 *                           example: 123456.78
 *                         averageBalance:
 *                           type: number
 *                           format: float
 *                           example: 123.45
 *                         topWallets:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               userId:
 *                                 type: integer
 *                                 example: 42
 *                               balance:
 *                                 type: number
 *                                 format: float
 *                                 example: 10000.00
 *                         currencyDistribution:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               currency:
 *                                 type: string
 *                                 example: "USD"
 *                               count:
 *                                 type: integer
 *                                 example: 500
 *                     transactions:
 *                       type: object
 *                       description: Statistiques sur les transactions
 *                       properties:
 *                         totalTransactions:
 *                           type: integer
 *                           example: 5000
 *                         totalAmount:
 *                           type: number
 *                           format: float
 *                           example: 250000.50
 *                         averageAmount:
 *                           type: number
 *                           format: float
 *                           example: 50.10
 *                         statusDistribution:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 example: "completed"
 *                               count:
 *                                 type: integer
 *                                 example: 4000
 *                         typeDistribution:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               type:
 *                                 type: string
 *                                 example: "deposit"
 *                               count:
 *                                 type: integer
 *                                 example: 3000
 *                         recentTransactions:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               transactionId:
 *                                 type: string
 *                                 example: "TX123456789"
 *                               amount:
 *                                 type: number
 *                                 format: float
 *                                 example: 100.00
 *                               currency:
 *                                 type: string
 *                                 example: "EUR"
 *                               type:
 *                                 type: string
 *                                 example: "withdrawal"
 *                               status:
 *                                 type: string
 *                                 example: "pending"
 *                               createdAt:
 *                                 type: string
 *                                 format: date-time
 *                                 example: "2025-05-19T00:00:00Z"
 *                     virtualCards:
 *                       type: object
 *                       description: Statistiques sur les cartes virtuelles
 *                       properties:
 *                         totalCards:
 *                           type: integer
 *                           example: 250
 *                         statusDistribution:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 example: "active"
 *                               count:
 *                                 type: integer
 *                                 example: 200
 *                         totalAmountTransactionsCard:
 *                           type: number
 *                           format: float
 *                           example: 1500.00
 *                         recentCards:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 123
 *                               cardNumber:
 *                                 type: string
 *                                 example: "1234********5678"
 *                               cardName:
 *                                 type: string
 *                                 example: "Ma Carte Virtuelle"
 *                               status:
 *                                 type: string
 *                                 example: "active"
 *                               createdAt:
 *                                 type: string
 *                                 format: date-time
 *                                 example: "2025-05-18T12:00:00Z"
 *                     requests:
 *                       type: object
 *                       description: Statistiques sur les demandes
 *                       properties:
 *                         totalRequests:
 *                           type: integer
 *                           example: 120
 *                         typeDistribution:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               type:
 *                                 type: string
 *                                 example: "demande_type_1"
 *                               count:
 *                                 type: integer
 *                                 example: 80
 *                         statusDistribution:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               status:
 *                                 type: string
 *                                 example: "pending"
 *                               count:
 *                                 type: integer
 *                                 example: 40
 *                         recentRequests:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 example: 1
 *                               type:
 *                                 type: string
 *                                 example: "demande_type_1"
 *                               status:
 *                                 type: string
 *                                 example: "pending"
 *                               description:
 *                                 type: string
 *                                 example: "Description de la demande"
 *                               userId:
 *                                 type: integer
 *                                 example: 10
 *                               reviewedById:
 *                                 type: integer
 *                                 nullable: true
 *                                 example: 5
 *                               createdAt:
 *                                 type: string
 *                                 format: date-time
 *                                 example: "2025-05-18T10:00:00Z"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/statistics',
    authMiddleware, 
    paginationMiddleware,
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER']),
    statisticController.getStatistics
)

/**
 * @swagger
 * /admin/commission:
 *   get:
 *     summary: Récupérer toutes les statistiques du système
 *     description: |
 *       **Accès** : SUPER_ADMIN, SYSTEM_ADMIN ou TECHNICAL_DIRECTOR  
 *       Retourne toutes les commisssions sur tout type de transaction.
 *     tags:
 *       - Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début pour filtrer les statistiques (inclus)
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin pour filtrer les statistiques (inclus)
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [DEPOSIT, WITHDRAWAL, TRANSFER, PAYMENT, WALLET_TO_WALLET, SHARED_PAYMENT, FUND_REQUEST_PAYMENT, TONTINE_PAYMENT]
 *         description: Type de la transaction
 *     responses:
 *       200:
 *         description: Commissions récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties: 
 *                     totalFees:
 *                       type: number
 *                     averageFees:
 *                       type: number
 *                       format: float
 *                     feesByType:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                           example: "DEPOSIT"
 *                         totalFees:
 *                           type: string
 *                         recentFees:
 *                           type: object
 *                           properties:
 *                             transactionId:
 *                               type: string
 *                             amount:
 *                               type: integer
 *                               format: float
 *                             sendoFees:
 *                               type: integer
 *                               format: float
 *                             type:
 *                               type: string
 *                               enum: [DEPOSIT, WITHDRAWAL, TRANSFER, PAYMENT, WALLET_TO_WALLET, SHARED_PAYMENT, FUND_REQUEST_PAYMENT, TONTINE_PAYMENT]
 *                             status:
 *                               type: string
 *                               enum: [PENDING, COMPLETED, FAILED, BLOCKED]
 *                             createdAt:
 *                               type: string
 *                               format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/commission',
    authMiddleware, 
    paginationMiddleware,
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER']),
    statisticController.getCommissionStatistics
)

export default router;