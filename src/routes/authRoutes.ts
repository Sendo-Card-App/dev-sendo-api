import express from 'express';
import { validateUser } from '@middlewares/validators/validateUser';
import authController from '@controllers/authController';
import { authMiddleware } from '@middlewares/auth';
import OTPController from '@controllers/OTPController';

const router = express.Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Crée un nouvel utilisateur
 *     description: La propriété `referralCode` n'est pas obligatoire lors de l'inscription
 *     tags: [Auth]
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
 *               password:
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
 *               referralCode:
 *                 type: string
 *                 required: false
 *     responses:
 *       201:
 *         description: Utilisateur créé
 */
router.post('/register', validateUser, authController.createUser);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authentification utilisateur
 *     tags: [Auth]
 *     description: Permet à un utilisateur de se connecter en fournissant son email et son mot de passe.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "infosendo@sf-e.ca"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "Admin123!"
 *     responses:
 *       200:
 *         description: Connexion réussie, retourne les tokens et l'identifiant de l'appareil.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR..."
 *                 deviceId:
 *                   type: string
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /auth/login-phone:
 *   post:
 *     summary: Authentification utilisateur
 *     tags: [Auth]
 *     description: Permet à un utilisateur de se connecter en fournissant son téléphone et son mot de passe.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+237695707731"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "Admin123!"
 *     responses:
 *       200:
 *         description: Connexion réussie, retourne les tokens et l'identifiant de l'appareil.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR..."
 *                 deviceId:
 *                   type: string
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 */
router.post('/login-phone', authController.loginWithPhone);

/**
 * @swagger
 * /auth/login-passcode:
 *   post:
 *     summary: Connecté un utilisateur qui a déjà une session ouverte
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     description: Permet à un utilisateur de se connecter en fournissant son passcode.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - passcode
 *             properties:
 *               passcode:
 *                 type: integer
 *                 example: 1234
 *     responses:
 *       200:
 *         description: Accès autorisé.
 *         content:
 *           application/json:
 *             schema:
 *               type: boolean
 */
router.post(
    '/login-passcode', 
    authMiddleware,
    authController.loginWithPasscode
);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Rafraîchir le token d'accès
 *     tags: [Auth]
 *     description: Permet de générer un nouveau token d'accès en utilisant un refresh token valide.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *               - deviceId
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR..."
 *               deviceId:
 *                 type: string
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Nouveau token généré avec succès.
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @swagger
 * /auth/email/send:
 *   post:
 *     summary: Envoie par mail le tien pour vérifier l'adresse mail de son compte
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@gmail.com"
 *     responses:
 *       200:
 *         description: Lien envoyé par mail avec succès
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
 *         description: Erreur lors de l’envoi du lien
 */
router.post('/email/send', authController.sendEmailAccount);

/**
 * @swagger
 * /auth/email/verify:
 *   get:
 *     summary: Vérifier un compte après sa création
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         type: string
 *     description: Permet de vérifier un compte après l'envoi de mail lors de sa création
 *     responses:
 *       200:
 *         description: Compte vérifié avec succès.
 */
router.get('/email/verify', authController.verifyAccount);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Faire une requête de modification du mot de passe
 *     tags: [Auth]
 *     description: Un email est envoyé lors de la requête de modification du mot de passe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: "john.doe@gmail.com"
 *     responses:
 *       200:
 *         description: Un lien a été envoyé pour modifier le password
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /auth/admin/forgot-password:
 *   post:
 *     summary: Faire une requête de modification du mot de passe côté admin
 *     tags: [Auth]
 *     description: Un email est envoyé lors de la requête de modification du mot de passe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: "john.doe@gmail.com"
 *     responses:
 *       200:
 *         description: Un lien a été envoyé pour modifier le password
 */
router.post('/admin/forgot-password', authController.forgotPasswordAdmin);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Modifier le mot de passe côté `CUSTOMER`
 *     tags: [Auth]
 *     description: Le mot de passe est modifié côté `CUSTOMER`
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *               - code
 *             properties:
 *               newPassword:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Le mot de passe a été modifié avec succès
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @swagger
 * /auth/admin/reset-password:
 *   post:
 *     summary: Modifier le mot de passe côté `ADMIN`
 *     tags: [Auth]
 *     description: Le mot de passe est modifié `ADMIN`
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *               - token
 *             properties:
 *               newPassword:
 *                 type: string
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Le mot de passe a été modifié avec succès
 */
router.post('/admin/reset-password', authController.resetPasswordAdmin);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Déconnexion d'un appareil spécifique
 *     tags: [Auth]
 *     description: Supprime le token associé à un appareil spécifique.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *             properties:
 *               deviceId:
 *                 type: string
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       204:
 *         description: Déconnexion réussie
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     summary: Déconnexion de tous les appareils d'un compte
 *     tags: [Auth]
 *     description: Supprime les tokens associés à un compte
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       204:
 *         description: Déconnexion réussie pour tous les appareils
 */
router.post('/logout-all', authMiddleware, authController.logoutAllDevices);

/**
 * @swagger
 * /auth/otp/send:
 *   post:
 *     summary: Envoie un OTP par SMS via Twilio
 *     tags:
 *       - Auth
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
router.post('/otp/send', OTPController.sendOTP);

/**
 * @swagger
 * /auth/otp/verify:
 *   post:
 *     summary: Vérifie un OTP reçu par SMS
 *     tags:
 *       - Auth
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
router.post('/otp/verify', OTPController.verifyOTP);

export default router;