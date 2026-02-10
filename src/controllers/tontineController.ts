import { Request, Response } from 'express';
import TontineService from '@services/tontineService';
import { sendError, sendResponse } from '@utils/apiResponse';
import tontineService from '@services/tontineService';
import TontineModel from '@models/tontine.model';
import { PaginatedData } from '../types/BaseEntity';
import notificationService from '@services/notificationService';
import logger from '@config/logger';

class TontineController {
    async create(req: Request, res: Response) {
        const { nom, type, frequence, montant, modeVersement, description } = req.body
        try {
            if (!req.user) throw new Error('Utilisateur non authentifié');
            if (!nom || !type || !frequence || !montant || !modeVersement) {
                sendError(res, 404, 'Veuillez fournir tous les champs')
            }

            const data = {
                nom, 
                type, 
                frequence, 
                montant,
                modeVersement,
                createurId: req.user.id,
                description
            }
            const result = await TontineService.createTontine(data);

            logger.info('Tontine créée avec succès', {
                id: result.tontine.id,
                createur: req.user.firstname + ' ' + req.user.lastname
            })
            
            sendResponse(res, 201, 'Tontine créée avec succès', result.tontine)
        } catch (error: any) {
            sendError(res, 400, 'Erreur lors de la création de la tontine', [error.message])
        }
    }

    async addMember(req: Request, res: Response) {
        const { tontineId } = req.params
        const { userId } = req.body
        try {
            if (!userId || !tontineId) throw new Error("Veuillez fournir tous les paramètres")

            const result = await TontineService.ajouterMembre(
                parseInt(tontineId),
                parseInt(userId)
            );

            logger.info('Membre ajouté à la tontine avec succès', {
                tontineId,
                membreId: userId,
                addedBy: req.user ? `${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'System'
            })
            
            sendResponse(res, 200, 'Ajout du membre réussi !', result)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de l\'ajout d\'un membre', [error.message])
        }
    }

    async contribute(req: Request, res: Response) {
        const { tontineId } = req.params
        const { membreId, cotisationId } = req.body
        try {
            if (!req.user) throw new Error('Utilisateur non authentifié');
            if (!tontineId || !membreId || !cotisationId) {
                throw new Error("Veuillez fournir tous les champs")
            }

            const result = await TontineService.payerCotisation({
                tontineId: parseInt(tontineId),
                membreId: parseInt(membreId),
                cotisationId: parseInt(cotisationId)
            });

            logger.info('Cotisation payée avec succès', {
                tontineId,
                cotisationId,
                membreId,
                payedBy: req.user ? `${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'System'
            })

            sendResponse(res, 200, 'Cotisation payée avec succès', result)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors du paiement de la cotisation', [error.message])
        }
    }

    async distribute(req: Request, res: Response) {
        const { tontineId } = req.params;
        try {
            if (!tontineId) throw new Error("Veuillez fournir l'ID de la tontine");

            const result = await TontineService.effectuerDistribution(parseInt(tontineId));

            logger.info('Distribution de la cotisation effectuée avec succès', {
                tontineId,
                distributedBy: req.user ? `${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'System'
            })

            sendResponse(res, 200, 'Distribution de la cotisation effectuée avec succès', result);
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la distribution de la cotisation', [error.message]);
        }
    }

    async updateOrdreRotation(req: Request, res: Response) {
        try {
            const tontineId = parseInt(req.params.tontineId);
            const { ordreRotation } = req.body;

            if (ordreRotation) {
                if (!Array.isArray(ordreRotation)) {
                    sendError(res, 400, "ordreRotation doit être un tableau d'IDs")
                }
            }   

            const tontine = await tontineService.getSimpleTontineById(tontineId)
            if (!tontine) {
                sendError(res, 404, 'Tontine introuvable')
            }

            if (tontine && tontine.type === 'VOTE') {
                sendError(res, 400, "Modification de l'ordre de rotation non autorisée pour le type 'vote'")
            } 

            let tontineUpdated: TontineModel | null = null
            if (tontine?.type === 'ALEATOIRE') {
                tontineUpdated = await tontineService.updateOrdreRotation(tontineId)
            } else if (tontine?.type === 'FIXE') {
                tontineUpdated = await tontineService.updateOrdreRotation(tontineId, ordreRotation)
            }

            logger.info('Ordre de rotation mis à jour avec succès', {
                tontineId,
                updatedBy: req.user ? `${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'System'
            })

            sendResponse(res, 200, "Ordre de passage mis à jour", tontineUpdated)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la distribution de la cotisation', [error.message])
        }
    }

    async getTontine(req: Request, res: Response) {
        try {
            const tontineId = parseInt(req.params.tontineId);

            const tontine = await tontineService.getTontineById(tontineId)
            if (!tontine) {
                sendError(res, 404, 'Tontine introuvable')
            }

            sendResponse(res, 200, 'Tontine récupérée avec succès', tontine)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération de la tontine', [error.message])
        }
    }

    async getTourDistributionsTontine(req: Request, res: Response) {
        const { tontineId } = req.params
        try {
            if (!tontineId) {
                sendError(res, 401, 'Veuillez fournir l\'Id de la tontine')
            }
            const tours = await tontineService.getTourDistributionsTontine(parseInt(tontineId))
            sendResponse(res, 200, 'Tours de tontine récupérés', tours)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération des tours de la tontine', [error.message])
        }
    }

    async getTontinesUser(req: Request, res: Response) {
        const { page, limit, startIndex } = res.locals.pagination
        try {
            const userId = parseInt(req.params.userId);

            const tontines = await tontineService.getTontinesUser(userId, limit, startIndex)
            
            const totalPages = Math.ceil(tontines.count / limit);
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: tontines.count,
                items: tontines.rows
            };

            sendResponse(res, 200, 'Tontines récupérées avec succès', responseData)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération des tontines', [error.message])
        }
    }

    async getTourDistributionsTontineUser(req: Request, res: Response) {
        const { tontineId } = req.params
        const {memberId } = req.query
        try {
            if (!tontineId) {
                sendError(res, 401, 'Veuillez fournir l\'Id de la tontine')
            }

            const tours = await tontineService.getTourDistributionsTontineUser(
                parseInt(tontineId), 
                parseInt(memberId as string)
            )

            sendResponse(res, 200, 'Tours de tontine récupérés', tours)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération des tours de la tontine', [error.message])
        }
    }

    async getAllTontines(req: Request, res: Response) {
        const { limit, startIndex, page } = res.locals.pagination

        try {
            const tontines = await tontineService.getAllTontines(limit, startIndex)
            
            const totalPages = Math.ceil(tontines.count / limit);
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: tontines.count,
                items: tontines.rows
            };

            sendResponse(res, 200, 'Tontines récupérées avec succès', responseData)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération des tontines', [error.message])
        }
    }

    async appliquerPenalite(req: Request, res: Response) {
        const { membreId, montant, type, cotisationId, description } = req.body
        const { tontineId } = req.params
        try {
            if (!membreId || !montant || !type) {
                sendError(res, 401, 'Veuillez fournir tous les paramètres')
            }
            const penalite = await tontineService.appliquerPenalite({ 
                membreId, 
                montant, 
                type, 
                tontineId: parseInt(tontineId), 
                cotisationId,
                description
            })

            //Envoyer une notification au membre de la tontine
            const tokenExpo = await notificationService.getTokenExpo(penalite.membre!.user!.id)
            if (tokenExpo && penalite.membre && penalite.membre.user && penalite.tontine) {
                await notificationService.save({
                    title: `Sendo`,
                    content: `${penalite.membre.user.firstname}, une pénalité de ${penalite.montant} FCFA t'a été appliqué sur ta tontine ${penalite.tontine.nom}`,
                    userId: penalite.membre.user?.id ?? 0,
                    status: 'SENDED',
                    token: tokenExpo.token,
                    type: 'TONTINE'
                });
            }

            logger.info('Pénalité créée avec succès', {
                tontineId,
                membreId,
                montant,
                appliedBy: req.user ? `${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'System'
            })

            sendResponse(res, 201, 'Pénalité créée avec succès', penalite)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de l\'enregistrement de la pénalité', [error.message])
        }
    }

    async getPenalitesMembre(req: Request, res: Response) {
        const { tontineId, membreId } = req.params
        try {
            const penalites = await tontineService.getPenalitesTontineMembre(
                parseInt(membreId),
                parseInt(tontineId)
            )
            
            sendResponse(res, 200, 'Pénalités du membre récupérés avec succès', penalites)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération des pénalités d\'un membre', [error.message])
        }
    }

    async payerPenalite(req: Request, res: Response) {
        const { penaliteId } = req.params
        try {
            if (!penaliteId) {
                sendError(res, 401, 'Veuillez fournir l\'id de la pénalité')
            }

            const payerPenalite = await tontineService.payerPenalite(parseInt(penaliteId))

            logger.info('Pénalité payée avec succès', {
                penaliteId,
                payedBy: req.user ? `${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'System'
            })

            sendResponse(res, 200, 'Paiement pénalité enregistré', payerPenalite)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors du paiement de la pénalité', [error.message])
        }
    }

    async updateStatusTontine(req: Request, res: Response) {
        const { tontineId } = req.params
        const { status } = req.body
        try {
            if (!req.user) {
                throw new Error("Veuillez vous connecter")
            }

            await tontineService.updateStatusTontine(
                parseInt(tontineId),
                status,
            ) 

            logger.info('Status de la tontine mis à jour', {
                tontineId,
                updatedBy: req.user ? `${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'System'
            })

            sendResponse(res, 200, 'Status de la tontine mis à jour')
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors du changement de status de la tontine', [error.message])
        }
    }

    async accederTontine(req: Request, res: Response){
        const { invitationCode, membreId, type } = req.body
        try {
            if (!invitationCode && type === 'JOIN') {
                sendError(res, 404, 'Veuillez fournir le code d\'invitation de la tontine')
            }
            if (!membreId || !type) {
                sendError(res, 401, "Veuillez fournir l'id du membre et le type d'action")
            }

            const result = await tontineService.accederTontine(parseInt(membreId), type, invitationCode)

            logger.info('Accès à la tontine effectué avec succès', {
                tontineId: result.tontine?.id,
                membreId,
                action: type,
                accessedBy: req.user ? `${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'System'
            })

            sendResponse(res, 200, 'Votre requête a été traitée avec succès', result)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de l\'accès à la tontine', [error.message])
        }
    }

    async updateStatusTontineAdmin(req: Request, res: Response) {
        const { tontineId } = req.params
        const { status } = req.body
        try {
            if (!req.user) {
                throw new Error("Veuillez vous connecter")
            }

            await tontineService.updateStatusTontineAdmin(
                parseInt(tontineId),
                status
            ) 

            logger.info('Status de la tontine mis à jour par un admin', {
                tontineId,
                updatedBy: req.user ? `${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'System'
            })

            sendResponse(res, 200, 'Status de la tontine mis à jour')
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors du changement de status de la tontine', [error.message])
        }
    }

    async getCotisationsTontine(req: Request, res: Response) {
        const { statutPaiement, membreId } = req.query
        const { tontineId } = req.params
        try {
            if (!tontineId) {
                sendError(res, 401, "Veuillez fournir l'Id de la tontine")
            }

            const cotisations = await tontineService.getCotisationsTontine(
                parseInt(tontineId),
                parseInt(membreId as string),
                statutPaiement as 'VALIDATED' | 'PENDING' | 'REJECTED'
            )

            sendResponse(res, 200, "Cotisations récupérées avec succès", cotisations)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération des cotisations de la tontine', [error.message])
        }
    }

    async getPenalitesTontine(req: Request, res: Response) {
        const { statut, membreId, tontineId, type } = req.query
        try {
            
            const penalites = await tontineService.getPenalitesTontine(
                parseInt(tontineId as string),
                parseInt(membreId as string),
                statut as 'PAID' | 'UNPAID',
                type as 'ABSENCE' | 'RETARD' | 'AUTRE'
            )

            sendResponse(res, 200, "Pénalités récupérées avec succès", penalites)
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération des pénalités de la tontine', [error.message])
        }
    }

    async relancerMembre(req: Request, res: Response) {
        try {
            const { cotisationId } = req.params;
            
            const cotisation = await tontineService.relancerMembreCotisation(
                parseInt(cotisationId)
            );

            logger.info("Relance des membres de la tontine", {
                tontineId: cotisation?.tontineId,
                user: `User ID : ${req?.user?.id} - ${req?.user?.firstname} ${req?.user?.lastname}`
            })

            sendResponse(res, 200, 'Relance effectuée avec succès')
        } catch (error: any) {
            sendError(res, 500, 'Échec de la relance', [error.message])
        }
    }

    async depositAccountSequestre(req: Request, res: Response) {
        try {
            const { tontineId } = req.params;
            const { amount } = req.body;
            
            const account = await tontineService.updateSequestreAccount(
                Number(tontineId),
                Number(amount),
                req.user!.id,
                'DEPOSIT'
            )

            logger.info("Dépot effectué sur un compte séquestre", {
                accountId: account.id,
                adminId: `Admin ID : ${req?.user?.id} - ${req?.user?.firstname} ${req?.user?.lastname}`
            })

            sendResponse(res, 200, 'Dépot effectuée avec succès', account)
        } catch (error: any) {
            sendError(res, 500, 'Échec de crédit du compte séquestre', [error.message])
        }
    }

    async withdrawalAccountSequestre(req: Request, res: Response) {
        try {
            const { tontineId } = req.params;
            const { amount } = req.body;
            
            const account = await tontineService.updateSequestreAccount(
                Number(tontineId),
                Number(amount),
                req.user!.id,
                'WITHDRAWAL'
            )

            logger.info("Retrait effectué sur un compte séquestre", {
                accountId: account.id,
                adminId: `Admin ID : ${req?.user?.id} - ${req?.user?.firstname} ${req?.user?.lastname}`
            })

            sendResponse(res, 200, 'Retrait effectué avec succès', account)
        } catch (error: any) {
            sendError(res, 500, 'Échec du débit du compte séquestre', [error.message])
        }
    }
}

export default new TontineController();