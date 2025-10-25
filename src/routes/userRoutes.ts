import express from 'express';
import userController from '@controllers/userController';
import { validateUser } from '@middlewares/validators/validateUser';
import { paginationMiddleware } from '@middlewares/pagination';
import { authMiddleware } from '@middlewares/auth';
import { hasRole } from '@middlewares/roleMiddleware';
import { checkKYC, filePictureCheck } from '@middlewares/kycMiddleware';
import OTPController from '@controllers/OTPController';
import { upload_picture } from '@config/cloudinary';
import { checkNumberConnexionFailure, verifyPasscode } from '@middlewares/passcode';

const router = express.Router();

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Crée un nouvel utilisateur
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstname:
 *                 type: string
 *               lastname:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               country:
 *                 type: string
 *               address:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *               placeOfBirth:
 *                 type: string 
 *               roleId:
 *                 type: integer
 *               typeMerchantAccount:
 *                 type: string
 *                 enum: ['Particulier', 'Entreprise']
 *                 required: false
 *     responses:
 *       201:
 *         description: Utilisateur créé
 */
router.post(
    '/', 
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']), 
    userController.createUser
);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Liste tous les utilisateurs
 *     parameters:
 *       - in: query
 *         name: country
 *         required: false
 *         type: string
 *         default: "Cameroon"
 *       - in: query
 *         name: search
 *         required: false
 *         type: string
 *         default: "John Doe"
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
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs
 */
router.get(
    '/', 
    paginationMiddleware, 
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'CUSTOMER_ADVISER', 'COMPLIANCE_OFFICER', 'MANAGEMENT_CONTROLLER', 'CARD_MANAGER', 'MERCHANT']),
    userController.getUsers
);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Récupérer tout ce qui concerne un utilisateur connecté sur la plateforme
 *     description: Récupère un utilisateur de la base de données
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Utilisateur récupéré
 *       404:
 *         description: Utilisateur non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Erreur serveur
 */
router.get(
    '/me', 
    authMiddleware, 
    userController.getUser
);

/**
 * @swagger
 * /users/merchants:
 *   get:
 *     summary: Liste de tous les marchants (agents)
 *     parameters:
 *       - in: query
 *         name: code
 *         required: false
 *         type: string
 *         default: "SDM563152"
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [PENDING, ACTIVE, REFUSED]
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
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste de tous les marchants (agents) récupérée avec succès
 *         content:
 *           application/json:
 *            schema:
 *              type: object
 */
router.get(
    '/merchants',
    authMiddleware,
    paginationMiddleware,
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'CUSTOMER_ADVISER', 'COMPLIANCE_OFFICER', 'MANAGEMENT_CONTROLLER', 'CARD_MANAGER']),
    userController.getMerchants
)

/**
 * @swagger
 * /users/merchant/{id}:
 *   get:
 *     summary: Récupérer les données d'un marchant par son ID
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         $ref: '#/components/responses/User'
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get(
    '/merchant/:id',
    authMiddleware,
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'CUSTOMER_ADVISER', 'COMPLIANCE_OFFICER', 'MANAGEMENT_CONTROLLER', 'CARD_MANAGER']),
    userController.getMerchantById
)

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Récupérer les données d'un utilisateur
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         $ref: '#/components/responses/User'
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get(
    '/:id',
    authMiddleware,
    userController.getUserById
)

/**
 * @swagger
 * /users/{id}/picture:
 *   get:
 *     summary: Récupérer la photo de profil d'un utilisateur
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         $ref: '#/components/responses/User'
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.get(
    '/:id/picture',
    authMiddleware,
    userController.getPictureUser
)

// /**
//  * @swagger
//  * /users/{id}:
//  *   delete:
//  *     summary: Supprimer un utilisateur par son ID
//  *     description: Supprime définitivement un utilisateur de la base de données
//  *     tags: [Users]
//  *     security:
//  *       - BearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: integer
//  *           format: int64
//  *         description: ID unique de l'utilisateur
//  *     responses:
//  *       204:
//  *         description: Utilisateur supprimé avec succès
//  *       404:
//  *         description: Utilisateur non trouvé
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 message:
//  *                   type: string
//  *       500:
//  *         description: Erreur serveur
//  */
// router.delete(
//     '/:id', 
//     authMiddleware, hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR']),
//     userController.deleteUser
// );


/**
 * @swagger
 * /users/update-passcode:
 *   put:
 *     summary: Modifier le passcode de l'utilisateur
 *     description: Modifier dans le système le passcode de l'utilisateur connecté
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               passcode:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Passcode modifié avec succès
 *       400:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur lors de l'enregistrement
 */
router.put(
    '/update-passcode',
    authMiddleware, 
    hasRole(['CUSTOMER']),
    userController.updatePasscodeUser
)


/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Mettre à jour les données d'un utilisateur
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 firstname:
 *                   type: string
 *                 lastname:
 *                   type: string
 *                 address:
 *                   type: string
 *                 profession:
 *                   type: string
 *                 region:
 *                   type: string 
 *                 city:
 *                   type: string
 *                 district:
 *                   type: string
 *     responses:
 *       200:
 *         $ref: '#/components/responses/User'
 *       404:
 *         description: Utilisateur non trouvé
 *       500:
 *         description: Erreur serveur
 */
router.put(
    '/:id', 
    authMiddleware, 
    verifyPasscode, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'CUSTOMER']),
    userController.updateUser
);

/**
 * @swagger
 * /users/update-password/{id}:
 *   put:
 *     summary: Mettre à jour le mot de passe d'un utilisateur
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *       - PasscodeAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mot de passe de l'utilisateur mis à jour
 *       404:
 *         description: Utilisateur non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Erreur serveur
 */
router.put(
    '/update-password/:id', 
    authMiddleware, 
    hasRole(['CUSTOMER']), 
    verifyPasscode,
    userController.updatePassword
);

/**
 * @swagger
 * /users/second-phone:
 *   post:
 *     summary: Ajouter un second numéro de téléphone au profil
 *     tags: [Users]
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
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Second numéro de téléphone ajouté
 *       404:
 *         description: Utilisateur non trouvé
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Erreur serveur
 */
router.post(
    '/second-phone',
    authMiddleware, 
    hasRole(['CUSTOMER']), 
    checkKYC, 
    verifyPasscode,
    userController.addSecondPhoneNumberUser
)

/**
 * @swagger
 * /users/second-phone/send-otp-code:
 *   post:
 *     summary: Envoie un OTP par SMS via Twilio
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+33612345678"
 *     responses:
 *       200:
 *         description: OTP envoyé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *       500:
 *         description: Erreur lors de l’envoi de l’OTP
 */
router.post(
    '/second-phone/send-otp-code',
    authMiddleware, 
    hasRole(['CUSTOMER']),
    OTPController.sendOTPSecondPhone
)

/**
 * @swagger
 * /users/second-phone/verify:
 *   post:
 *     summary: Vérifie un OTP reçu par SMS
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - code
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+237675123456"
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Vérification réussie ou échouée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       500:
 *         description: Erreur lors de la vérification de l’OTP
 *       404:
 *         description: Code introuvable ou vous avez mis trop de temps à le saisir
 */
router.post(
    '/second-phone/verify',
    authMiddleware, 
    hasRole(['CUSTOMER']),
    OTPController.verifyOTPSecondPhone
)

/**
 * @swagger
 * /users/send-picture:
 *   post:
 *     summary: Envoyer la photo de l'utilisateur
 *     description: Uploadez une image
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               picture:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Documents KYC uploadés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Erreur de validation
 */
router.post(
    '/send-picture', 
    authMiddleware, 
    upload_picture, 
    filePictureCheck,
    (req, res) => userController.uploadPicture(req, res)
);

/**
 * @swagger
 * /users/{id}/kyc:
 *   get:
 *     summary: Récupère les documents KYC d'un utilisateur
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         type: integer
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Documents KYC de l'user récupérés avec succès
 *       400:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur lors de la récupération
 */
router.get(
    '/:id/kyc',
    authMiddleware, 
    hasRole(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'CUSTOMER', 'MANAGEMENT_CONTROLLER']),
    userController.getKYCUser
)

/**
 * @swagger
 * /users/send-passcode:
 *   post:
 *     summary: Envoyer le passcode de l'utilisateur
 *     description: Enregistrer dans le système le passcode de l'utilisateur connecté
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               passcode:
 *                 type: number
 *     responses:
 *       200:
 *         description: Passcode enregistré avec succès
 *       400:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur lors de l'enregistrement
 */
router.post(
    '/send-passcode',
    authMiddleware, 
    hasRole(['CUSTOMER']),
    userController.addPasscodeUser
)

/**
 * @swagger
 * /users/try-simulation-payment:
 *   post:
 *     summary: Tester la simulation d'un paiement
 *     description: Tester la simulation d'un paiement, currency `USD`, `EUR`, `CAD`, `JPY`
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 enum: [USD, EUR, CAD, JPY]
 *     responses:
 *       200:
 *         description: Success simulation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     fees:
 *                       type: object
 *                       properties:
 *                         percentagePartnerFees:
 *                           type: number
 *                         percentageSendoFees:
 *                           type: number
 *                         currencyValue:
 *                           type: number
 *                     result:
 *                       type: object
 *                       properties:
 *                         amountConverted:
 *                           type: number
 *                         partnerVisaFees:
 *                           type: number
 *                         sendoFees:
 *                           type: number
 *                         totalAmount:
 *                           type: number
 *       400:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur lors de la simulation
 */
router.post(
    '/try-simulation-payment',
    authMiddleware,
    userController.simulatePayment
)

/**
 * @swagger
 * /users/token/{userId}:
 *   get:
 *     summary: Récupérer le token Expo d'un utilisateur
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         type: integer
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token Expo de l'user récupéré avec succès
 *       400:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur lors de la récupération
 */
router.get(
    '/token/:userId',
    authMiddleware,
    userController.getTokenExpoUser
)

/**
 * @swagger
 * /users/token/create-update:
 *   post:
 *     summary: Enregistrer ou mettre à jour son token Expo
 *     description: Enregistrer ou mettre à jour son token Expo
 *     tags:
 *       - Users
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
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token enregistré ou mis à jour avec succès
 *       400:
 *         description: Erreur de validation
 *       500:
 *         description: Erreur lors de l'enregistrement ou la mise à jour
 */
router.post(
    '/token/create-update',
    authMiddleware, 
    hasRole(['CUSTOMER']),
    userController.saveOrUpdateTokenExpoUser
)

/**
 * @swagger
 * /users/check-pincode/{pincode}:
 *   get:
 *     summary: Vérifier le pincode d'un compte
 *     parameters:
 *       - in: path
 *         name: pincode
 *         required: true
 *         type: string
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Pincode vérifié avec succès
 *       403:
 *         description: Pincode incorrect
 *       404:
 *         description: Utilisateur introuvable
 *       500:
 *         description: Erreur lors de la vérification
 */
router.get(
    '/check-pincode/:pincode',
    authMiddleware,
    checkNumberConnexionFailure,
    userController.checkPincode
)

export default router;