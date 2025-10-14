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
            if (!profession || !region || !city || !district) {
                throw new Error('Veuillez remplir tous les champs');
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

            // Si documents est un tableau de chaînes JSON
            const documents = JSON.parse(req.body.documents)

            const files = req.files as Express.Multer.File[];
            
            if (!Array.isArray(documents) || documents.length === 0) {
                throw new Error('Aucun document à uploader');
            }
            if (!files || files.length !== documents.length) {
                throw new Error('Nombre de fichiers et de documents non cohérent');
            }
            
            // Vérifier si l'utilisateur a déjà uploadé ses KYC
            const checkFilesKycUSers = await kycService.checkKYCIsUploaded(req.user.id, 'User');
            if (checkFilesKycUSers) {
                throw new Error("Vous avez déjà envoyé vos KYC");
            }

            const results = [];

            for (let i = 0; i < documents.length; i++) {
                const { type, idDocumentNumber, taxIdNumber } = documents[i];
                const file = files[i];

                if (!type) {
                    sendError(res, 403, `Document ${i + 1}: type manquant`);
                    return;
                }
                if (type === 'ID_PROOF' && !idDocumentNumber) {
                    sendError(res, 403, `Document ${i + 1}: Veuillez envoyer le numéro de la pièce d'identité`);
                    return;
                }
                if (type === 'NIU_PROOF' && !taxIdNumber) {
                    sendError(res, 403, `Document ${i + 1}: Veuillez envoyer votre numéro NIU`);
                    return;
                }
                if (!file) {
                    sendError(res, 403, `Document ${i + 1}: Aucun fichier fourni`);
                    return;
                }
                
                let doc: KycDocumentModel;
                if (idDocumentNumber || taxIdNumber) {
                    doc = await KycDocumentModel.create({
                        userId: req.user.id,
                        type,
                        url: file.path,
                        idDocumentNumber,
                        taxIdNumber,
                        publicId: file.filename,
                        status: typesKYCStatus['0']
                    });
                } else {
                    doc = await KycDocumentModel.create({
                        userId: req.user.id,
                        type,
                        url: file.path,
                        publicId: file.filename,
                        status: typesKYCStatus['0']
                    });
                }
                
                results.push(doc);
            }

            logger.info("KYC envoyés", {
                user: `${req.user?.firstname} ${req.user?.lastname}`,
                documents: results.map(r => `${r.type} - ${r.status}`).join(', ')
            });

            sendResponse(res, 201, 'KYC envoyés avec succès', results);
        } catch (error: any) {
            //Suppression des KYC uploadés
            const kycDocuments = await kycService.getKycDocuments(req.user?.id ?? 0)
            if (kycDocuments.length > 0) {
                kycDocuments.map(k => kycService.deleteKYC(k.publicId))
            }
            
            sendError(res, 500, 'Erreur KYC', [error.message]);
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
        
        try {
            if (!publicId) {
                sendError(res, 403, 'publicId manquant')
            }

            const file = req.file as Express.Multer.File;
            if (!file) {
                throw new Error("Fichier manquant")
            }

            const doc = await kycService.getKycDocumentByPublicId(publicId)
            if (!doc) {
                throw new Error("publicId incorrect")
            }
            if (doc.status === 'REJECTED') {
                await doc.update({ status: 'PENDING' })
            }
            
            // On supprime le fichier uploadé sur le cloud
            await cloudinary.uploader.destroy(doc.publicId)

            await doc.update({
                url: file.path,
                publicId: file.filename
            });

            logger.info("KYC mis à jour ", {
                publicId,
                user: req.user ? `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'Système'
            });
            
            sendResponse(res, 200, 'KYC mis à jour avec succès', doc);
        } catch (error: any) {
            // On supprime le fichier uploadé sur le cloud
            await cloudinary.uploader.destroy(publicId)

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