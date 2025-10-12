import { Router } from "express";
import kycController from "@controllers/kycController";
import { authMiddleware } from "@middlewares/auth";
import { upload_multi, upload_single } from "@config/cloudinary";
import { hasRole } from "@middlewares/roleMiddleware";

const router = Router();

/**
 * @swagger
 * /kyc/update-profil:
 *   put:
 *     summary: Mettre à jour le profil KYC du compte
 *     description: Mettre à jour le profil KYC du compte
 *     tags:
 *       - KYC
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               profession:
 *                 type: string
 *               region:
 *                 type: string
 *               city:
 *                 type: string
 *               district:
 *                 type: string
 *     responses:
 *       201:
 *         description: Profil KYC uploadé avec succès
 *       400:
 *         description: Erreur de validation
 */
router.put(
    '/update-profil', 
    authMiddleware,
    hasRole(['CUSTOMER']),
    kycController.updateKycProfil
);

/**
 * @swagger
 * /kyc/upload:
 *   post:
 *     summary: Envoi de documents KYC pour validation
 *     description: Uploadez plusieurs documents avec leurs types et informations associées
 *     tags:
 *       - KYC
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               documents:
 *                 type: string
 *                 description: Objet document sérialisé en JSON
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Documents KYC uploadés avec succès
 *       400:
 *         description: Erreur de validation
 *       403:
 *         description: Données manquantes ou non autorisées
 */
router.post(
    '/upload', 
    authMiddleware, 
    upload_multi,
    (req, res) => kycController.uploadKYC(req, res)
);

/**
 * @swagger
 * /kyc/{publicId}/admin:
 *   put:
 *     summary: Modification d'un document KYC sur le Dashboard
 *     description: Modification d'un document KYC sur le Dashboard `ADMIN`
 *     tags:
 *       - KYC
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID unique d'un KYC
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Document KYC mis à jour avec succès
 *       400:
 *         description: Erreur de validation
 */
router.put(
    '/:publicId/admin',
    authMiddleware,
    upload_single,
    hasRole(['CARD_MANAGER', 'COMPLIANCE_OFFICER', 'CUSTOMER_ADVISER', 'MANAGEMENT_CONTROLLER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'TECHNICAL_DIRECTOR', 'CUSTOMER']),
    kycController.updateKYC
)

/**
  * @swagger
  * /kyc/{publicId}:
  *   delete:
  *     summary: Supprimer le KYC uploadé d'un utilisateur
  *     description: Supprime définitivement le KYC uploadé d'un utilisateur du système
  *     tags: [KYC]
  *     security:
  *       - BearerAuth: []
  *     parameters:
  *       - in: path
  *         name: publicId
  *         required: true
  *         schema:
  *           type: string
  *         description: ID unique d'un KYC
  *     responses:
  *       204:
  *         description: KYC supprimé avec succès
  *       404:
  *         description: KYC non trouvé
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
router.delete(
    '/:publicId',
    authMiddleware, 
    hasRole(['MANAGEMENT_CONTROLLER', 'SUPER_ADMIN', 'CUSTOMER_ADVISER', 'TECHNICAL_DIRECTOR']),
    kycController.deleteKYC
)

export default router;