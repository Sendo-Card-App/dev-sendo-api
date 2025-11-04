import { Request, Response } from 'express';
import { sendError, sendResponse } from '@utils/apiResponse';
import KycDocumentModel from '@models/kyc-document.model';
import cloudinary from '@config/cloudinary';
import adminService from '@services/adminService';
import { PaginatedData } from '../types/BaseEntity';
import { sendEmailVerificationKYC, sendGlobalEmail } from '@services/emailService';
import transactionService from '@services/transactionService';
import walletService from '@services/walletService';
import { typesKYCStatus, typesMethodTransaction, typesStatusTransaction, TypesStatusUser, TypesStatusWallet, typesTransaction } from '@utils/constants';
import logger from '@config/logger';
import UserModel from '@models/user.model';
import kycService from '@services/kycService';
import notificationService from '@services/notificationService';
import cashoutService from '@services/cashoutService';

class AdminController {
    async getAllDocuments(req: Request, res: Response) {
        const { typeAccount, page, limit, startIndex, status } = res.locals.pagination;

        try {
            const documents = await adminService.getAllDocuments(typeAccount, status, limit, startIndex);
            const totalPages = Math.ceil(documents.count / limit);
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: documents.count,
                items: documents.rows,
            };

            sendResponse(res, 200, 'Documents récupérés', responseData);
        } catch (error: any) {
            sendError(res, 500, 'Erreur de récupération', [error.message]);
        }
    }

    async getDocumentsUser(req: Request, res: Response) {
        const { userId } = req.params;

        try {
            const documents = await kycService.getKycDocuments(Number(userId));
            sendResponse(res, 200, 'Documents de l\'utilisateur récupérés', documents);
        } catch (error: any) {
            sendError(res, 500, 'Erreur de récupération', [error.message]);
        }
    }

    async getPendingDocuments(req: Request, res: Response) {
        const { typeAccount, page, limit, startIndex } = res.locals.pagination;
        
        try {
            const documents = await adminService.getDocumentsPending(typeAccount, limit, startIndex);
            const totalPages = Math.ceil(documents.count / limit);
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: documents.count,
                items: documents.rows,
            };

            sendResponse(res, 200, 'Documents récupérés', responseData);
        } catch (error: any) {
            sendError(res, 500, 'Erreur de récupération', [error.message]);
        }
    }

    async reviewDocument(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { status, rejectionReason } = req.body;
            const adminId = req.user?.id;

            if (!adminId) sendError(res, 500, 'Admin non authentifié');
            if (!['APPROVED', 'REJECTED'].includes(status)) {
                throw new Error('Statut invalide');
            }

            const document = await KycDocumentModel.findByPk(id, {
                include: [{
                    model: UserModel,
                    as: 'user',
                    include: [{
                        model: KycDocumentModel,
                        as: 'kycDocuments'
                    }]
                }]
            });
            if (!document) sendError(res, 500, 'Admin non authentifié');

            document && await document.update({
                status,
                rejectionReason: status === typesKYCStatus['1'] ? '' : rejectionReason,
                reviewedById: adminId,
                reviewedAt: new Date()
            });

            // Si rejeté, suppression Cloudinary optionnelle
            if (document && status === typesKYCStatus['2']) {
                await cloudinary.uploader.destroy(document.publicId, {
                    resource_type: document.url.includes('.pdf') ? 'raw' : 'image'
                });
            }

            //const user = document && await document.user?.reload()
            const user = await UserModel.findByPk(document?.userId ?? 0, {
                include: [{
                    model: KycDocumentModel,
                    as: 'kycDocuments'
                }] 
            })
            const country = user!.country

            const isVerifiedKYC = user?.kycDocuments?.filter(kyc => kyc.status === typesKYCStatus['0'] || kyc.status === typesKYCStatus['2'])
            if (
                user && 
                country == "Cameroon" &&
                user.kycDocuments?.length === 5 && 
                !user?.isVerifiedKYC && 
                isVerifiedKYC?.length === 0
            ) {
                user.isVerifiedKYC = true;
                const newUser = await user.save();
                await sendEmailVerificationKYC(newUser);
            } else if (
                user && 
                country == "Canada" &&
                user.kycDocuments?.length === 3 && 
                !user?.isVerifiedKYC && 
                isVerifiedKYC?.length === 0
            ) {
                user.isVerifiedKYC = true;
                const newUser = await user.save();
                await sendEmailVerificationKYC(newUser);
            }

            const token = await notificationService.getTokenExpo(user?.id ?? 0)
            await notificationService.save({
                title: 'Sendo',
                type: 'SUCCESS_KYC_VERIFIED',
                content: `${user?.firstname} votre ${document?.type} KYC ont été traités`,
                userId: user?.id ?? 0,
                token: token?.token ?? '',
                status: 'SENDED'
            })

            logger.info("Document KYC mis à jour", {
                document: document ? `${document.type} - ${document.status}` : 'Document non trouvé',
                user: document && document.user ? `User ID : ${document.user.id} - ${document.user.firstname} ${document.user.lastname}` : 'Utilisateur non trouvé'
            });

            sendResponse(res, 200, 'Document mis à jour', document);
        } catch (error: any) {
            sendError(res, 500, 'Erreur de mise à jour', [error.message]);
        }
    }

    async bulkReview(req: Request, res: Response) {
        try {
            const { documents } = req.body;
            const adminId = req.user!.id;

            if (!adminId) sendError(res, 500, 'Admin non authentifié');

            const doc1 = await KycDocumentModel.findByPk(documents[0].id, {
                include: [{
                    model: UserModel,
                    as: 'user',
                    include: [{
                        model: KycDocumentModel,
                        as: 'kycDocuments'
                    }]
                }]
            })
            const results = await Promise.all(
                documents.map(async (doc: any) => {
                    const document = await KycDocumentModel.findByPk(doc.id);
                    if (!document) return null;

                    return document.update({
                        status: doc.status,
                        rejectionReason: doc.status === typesKYCStatus['1'] ? '' : doc.rejectionReason,
                        reviewedById: adminId,
                        reviewedAt: new Date()
                    });
                })
            );

            //const user = doc1 && await doc1.user?.reload()
            const user = await UserModel.findByPk(doc1?.userId ?? 0, {
                include: [{
                    model: KycDocumentModel,
                    as: 'kycDocuments'
                }] 
            })
            const country = user?.country

            const isVerifiedKYC = user?.kycDocuments?.filter(kyc => kyc.status === typesKYCStatus['0'] || kyc.status === typesKYCStatus['2'])
            if (
                user && 
                country == "Cameroon" &&
                user.kycDocuments?.length === 5 && 
                !user?.isVerifiedKYC && 
                isVerifiedKYC?.length === 0
            ) {
                user.isVerifiedKYC = true;
                const newUser = await user.save();
                await sendEmailVerificationKYC(newUser);
            } else if (
                user && 
                country == "Canada" &&
                user.kycDocuments?.length === 3 && 
                !user?.isVerifiedKYC && 
                isVerifiedKYC?.length === 0
            ) {
                user.isVerifiedKYC = true;
                const newUser = await user.save();
                await sendEmailVerificationKYC(newUser);
            }

            logger.info("Documents KYC mis à jour", {
                user: user ? `User ID : ${user.id} - ${user.firstname} ${user.lastname}` : 'Utilisateur non trouvé'
            });

            const token = await notificationService.getTokenExpo(user?.id ?? 0)
            await notificationService.save({
                title: 'Sendo',
                type: 'SUCCESS_KYC_VERIFIED',
                content: `${user?.firstname} vos documents KYC ont été traités`,
                userId: user?.id ?? 0,
                token: token?.token ?? '',
                status: 'SENDED'
            })

            sendResponse(res, 200, 'Documents mis à jour', results);
        } catch (error: any) {
            sendError(res, 500, 'Erreur de mise à jour', [error.message]);
        }
    }

    async createRole(req: Request, res: Response) {
        const { name } = req.body
        if (!name) sendError(res, 500, 'Nom de role manquant');

        try {
            const role = await adminService.createRole(String(name).toUpperCase());

            logger.info("Nouveau role créé", {
                role: `${role.name}`,
                user: req.user ? `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'Utilisateur non trouvé'
            });

            sendResponse(res, 201, 'Nouveau role créé avec succès', role);
        } catch (error: any) {
            sendError(res, 500, 'Erreur de création', [error.message]);
        }
    }

    async updateRoleUser(req: Request, res: Response) {
        const { name } = req.body
        const { id } = req.params
        if (!name) sendError(res, 500, 'Nom de role manquant');
        if (!id) sendError(res, 500, 'ID du role manquant');
        try {
            const role = await adminService.getRoleById(parseInt(id));
            if (!role) throw new Error('Role introuvable');

            await adminService.updateRole(role.id, { name: String(name).toUpperCase() });
            const roleUpdated = await adminService.getRoleById(role.id)

            logger.info("Role mis à jour", {
                role: roleUpdated && `${roleUpdated.name}`,
                user: req.user ? `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'Utilisateur non trouvé'
            });

            sendResponse(res, 200, 'Role modifié avec succès', roleUpdated);
        } catch (error: any) {
            sendError(res, 500, 'Erreur de mise à jour', [error.message]);
        }
    }

    async getRoles(req: Request, res: Response) {
        try {
            const roles = await adminService.getRoles();
            sendResponse(res, 200, 'Roles récupérés avec succès', roles);
        } catch (error: any) {
            sendError(res, 500, 'Erreur de récupération des roles', [error.message]);
        }
    }

    async attributeRole(req: Request, res: Response) {
        const { userId, rolesId } = req.body;
        if (!userId) return sendError(res, 400, "ID de l'utilisateur manquant");
        if (!rolesId || !Array.isArray(rolesId) || !rolesId.length)
            return sendError(res, 400, "rolesId doit être un tableau non vide");
    
        try {
            const userIdParsed = parseInt(userId);
            const user = await adminService.getSingleUser(userIdParsed);
            if (!user) return sendError(res, 404, "Utilisateur introuvable");
    
            // Vérifier que tous les rôles existent
            const roles = await Promise.all(rolesId.map((roleId: number) => adminService.getRoleById(roleId)));
            if (roles.some(role => !role)) return sendError(res, 404, "Un ou plusieurs rôles introuvables");
    
            // Attribuer tous les rôles en une fois (en parallèle)
            await Promise.all(rolesId.map((roleId: number) =>
                adminService.attributeRoleUser(userIdParsed, roleId)
            ));

            logger.info("Roles attribués à l'utilisateur", {
                user: `User ID : ${user.id} - ${user.firstname} ${user.lastname}`,
                roles: roles.filter(role => role !== null).map(role => role!.name).join(', '),
                admin: req.user ? `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'Utilisateur non trouvé'
            });
    
            return sendResponse(res, 200, "Les rôles ont été attribués à l'utilisateur");
        } catch (error: any) {
            return sendError(res, 500, "Erreur d'attribution des rôles", [error.message]);
        }
    }    

    async removeRoleUser(req: Request, res: Response) {
        const { userId, roleId } = req.body
        if (!userId) sendError(res, 500, 'ID de l\'user manquant');
        if (!roleId) sendError(res, 500, 'ID du role manquant');
        try {
            const userIdParsed = parseInt(userId)
            const roleIdParsed = parseInt(roleId)
            const user = await adminService.getSingleUser(userIdParsed)
            const role = await adminService.getRoleById(roleIdParsed)
            if (user && role) {
                await adminService.removeRoleUser(userIdParsed, roleIdParsed)

                logger.info("Role supprimé de l'utilisateur", {
                    user: `User ID : ${user.id} - ${user.firstname} ${user.lastname}`,
                    role: `${role.name}`,
                    admin: req.user ? `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'Utilisateur non trouvé'
                });

                sendResponse(res, 200, "Le role a été supprimé à l'utilisateur");
            } else {
                sendError(res, 500, 'Utilisateur ou role introuvable');
            }
        } catch (error: any) {
            sendError(res, 500, 'Erreur de suppression d\'un role', [error.message]);
        }
    }

    async updateStatusUser(req: Request, res: Response) {
        const {email, status} = req.query
        try {
            if (!email) sendError(res, 500, 'Email manquant')
            if (typeof email !== 'string') {
                return sendError(res, 400, 'email doit être une chaîne de caractères');
            }

            const user = await adminService.findUserByEmail(email);
            if (!user) {
                sendError(res, 500, 'Utilisateur introuvable');
            } else {
                user.status = status as TypesStatusUser
                user.numberFailureConnection = 0
                await user.save();
                
                await sendGlobalEmail(
                    user.email,
                    'Status de votre compte',
                    `<h4>Voici le nouveau status de votre compte :</h4>
                    <p>Status : <b>${user.status}</b></p>`
                )

                logger.info("Status de l'utilisateur mis à jour", {
                    user: `User ID : ${user.id} - ${user.firstname} ${user.lastname}`,
                    status: `${user.status}`,
                    admin: req.user ? `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'Utilisateur non trouvé'
                });

                const token = await notificationService.getTokenExpo(user?.id ?? 0)
                await notificationService.save({
                    title: 'Sendo',
                    type: 'ENABLED_ACCOUNT',
                    content: `${user?.firstname} le status de votre compte Neero a été modifié`,
                    userId: user?.id ?? 0,
                    token: token?.token ?? '',
                    status: 'SENDED'
                })

                sendResponse(res, 200, 'Status de l\'utilisateur mis à jour')
            }
        } catch (error: any) {
            sendError(res, 500, 'Erreur de modification du status du compte', [error.message]);
        }
    }

    async updateStatusWallet(req: Request, res: Response) {
        const {matriculeWallet, status} = req.query
        try {
            if (!matriculeWallet) sendError(res, 400, 'matriculeWallet manquant')
            if (typeof matriculeWallet !== 'string') {
                return sendError(res, 400, 'matriculeWallet doit être une chaîne de caractères');
            }

            const wallet = await adminService.findWallet(matriculeWallet);
            if (!wallet) {
                sendError(res, 500, 'Portefeuille introuvable');
            } else {
                wallet.status = status as TypesStatusWallet
                await wallet.save();

                if (wallet.user?.email) {
                    await sendGlobalEmail(
                        wallet.user.email,
                        'Status de votre portefeuille',
                        `<h4>Voici le nouveau status de votre portefeuille :</h4>
                        <p>Status :</p> <b>${wallet.status}</b>`
                    );
                }

                const token = await notificationService.getTokenExpo(wallet.user?.id ?? 0)
                await notificationService.save({
                    title: 'Sendo',
                    type: 'ENABLED_ACCOUNT',
                    content: `${wallet.user?.firstname} le status de votre portefeuille Neero a été modifié`,
                    userId: wallet.user?.id ?? 0,
                    token: token?.token ?? '',
                    status: 'SENDED'
                })

                logger.info("Status du portefeuille mis à jour", {
                    wallet: `${wallet.matricule}`,
                    status: `${wallet.status}`,
                    user: wallet.user ? `${wallet.user.firstname} ${wallet.user.lastname}` : 'Utilisateur non trouvé',
                    admin: req.user ? `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'Utilisateur non trouvé'
                });

                sendResponse(res, 200, 'Status du portefeuille mis à jour')
            }
        } catch (error: any) {
            sendError(res, 500, 'Erreur de modification du status du wallet', [error.message]);
        }
    }

    async changeStatusTransaction(req: Request, res: Response) {
        const { status, transactionId } = req.query
        const { transactionReference, bankName, accountNumber } = req.body
        try {
            if (!status || !transactionId) {
                return sendError(res, 400, 'Veuillez fournir tous les éléments');
            }

            const transaction = await transactionService.getTransaction(transactionId as string)
            if (!transaction) {
                sendError(res, 404, "Transaction introuvable")
                return
            }

            if (
                transaction?.type === typesTransaction['0'] && 
                transaction.method === typesMethodTransaction['1'] &&
                transaction.user &&
                transaction.user.wallet &&
                transaction.transactionReference == transactionReference &&
                transaction.bankName == bankName &&
                transaction.accountNumber == accountNumber &&
                status === typesStatusTransaction['1']
            ) {
                await walletService.creditWallet(
                    transaction.user.wallet.matricule,
                    transaction.amount,
                    typesMethodTransaction['1']
                );

                transaction.status = 'COMPLETED'
                await transaction.save();

                const token = await notificationService.getTokenExpo(transaction.user?.id ?? 0)
                await notificationService.save({
                    title: 'Sendo',
                    type: 'INFORMATION',
                    content: `${transaction.user?.firstname} votre dépôt bancaire sur SENDO a été traité avec succès`,
                    userId: transaction.user?.id ?? 0,
                    token: token?.token ?? '',
                    status: 'SENDED'
                })
            } else if (
                transaction?.type === typesTransaction['2'] && 
                transaction.method === typesMethodTransaction['0'] &&
                status === typesStatusTransaction['1']
            ) {
                // Architecture de Maviance
                /*const destinataire = await transaction.getReceiver()
                const result = await mobileMoneyController.initTransfert(
                    destinataire?.phone ?? '',
                    `${destinataire?.firstname ?? ''} ${destinataire?.lastname ?? ''}`,
                    destinataire?.address ?? '',
                    transaction.totalAmount,
                    transaction.transactionReference ?? ''
                )

                const token = await notificationService.getTokenExpo(transaction.user?.id ?? 0)
                await notificationService.save({
                    title: 'Sendo',
                    type: 'INFORMATION',
                    content: `${transaction.user?.firstname} votre transfert d'argent a été envoyé à votre destinataire`,
                    userId: transaction.user?.id ?? 0,
                    token: token?.token ?? '',
                    status: 'SENDED'
                })

                if (result && result.status === 'SUCCESS' && destinataire) {
                    transaction.status = 'COMPLETED'
                    await transaction.save();
                }*/

                // Architecture de Neero
                const destinataire = await transaction.getReceiver()
                await cashoutService.init(destinataire!.phone, transaction.transactionId ||'')
            }

            logger.info("Status de la transaction mis à jour", {
                transaction: `${transaction?.id} - ${transaction?.status}`,
                admin: `Admin ID : ${req.user?.id} - ${req.user?.firstname} ${req.user?.lastname}`,
                user: transaction?.user ? `User ID : ${transaction.user.id} - ${transaction?.user.firstname} ${transaction?.user.lastname}` : 'Utilisateur non trouvé'
            });
            sendResponse(res, 200, 'Status de la transaction changé avec succès', transaction)
        } catch (error: any) {
            sendError(res, 500, 'Erreur du changement de status de la transaction', [error.message]);
        }
    }
}

export default new AdminController();