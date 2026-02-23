import { Request, Response } from 'express';
import { sendError, sendResponse } from '@utils/apiResponse';
import KycDocumentModel from '@models/kyc-document.model';
import cloudinary from '@config/cloudinary';
import userService from '@services/userService';
import { HttpStatusCode } from 'axios';
import kycService from '@services/kycService';
import { typesKYCStatus } from '@utils/constants';
import logger from '@config/logger';

class KycController {
    
    constructor() {
        this.cleanupFailedUploads = this.cleanupFailedUploads.bind(this);
        this.determineDocumentType = this.determineDocumentType.bind(this);
    }

    private determineDocumentType(file: Express.Multer.File, index: number): string {
        const documentOrder = [
            'ID_PROOF',    
            'ID_PROOF',    
            'ADDRESS_PROOF',
            'NIU_PROOF',
            'SELFIE'
        ];

        const detectedType = this.detectTypeFromName(file);
    
        return documentOrder[index] || detectedType;
    }

    private cleanupFailedUploads = async (files: Express.Multer.File[]) => {
        try {
            const deletePromises = files.map(file => 
                cloudinary.uploader.destroy(file.filename, {
                    resource_type: file.mimetype.includes('image') ? 'image' : 'raw'
                })
            );
            await Promise.all(deletePromises);
        } catch (error) {
            console.error('Erreur nettoyage Cloudinary:', error);
        }
    }

    async updateKycProfil(req: Request, res: Response) {
        const {profession, region, city, district} = req.body
        
        try {
            if (!req.user) throw new Error('Utilisateur non authentifié');
            console.log('country : ', req.user.country)
            if (
                req.user.country == "Cameroon" &&
                (!profession && !region && !city && !district)
            ) {
                throw new Error('Veuillez remplir tous les champs');
            }
            if (
                req.user.country == "Canada" &&
                (!profession)
            ) {
                throw new Error('Veuillez fournir votre profession');
            }
           
            const updates = {
                profession, 
                region, 
                city, 
                district
            }
            const updatedUser = await userService.updateUser(req.user.id, updates)

            logger.info("Profil KYC mis à jour", {
                user: `${req.user?.firstname} ${req.user?.lastname}`
            });
      
            sendResponse(res, 201, 'Profil mis à jour avec succès', updatedUser);
        } catch (error: any) {
            sendError(res, 500, 'Erreur update profil KYC', [error.message]);
        }
    }

    async uploadKYC(req: Request, res: Response) {
        try {
            if (!req.user) throw new Error('Utilisateur non authentifié');

            const documents = JSON.parse(req.body.documents) as any[];
            const files = req.files as Express.Multer.File[];
            const country = req.user.country;

            if (!Array.isArray(documents) || documents.length === 0) {
                throw new Error('Aucun document à uploader');
            }

            if (!files || files.length !== documents.length) {
                throw new Error('Nombre de fichiers et de documents non cohérent');
            }

            const alreadyUploaded = await kycService.checkKYCIsUploaded(
                req.user.id,
                country === "Cameroon" ? 'User' : 'Extern'
            );

            if (alreadyUploaded) {
                throw new Error("Vous avez déjà envoyé vos KYC");
            }

            const results: (KycDocumentModel | null)[] = [];
            const errors: string[] = [];

            for (let i = 0; i < documents.length; i++) {
                const { type, idDocumentNumber, taxIdNumber, expirationDate } = documents[i];
                const file = files[i];

                if (!type) {
                    errors.push(`Document ${i + 1}: type manquant`);
                    continue;
                }

                if (!file) {
                    errors.push(`Document ${i + 1}: Aucun fichier fourni`);
                    continue;
                }

                // Validation spécifique pour Cameroon
                if (country === "Cameroon" && type === 'ID_PROOF') {
                    if (!idDocumentNumber || !expirationDate) {
                        errors.push(`Document ${i + 1}: Veuillez envoyer le numéro de la pièce d'identité et sa date d'expiration`);
                        continue;
                    }
                }

                // Validation spécifique pour Canada
                if (country === "Canada" && type === 'ID_PROOF') {
                    if (!idDocumentNumber || !expirationDate) {
                        errors.push(`Document ${i + 1}: Veuillez envoyer le numéro de la pièce d'identité et sa date d'expiration`);
                        continue;
                    }
                }

                // Création du document KYC selon conditions
                let doc: KycDocumentModel | null = null;

                if (
                    country === "Cameroon" &&
                    type === "ID_PROOF" &&
                    idDocumentNumber && expirationDate
                ) {
                    doc = await KycDocumentModel.create({
                        userId: req.user.id,
                        type,
                        url: file.path,
                        idDocumentNumber,
                        taxIdNumber,
                        expirationDate,
                        publicId: file.filename,
                        status: typesKYCStatus['0']
                    });
                    console.log('1er if kyc : ', doc)
                } else if (
                    country === "Cameroon" &&
                    (type === "ADDRESS_PROOF" || type === "SELFIE") &&
                    !idDocumentNumber && !taxIdNumber && !expirationDate
                ) {
                    doc = await KycDocumentModel.create({
                        userId: req.user.id,
                        type,
                        url: file.path,
                        publicId: file.filename,
                        status: typesKYCStatus['0']
                    });
                    console.log('2e if kyc : ', doc)
                } else if (
                    country === "Canada" &&
                    type === "ID_PROOF" &&
                    idDocumentNumber && expirationDate && !taxIdNumber
                ) {
                    doc = await KycDocumentModel.create({
                        userId: req.user.id,
                        type,
                        idDocumentNumber,
                        expirationDate,
                        url: file.path,
                        publicId: file.filename,
                        status: typesKYCStatus['0']
                    });
                    console.log('3e if kyc : ', doc)
                } else if (
                    country === "Canada" &&
                    type === "SELFIE" &&
                    !idDocumentNumber && !expirationDate && !taxIdNumber
                ) {
                    doc = await KycDocumentModel.create({
                        userId: req.user.id,
                        type,
                        url: file.path,
                        publicId: file.filename,
                        status: typesKYCStatus['0']
                    });
                    console.log('4e if kyc : ', doc)
                } else {
                    errors.push(`Document ${i + 1}: Données invalides ou manquantes pour le type ${type}`);
                    continue;
                }

                results.push(doc);
            }

            if (errors.length > 0) {
                // En cas d'erreur, suppression des documents créés
                await Promise.all(results.filter(r => r !== null).map(doc => kycService.deleteKYC(doc!.publicId)));
                return sendError(res, 400, 'Erreurs dans les documents fournis', errors);
            }

            logger.info("KYC envoyés", {
                user: `${req.user.firstname} ${req.user.lastname}`,
                documents: results.map(r => `${r?.type} - ${r?.status}`).join(', ')
            });

            return sendResponse(res, 201, 'KYC envoyés avec succès', results);

        } catch (error: any) {
            console.error('Erreur uploadKYC:', error);
            if (req.user?.id) {
                const kycDocuments = await kycService.getKycDocuments(req.user.id);
                if (kycDocuments.length > 0) {
                    await Promise.all(kycDocuments.map(k => kycService.deleteKYC(k.publicId)));
                }
            }
            return sendError(res, 500, 'Erreur KYC', [error.message]);
        }
    }

    async deleteKYC(req: Request, res: Response) {
        const { publicId } = req.params
        if (!publicId) throw new Error('Envoyez le publicId du KYC');
        try {
            
            await kycService.deleteKYC(publicId)

            logger.info("KYC supprimé", {
                publicId,
                user: req.user ? `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'Système'
            });
            
            sendResponse(res, HttpStatusCode.Ok, 'KYC supprimé avec succès');
        } catch (error: any) {
            sendError(res, 500, 'Erreur suppression KYC', [error.message]);
        }
    }

    async updateKYC(req: Request, res: Response) {
        const { publicId } = req.params
        const file = req.file as Express.Multer.File;
        
        try {
            if (!publicId) return sendError(res, 400, 'publicId manquant');
            if (!file) return sendError(res, 400, 'Fichier manquant');

            const doc = await kycService.getKycDocumentByPublicId(publicId);
            if (!doc) return sendError(res, 404, 'Document KYC introuvable');

            if (doc.status === 'REJECTED') {
                await doc.update({ status: 'PENDING' })
            }
            
            // On supprime l'ancien fichier uploadé sur le cloud
            await cloudinary.uploader.destroy(doc.publicId);

            await doc.update({
                url: file.path,
                publicId: file.filename
            });

            logger.info("KYC mis à jour", { publicId, admin: req.user?.id });
            
            sendResponse(res, 200, 'KYC mis à jour avec succès', {
                id: doc.id,
                publicId: doc.publicId,
                status: doc.status,
                url: doc.url,
                updatedAt: doc.updatedAt?.toISOString()
            });
        } catch (error: any) {
            // On supprime le fichier uploadé sur le cloud
            if (file) {  // Supprimez SEULEMENT si fichier uploadé
                await cloudinary.uploader.destroy(file.filename);
            }

            sendError(res, 500, 'Erreur mise à jour KYC', [error.message]);
        }
    }

    async sendDocsMerchant(req: Request, res: Response) {
        const { type } = req.body
        try {
            if (!req.user) throw new Error('Utilisateur non authentifié');

            const files = req.files as Express.Multer.File[];
         
            if (!files || files.length === 0) {
                throw new Error('Veuillez fournir un document');
            }
            
            // Vérifier si l'utilisateur a déjà uploadé ses KYC
            const checkFilesKycUSers = await kycService.checkKYCIsUploaded(req.user.id, 'Merchant');
            if (checkFilesKycUSers) {
                throw new Error("Vous avez déjà envoyé vos KYC");
            }

            const results = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                const doc = await KycDocumentModel.create({
                    userId: req.user.id,
                    type,
                    typeAccount: 'MERCHANT',
                    url: file.path,
                    publicId: file.filename,
                    status: typesKYCStatus['0']
                });
                
                results.push(doc);
            }

            logger.info("KYC Merchant envoyés", {
                user: `${req.user?.firstname} ${req.user?.lastname}`,
                documents: results.map(r => `${r.type} - ${r.status}`).join(', ')
            });

            sendResponse(res, 201, 'KYC envoyés avec succès', results);
        } catch (error: any) {
            //Suppression des KYC uploadés
            const kycDocuments = await kycService.getKycDocuments(req.user! .id)
            if (kycDocuments.length > 0) {
                kycDocuments.map(k => kycService.deleteKYC(k.publicId))
            }
            
            sendError(res, 500, 'Erreur KYC', [error.message]);
        }
    } 
     
    private detectTypeFromName(file: Express.Multer.File): string {
        const documentTypes = [
            { pattern: /(cni|passeport|id)/i, type: 'ID_PROOF' },
            { pattern: /(facture|adresse|localisation)/i, type: 'ADDRESS_PROOF' },
            { pattern: /(niu)/i, type: 'NIU_PROOF' },
            { pattern: /(selfie)/i, type: 'SELFIE' },
        ];
        
        return documentTypes.find(({ pattern }) => 
            pattern.test(file.originalname)
        )?.type || 'ID_PROOF';
    }
}

const controller = new KycController();
export default controller;