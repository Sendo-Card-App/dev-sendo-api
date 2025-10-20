// routes/tontine.routes.ts
import tontineController from '@controllers/tontineController';
import { authMiddleware } from '@middlewares/auth';
import { checkKYC } from '@middlewares/kycMiddleware';
import { paginationMiddleware } from '@middlewares/pagination';
import { verifyPasscode } from '@middlewares/passcode';
import { hasRole } from '@middlewares/roleMiddleware';
import express from 'express';

const router = express.Router();

/**
 * @swagger
 * /tontines:
 *   post:
 *     summary: Créer une nouvelle tontine
 *     description: Exemple de type `FIXE` `ALEATOIRE` frequence `DAILY` `WEEKLY` `MONTHLY` modeVersement `AUTOMATIC` `MANUAL`
 *     tags: [Tontines]
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
 *               - nom
 *               - type
 *               - frequence
 *               - montant
 *               - modeVersement
 *               - description
 *             properties:
 *               nom:
 *                 type: string
 *                 example: "Tontine du quartier"
 *                 description: Nom de la tontine
 *               type:
 *                 type: string
 *                 enum: [FIXE, ALEATOIRE]
 *                 example: "FIXE"
 *                 description: Type d'ordre de passage
 *               frequence:
 *                 type: string
 *                 enum: [DAILY, WEEKLY, MONTHLY]
 *                 example: "MONTHLY"
 *                 description: Fréquence des cotisations
 *               montant:
 *                 type: number
 *                 example: 10000
 *                 description: Montant de la cotisation par membre
 *               modeVersement:
 *                 type: string
 *                 enum: [AUTOMATIC, MANUAL]
 *                 example: "MANUAL"
 *                 description: Mode de versement des fonds
 *               description:
 *                 type: string
 *                 required: false
 *     responses:
 *       201:
 *         description: Tontine créée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tontine'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/', 
    authMiddleware, 
    verifyPasscode, 
    checkKYC, 
    hasRole(['CUSTOMER']), 
    tontineController.create
);

 /** 
 * @swagger
 * /tontines/{tontineId}/members:
 *   post:
 *     summary: Ajouter un membre à une tontine
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la tontine
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 5
 *                 description: Identifiant de l'utilisateur à ajouter
 *     responses:
 *       200:
 *         description: Membre ajouté avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tontine:
 *                   $ref: '#/components/schemas/Tontine'
 *                 membre:
 *                   $ref: '#/components/schemas/Membre'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Tontine non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/:tontineId/members',
    authMiddleware, 
    verifyPasscode, 
    checkKYC, 
    hasRole(['CUSTOMER']),
    tontineController.addMember
);

 /** 
 * @swagger
 * /tontines/access-or-reject:
 *   post:
 *     summary: Accéder à ou rejecter une tontine
 *     description: Les valeurs du type à envoyer `JOIN` `REJECT`
 *     tags: [Tontines]
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
 *               - membreId
 *               - type
 *             properties:
 *               invitationCode:
 *                 type: string
 *                 example: DDZD32
 *                 description: Code d'invitation de la tontine
 *               membreId:
 *                 type: number
 *                 example: 2
 *                 description: ID du membre de la tontine
 *               type:
 *                 type: string
 *                 format: ENUM[JOIN, REJECT]
 *                 example: JOIN
 *     responses:
 *       200:
 *         description: Vous faites partie de la tontine désormais
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tontine:
 *                   $ref: '#/components/schemas/Tontine'
 *                 membre:
 *                   $ref: '#/components/schemas/Membre'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Tontine non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/access-or-reject',
    authMiddleware, 
    verifyPasscode, 
    checkKYC, 
    hasRole(['CUSTOMER']),
    tontineController.accederTontine
);

 /**
 * @swagger 
 * /tontines/{tontineId}/contribute:
 *   post:
 *     summary: Payer une cotisation pour une tontine
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la tontine
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cotisationId
 *               - membreId
 *             properties:
 *               membreId:
 *                 type: number
 *                 example: 1
 *                 description: Id du membre de la tontine
 *               cotisationId:
 *                 type: number
 *                 example: 1
 *                 description: ID de la cotisation à payer
 *     responses:
 *       200:
 *         description: Cotisation payée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cotisation'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Tontine ou membre non trouvé
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
    '/:tontineId/contribute', 
    authMiddleware, 
    verifyPasscode, 
    checkKYC, 
    hasRole(['CUSTOMER']),
    tontineController.contribute
);

 /** 
 * @swagger
 * /tontines/{tontineId}/distribute:
 *   put:
 *     summary: Déclencher la distribution de la cagnotte pour un tour
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la tontine
 *     responses:
 *       200:
 *         description: Distribution effectuée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 beneficiaire:
 *                   $ref: '#/components/schemas/Membre'
 *                 montantDistribue:
 *                   type: number
 *                   example: 100000
 *       400:
 *         description: Conditions non remplies ou requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Tontine non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put(
    '/:tontineId/distribute', 
    authMiddleware, 
    hasRole(['CUSTOMER']),
    verifyPasscode,
    tontineController.distribute
);

/**
 * @swagger
 * /tontines/{tontineId}/ordre-rotation:
 *   post:
 *     summary: Modifier l'ordre de passage (ordre de rotation) d'une tontine
 *     description: Si le type est `FIXE` fournit le tableau ordreRotation si le type est `ALEATOIRE` ne rien fournir dans le body
 *     tags:
 *       - Tontines
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identifiant de la tontine à modifier
 *     requestBody:
 *       description: Nouvel ordre de rotation sous forme de tableau d'IDs de membres
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ordreRotation:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [5, 3, 7, 2]
 *                 description: Liste ordonnée des IDs des membres définissant l'ordre de passage
 *     responses:
 *       200:
 *         description: Ordre de rotation mis à jour avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tontine'
 *       400:
 *         description: Requête invalide (ex - ordreRotation manquant ou type 'vote')
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "L'ordre de rotation n'est pas modifiable pour le type 'vote'"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Tontine non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Tontine non trouvée"
 *       500:
 *         description: Erreur serveur
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Erreur interne"
 */
router.post(
    '/:tontineId/ordre-rotation', 
    authMiddleware, 
    hasRole(['CUSTOMER']),
    tontineController.updateOrdreRotation
);

 /** 
 * @swagger
 * /tontines/list:
 *   get:
 *     summary: Récupérer toutes les tontines du système `ADMIN SENDO`
 *     tags: [Tontines]
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
 *     responses:
 *       200:
 *         description: Tontines récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tontine:
 *                   $ref: '#/components/schemas/Tontine'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Tontine non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/list',
    authMiddleware, 
    paginationMiddleware, 
    hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
    tontineController.getAllTontines
)

 /** 
 * @swagger
 * /tontines/penalites:
 *   get:
 *     summary: Récupérer toutes les pénalités du système avec des filtres
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tontineId
 *         required: false
 *         schema:
 *           type: integer
 *         description: ID de la tontine
 *       - in: query
 *         name: membreId
 *         required: false
 *         schema:
 *           type: integer
 *         description: ID du membre de la tontine
 *       - in: query
 *         name: statut
 *         required: false
 *         schema:
 *           type: string
 *           ENUM: [PAID, UNPAID]
 *         description: Statut du paiement de la pénalité
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           ENUM: [RETARD, ABSENCE, AUTRE]
 *         description: Type de la pénalité
 *     responses:
 *       200:
 *         description: Pénalités récupérées avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Penalite'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Cotisations non trouvées
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/penalites',
    authMiddleware, 
    tontineController.getPenalitesTontine
)

 /** 
 * @swagger
 * /tontines/{tontineId}:
 *   get:
 *     summary: Récupérer une tontine avec toutes ses informations
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la tontine
 *     responses:
 *       200:
 *         description: Tontine récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tontine:
 *                   $ref: '#/components/schemas/Tontine'
 *                 membre:
 *                   $ref: '#/components/schemas/Membre'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Tontine non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/:tontineId',
    authMiddleware, 
    tontineController.getTontine
)

 /** 
 * @swagger
 * /tontines/{tontineId}/tours-distribution:
 *   get:
 *     summary: Récupérer les tours de distribution d'une tontine
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la tontine
 *     responses:
 *       200:
 *         description: Tours de distributions récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Tontine non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/:tontineId/tours-distribution',
    authMiddleware, 
    tontineController.getTourDistributionsTontine
)

 /** 
 * @swagger
 * /tontines/{tontineId}/tours:
 *   get:
 *     summary: Récupérer les tours de distribution d'un membre dans une tontine
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la tontine
 *       - in: query
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *           default: 1
 *         description: ID du membre de la tontine
 *     responses:
 *       200:
 *         description: Tours de distributions récupéré avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Tontine non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/:tontineId/tours',
    authMiddleware, 
    tontineController.getTourDistributionsTontineUser
)

 /** 
 * @swagger
 * /tontines/users/{userId}:
 *   get:
 *     summary: Récupérer toutes les tontines dont fait partie un utilisateur
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur
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
 *     responses:
 *       200:
 *         description: Tontines récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tontine:
 *                   $ref: '#/components/schemas/Tontine'
 *                 membre:
 *                   $ref: '#/components/schemas/Membre'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Tontine non trouvée
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/users/:userId',
    authMiddleware, 
    paginationMiddleware,
    tontineController.getTontinesUser
)

/**
 * @swagger
 * /tontines/{tontineId}/penalites:
 *   post:
 *     summary: Appliquer une pénalité à un membre. type `RETARD` `ABSENCE` `AUTRE`
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - membreId
 *               - montant
 *               - type
 *             properties:
 *               membreId:
 *                 type: integer
 *               montant:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [RETARD, ABSENCE, AUTRE]
 *               cotisationId:
 *                 type: integer
 *                 required: false
 *               description:
 *                 type: string
 *                 required: false
 *     responses:
 *       201:
 *         description: Pénalité appliquée avec succès
 *       400:
 *         description: Données invalides
 */
router.post(
    '/:tontineId/penalites', 
    authMiddleware, 
    hasRole(['CUSTOMER']), 
    verifyPasscode,
    tontineController.appliquerPenalite
);

/**
 * @swagger
 * /tontines/{tontineId}/membres/{membreId}/penalites:
 *   get:
 *     summary: Récupérer les pénalités d'un membre dans une tontine
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: membreId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Liste des pénalités
 *       404:
 *         description: Pénalités introuvables
 */
router.get(
    '/:tontineId/membres/:membreId/penalites', 
    authMiddleware, 
    tontineController.getPenalitesMembre
);

/**
 * @swagger
 * /tontines/penalites/{penaliteId}/pay:
 *   put:
 *     summary: Payer une pénalité
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: penaliteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pénalité payée avec succès
 *       404:
 *         description: Pénalité introuvable
 */
router.put(
    '/penalites/:penaliteId/pay', 
    authMiddleware, 
    hasRole(['CUSTOMER']),
    verifyPasscode,
    tontineController.payerPenalite
);

/**
 * @swagger
 * /tontines/{tontineId}/change-status:
 *   put:
 *     summary: Changer l'état d'une tontine `ADMIN TONTINE`
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
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
 *                 enum: [SUSPENDED, ACTIVE, CLOSED]
 *     responses:
 *       200:
 *         description: Status de la tontine modifiée avec succès
 *       404:
 *         description: Tontine introuvable
 */
router.put(
    '/:tontineId/change-status',
    authMiddleware, 
    hasRole(['CUSTOMER']), 
    verifyPasscode,
    tontineController.updateStatusTontine
)

/**
 * @swagger
 * /tontines/{tontineId}/admin/change-status:
 *   put:
 *     summary: Changer l'état d'une tontine `ADMIN SENDO`
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
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
 *                 enum: [SUSPENDED, ACTIVE, CLOSED]
 *     responses:
 *       200:
 *         description: Status de la tontine modifiée avec succès
 *       404:
 *         description: Tontine introuvable
 */
router.put(
    '/:tontineId/admin/change-status',
    authMiddleware, 
    hasRole(['COMPLIANCE_OFFICER', 'SUPER_ADMIN']),
    tontineController.updateStatusTontineAdmin
)

 /** 
 * @swagger
 * /tontines/{tontineId}/cotisations:
 *   get:
 *     summary: Récupérer toutes les cotisations d'une tontine
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
 *           default: 1
 *         description: ID de la tontine
 *       - in: query
 *         name: membreId
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: ID du membre de la tontine
 *       - in: query
 *         name: statutPaiement
 *         required: false
 *         schema:
 *           type: string
 *           ENUM: [VALIDATED, PENDING, REJECTED]
 *           default: 'VALIDATED'
 *         description: Statut du paiement de la cotisation
 *     responses:
 *       200:
 *         description: Cotisations récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Cotisation'
 *       400:
 *         description: Requête invalide
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Cotisations non trouvées
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
    '/:tontineId/cotisations',
    authMiddleware, 
    tontineController.getCotisationsTontine
)

/**
 * @swagger
 * /tontines/cotisation/{cotisationId}/relance:
 *   post:
 *     summary: Relancer un membre pour sa cotisation
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cotisationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Relance envoyée avec succès
 *       404:
 *         description: Membre ou tontine introuvable
 *       500:
 *         description: Erreur serveur
 */
router.post(
  '/cotisation/:cotisationId/relance', 
  authMiddleware, 
  tontineController.relancerMembre
);

/**
 * @swagger
 * /tontines/{tontineId}/account/deposit:
 *   post:
 *     summary: Créditer le compte séquestre d'une tontine
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Dépôt effectué avec succès
 *       404:
 *         description: Compte séquestre introuvable
 *       500:
 *         description: Erreur serveur
 */
router.post(
  '/:tontineId/account/deposit', 
  authMiddleware, 
  hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER']),
  tontineController.depositAccountSequestre
);

/**
 * @swagger
 * /tontines/{tontineId}/account/withdrawal:
 *   post:
 *     summary: Débiter le compte séquestre d'une tontine
 *     tags: [Tontines]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tontineId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Retrait effectué avec succès
 *       404:
 *         description: Compte séquestre introuvable
 *       500:
 *         description: Erreur serveur
 */
router.post(
  '/:tontineId/account/withdrawal', 
  authMiddleware, 
  hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'MANAGEMENT_CONTROLLER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CARD_MANAGER']),
  tontineController.withdrawalAccountSequestre
);

 /** 
 * @swagger
 * components:
 *   schemas:
 *     Tontine:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         nom:
 *           type: string
 *           example: "Tontine du quartier"
 *         type:
 *           type: string
 *           example: "FIXE"
 *         frequence:
 *           type: string
 *           example: "MONTHLY"
 *         montant:
 *           type: number
 *           example: 10000
 *         nombreMembres:
 *           type: integer
 *           example: 12
 *         etat:
 *           type: string
 *           example: "ACTIVE"
 *     Membre:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 3
 *         userId:
 *           type: integer
 *           example: 5
 *         role:
 *           type: string
 *           example: "MEMBER"
 *         etat:
 *           type: string
 *           example: "ACTIVE"
 *         dateInscription:
 *           type: string
 *           format: date-time
 *           example: "2025-06-01T10:30:00Z"
 *     Cotisation:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 8
 *         membreId:
 *           type: integer
 *           example: 3
 *         tontineId:
 *           type: integer
 *           example: 1
 *         montant:
 *           type: number
 *           example: 10000
 *         methodePaiement:
 *           type: string
 *           example: "WALLET"
 *         statutPaiement:
 *           type: string
 *           example: "VALIDATED"
 *         dateCotisation:
 *           type: string
 *           format: date-time
 *           example: "2025-06-01T10:30:00Z"
 */

export default router;