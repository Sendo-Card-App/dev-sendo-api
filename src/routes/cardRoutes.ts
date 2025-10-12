import { checkKYC } from "@middlewares/kycMiddleware";
import cardController from "../controllers/cardController";
import { authMiddleware } from "../middlewares/auth";
import { checkCountry, hasRole } from "../middlewares/roleMiddleware";
import { Router } from "express";
import { paginationMiddleware } from "@middlewares/pagination";
import { verifyPasscode } from "@middlewares/passcode";

const router = Router();

/**
 * @swagger
 * /cards/required-docs:
 *   get:
 *     summary: Récupérer la liste des documents requis 
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Documents requis
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/required-docs',
    authMiddleware,
    cardController.getRequiredDocuments
)

/**
 * @swagger
 * /cards/onboarding/send-request:
 *   post:
 *     summary: Envoyer une demande de vérification des documents pour création de carte carte virtuelle
 *     tags: [Virtual Cards]
 *     description: documentType `NATIONALID` `RECEIPT` `PASSPORT`
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documentType:
 *                 type: string
 *                 enum: [NATIONALID, RECEIPT, PASSPORT]
 *                 description: Type de document
 *     responses:
 *       201:
 *         description: Demande envoyée, vérification en attente
 */
router.post(
    '/onboarding/send-request',
    authMiddleware,
    checkKYC,
    hasRole(['CUSTOMER']),
    checkCountry(['Cameroon']),
    cardController.askCreatingCard
)

/**
 * @swagger
 * /cards/onboarding/requests/admin:
 *   get:
 *     summary: Récupérer côté ADMIN toutes les demandes de vérification de documents pour création de CV
 *     tags: [Virtual Cards]
 *     description: Les différents status `WAITING_FOR_INFORMATION` `UNDER_VERIFICATION` `INIT` `VERIFIED` `REFUSED` `REFUSED_TIMEOUT`
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [WAITING_FOR_INFORMATION, UNDER_VERIFICATION, INIT, VERIFIED, REFUSED, REFUSED_TIMEOUT]
 *     responses:
 *       200:
 *         description: Demandes récupérées
 */
router.get(
    '/onboarding/requests/admin',
    authMiddleware, 
    paginationMiddleware,
    hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
    cardController.getRequestsCreatingCard
)

/**
 * @swagger
 * /cards/onboarding/requests/user:
 *   get:
 *     summary: Récupérer côté MOBILE la demande de vérification de documents pour création de CV
 *     tags: [Virtual Cards]
 *     description: Récupérer côté MOBILE la demande de vérification de documents pour création de CV
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Demande récupérée
 */
router.get(
    '/onboarding/requests/user',
    authMiddleware,
    hasRole(['CUSTOMER']),
    cardController.getRequestCreatingCardUser
)

/**
 * @swagger
 * /cards/onboarding/admin/send-docs:
 *   post:
 *     summary: Envoyer les documents à Neero pour validation, documentType `ID_PROOF` `ADDRESS_PROOF` `SELFIE`
 *     tags: [Virtual Cards]
 *     description: Envoyer les documents à Neero pour validation, documentType `ID_PROOF` `ADDRESS_PROOF` `SELFIE`
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documentType:
 *                 type: string
 *                 enum: [ID_PROOF, ADDRESS_PROOF, SELFIE]
 *                 description: Type de document
 *               userId:
 *                 type: number
 *                 description: ID de l'utilisateur
 *     responses:
 *       200:
 *         description: Documents envoyés
 */
router.post(
    '/onboarding/admin/send-docs',
    authMiddleware,
    //checkKYC,
    hasRole(['CARD_MANAGER', 'SUPER_ADMIN', 'CUSTOMER_ADVISER']),
    cardController.uploadDocuments
)

/**
 * @swagger
 * /cards/onboarding/admin/submit:
 *   post:
 *     summary: Déclencher la validation des documents côté Neero
 *     tags: [Virtual Cards]
 *     description: Déclencher la validation des documents côté Neero
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
 *                 type: number
 *                 description: ID de l'utilisateur
 *     responses:
 *       200:
 *         description: Documents envoyés
 */
router.post(
    '/onboarding/admin/submit',
    authMiddleware,
    hasRole(['CARD_MANAGER', 'SUPER_ADMIN', 'CUSTOMER_ADVISER']),
    cardController.submitRequestOnboarding
)

 /**
  * @swagger
  * /cards:
  *   post:
  *     summary: Crée une nouvelle carte virtuelle
  *     tags: [Virtual Cards]
  *     description: Crée une nouvelle carte virtuelle pour un utilisateur
  *     security:
  *       - BearerAuth: []
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
  *       201:
  *         description: Carte virtuelle créée
  */
router.post(
    '/',
    authMiddleware, 
    checkKYC,
    hasRole(['CUSTOMER']), 
    checkCountry(['Cameroon']),
    cardController.createCard
)

/**
 * @swagger
 * /cards/admin:
 *   get:
 *     summary: Récupère la liste paginée de toutes les cartes virtuelles des utilisateurs
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
 *           enum: [PRE_ACTIVE, ACTIVE, FROZEN, TERMINATED, IN_TERMINATION, SUSPENDED] 
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des cartes virtuelles retournée
 */
router.get(
    '/admin',
    authMiddleware,
    paginationMiddleware,
    hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
    cardController.getAllVirtualCards
)

/**
 * @swagger
 * /cards/user:
 *   get:
 *     summary: Récupère la liste des cartes virtuelles d'un utilisateur connectée
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des cartes virtuelles retournée
 */
router.get(
    '/user',
    authMiddleware,
    hasRole(['CUSTOMER']),
    cardController.getVirtualCardsUser
)

/**
 * @swagger
 * /cards/balance:
 *   get:
 *     summary: Récupérer le solde d'un objet (carte ou portefeuille Sendo Neero)
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: idCard
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: ID de la carte
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [MERCHANT]
 *           default: MERCHANT
 *         description: Type de l'objet (MERCHANT s'il s'agit du wallet Sendo chez Neero)
 *     responses:
 *       200:
 *         description: Solde de l'objet récupéré avec succès
 */
router.get(
    '/balance',
    authMiddleware,
    paginationMiddleware,
    cardController.getBalanceObject
)


/**
 * @swagger
 * /cards/{cardId}:
 *   get:
 *     summary: Récupère les détails d'une carte virtuelle
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         type: number
 *         default: 123
 *     responses:
 *       200:
 *         description: Détails de la carte virtuelle récupérés
 */
router.get(
    '/:cardId',
    authMiddleware,
    cardController.viewDetailsVirtualCard
)

/**
 * @swagger
 * /cards/freeze/{cardId}:
 *   put:
 *     summary: Bloquer une carte virtuelle
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         type: number
 *         default: 123
 *     responses:
 *       200:
 *         description: Carte virtuelle bloquée avec succès
 */
router.put(
    '/freeze/:cardId',
    authMiddleware,
    hasRole(['CUSTOMER']),
    checkCountry(['Cameroon']),
    cardController.bloquerVirtualCard
)

/**
 * @swagger
 * /cards/unfreeze/{cardId}:
 *   put:
 *     summary: Débloquer une carte virtuelle
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         type: number
 *         default: 123
 *     responses:
 *       200:
 *         description: Carte virtuelle débloquée avec succès
 */
router.put(
    '/unfreeze/:cardId',
    authMiddleware,
    hasRole(['CUSTOMER']),
    checkCountry(['Cameroon']),
    cardController.debloquerVirtualCard
)

/**
 * @swagger
 * /cards/deposit:
 *   post:
 *     summary: Recharger une carte virtuelle
 *     tags: [Virtual Cards]
 *     description: Recharger une carte virtuelle
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
 *               matriculeWallet:
 *                 type: number
 *               amount:
 *                 type: number
 *               idCard:
 *                 type: number
 *     responses:
 *       200:
 *         description: Carte virtuelle rechargée avec succès
 */
router.post(
    '/deposit',
    authMiddleware,
    verifyPasscode,
    hasRole(['CUSTOMER']),
    checkCountry(['Cameroon']),
    cardController.rechargerCarte
)

/**
 * @swagger
 * /cards/withdrawal:
 *   post:
 *     summary: Débiter une carte virtuelle
 *     tags: [Virtual Cards]
 *     description: Débiter une carte virtuelle
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
 *               matriculeWallet:
 *                 type: number
 *               amount:
 *                 type: number
 *               idCard:
 *                 type: number
 *     responses:
 *       200:
 *         description: Carte virtuelle débitée avec succès
 */
router.post(
    '/withdrawal',
    authMiddleware,
    verifyPasscode,
    hasRole(['CUSTOMER']),
    checkCountry(['Cameroon']),
    cardController.debiterCarte
)

/**
 * @swagger
 * /cards/{idCard}/transactions:
 *   get:
 *     summary: Récupérer les transactions d'une carte
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idCard
 *         required: true
 *         type: number
 *         default: 1
 *     responses:
 *       200:
 *         description: Transactions de la carte récupérées avec succès
 */
router.get(
    '/:idCard/transactions',
    authMiddleware,
    paginationMiddleware,
    cardController.transactionsNeeroCard
)

/**
 * @swagger
 * /cards/{cardId}:
 *   delete:
 *     summary: Supprimer une carte virtuelle
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         type: integer
 *         default: 123
 *     responses:
 *       204:
 *         description: Carte virtuelle supprimée avec succès
 */
router.delete(
    '/:cardId',
    authMiddleware,
    hasRole(['CUSTOMER']),
    checkCountry(['Cameroon']),
    cardController.deleteVirtualCard
)

/**
 * @swagger
 * /cards/vider/{cardId}:
 *   post:
 *     summary: Vider une carte virtuelle
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         type: integer
 *         default: 123
 *     responses:
 *       200:
 *         description: Carte virtuelle vidée avec succès
 */
router.post(
    '/vider/:cardId',
    authMiddleware,
    hasRole(['CUSTOMER']),
    checkCountry(['Cameroon']),
    cardController.viderVirtualCard
)

/**
 * @swagger
 * /cards/details/{cardId}:
 *   get:
 *     summary: Récupère les détails cachés d'une carte virtuelle
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         type: number
 *         default: 123
 *     responses:
 *       200:
 *         description: Détails de la carte virtuelle récupérés
 */
router.get(
    '/details/:cardId',
    authMiddleware,
    cardController.viewDetailCard
)

/**
 * @swagger
 * /cards/admin/{cardId}/status:
 *   put:
 *     summary: Bloquer ou débloquer côté ADMIN une carte virtuelle
 *     description: Permet de bloquer ou débloquer une carte virtuelle côté ADMIN `FREEZE` pour bloquer, `UNFREEZE` pour débloquer
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         type: number
 *         default: 123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [FREEZE, UNFREEZE]
 *     responses:
 *       200:
 *         description: Carte virtuelle bloquée ou débloquée avec succès
 */
router.put(
    '/admin/:cardId/status',
    authMiddleware,
    hasRole(['CARD_MANAGER', 'SUPER_ADMIN']),
    cardController.bloquerDebloquerAdminVirtualCard
)

/**
 * @swagger
 * /cards/{idCard}/debts:
 *   get:
 *     summary: Récupérer les dettes sur une carte virtuelle
 *     description: Récupérer les dettes sur une carte virtuelle
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idCard
 *         required: true
 *         type: number
 *         default: 1
 *     responses:
 *       200:
 *         description: Dettes récupérées avec succès
 */
router.get(
    '/:idCard/debts',
    authMiddleware,
    cardController.getDebtsCard
)

/**
 * @swagger
 * /cards/{cardId}/unlock:
 *   put:
 *     summary: Débloquer une carte virtuelle  qui a atteint la limite de paiements réjetés
 *     description: Débloquer une carte virtuelle  qui a atteint la limite de paiements réjetés
 *     tags: [Virtual Cards]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cardId
 *         required: true
 *         type: number
 *         default: 123
 *     responses:
 *       200:
 *         description: Carte virtuelle débloquée avec succès
 */
router.put(
    '/:cardId/unlock',
    authMiddleware,
    hasRole(['CUSTOMER']),
    checkCountry(['Cameroon']),
    cardController.debloquerVirtualCardBloque
)

export default router;