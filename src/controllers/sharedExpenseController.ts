import logger from "@config/logger";
import sharedExpenseService from "@services/sharedExpenseService";
import { SharedExpenseCreate } from "../types/SharedExpense";
import { sendError, sendResponse } from "@utils/apiResponse";
import { Request, Response } from "express";
import { PaginatedData } from "../types/BaseEntity";
import { sendGlobalEmail, sendSharedExpenseClose, sendSharedExpenseCloseToParticipants, sendSharedExpenseCreatedOrUpdated, sendSharedExpenseCreatedToPaticipants, sendSharedExpensePay, sendSharedExpensePayToInitiator } from "@services/emailService";
import ParticipantSharedExpenseModel from "@models/participant-shared-expense.model";
import UserModel from "@models/user.model";
import SharedExpenseModel from "@models/shared-expense.model";

class SharedExpenseController {
    async createExpense(req: Request, res: Response) {
        const { 
            totalAmount, 
            description, 
            participants, 
            limitDate, 
            includeMyself,
            currency,
            methodCalculatingShare
        } = req.body;
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            if (!totalAmount || !description || !participants || !limitDate) {
                return sendError(res, 403, 'Veuillez fournir tous les champs');
            }
            if (participants && !Array.isArray(participants)) {
                return sendError(res, 403, 'Format des participants incorrect');
            }
            const expenseCreate: SharedExpenseCreate = {
                totalAmount, 
                description, 
                participants,
                userId: req.user?.id,
                currency,
                limitDate: new Date(limitDate),
                includeMyself: Boolean(includeMyself) || false,
                methodCalculatingShare: methodCalculatingShare || 'auto'
            }
            const expense = await sharedExpenseService.createExpense(expenseCreate);

            logger.info('Dépense partagée créée avec succès', {
                id: expense.sharedExpense.id,
                initiator: expense.sharedExpense.initiator?.firstname +' '+ expense.sharedExpense.initiator?.lastname,
                amount: expense.sharedExpense.totalAmount
            })

            //Notifier par mail l'initiateur de la demande partagée
            await sendSharedExpenseCreatedOrUpdated(expense.initiator.email, expense.sharedExpense, 'Create')

            // notifier tous les participants à la demande partagée
            expense.participants.map(async p => {
                await sendSharedExpenseCreatedToPaticipants(p.user?.email ?? '', expense.sharedExpense, p)
            })

            sendResponse(res, 201, 'Dépense partagée créée avec succès', expense)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async getExpenseById(req: Request, res: Response) {
        const { idExpense } = req.params;
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            if (!idExpense) {
                return sendError(res, 403, 'Veuillez fournir l\'ID de la dépense partagée');
            }
            const expense = await sharedExpenseService.getExpenseById(Number(idExpense));
            if (!expense) {
                return sendError(res, 404, 'Dépense partagée non trouvée');
            }
            sendResponse(res, 200, 'Dépense partagée récupérée avec succès', expense);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getAllExpenses(req: Request, res: Response) {
        const { page, limit, startIndex, startDate, endDate, status } = res.locals.pagination;
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            const expenses = await sharedExpenseService.getAllExpenses(
                Number(limit), 
                Number(startIndex), 
                status as 'PENDING' | 'COMPLETED' | 'CANCELLED',
                startDate as string, 
                endDate as string
            );
            const totalPages = Math.ceil(expenses.count / limit);
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: expenses.count,
                items: expenses.rows
            };

            sendResponse(res, 200, 'Dépenses partagées récupérées avec succès', responseData);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async payExpense(req: Request, res: Response) {
        const { idExpense } = req.params;
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            if (!idExpense) {
                return sendError(res, 403, 'Veuillez fournir l\'ID de la dépense partagée');
            }
            const expense = await sharedExpenseService.payExpense(Number(idExpense), req.user.id);
            if (!expense) {
                return sendError(res, 404, 'Dépense partagée non trouvée ou déjà payée');
            }

            const participant = await ParticipantSharedExpenseModel.findOne({
                where: {
                    sharedExpenseId: Number(idExpense),
                    userId: req.user.id
                },
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'email']
                }]
            });

            const sharedExpense = await SharedExpenseModel.findByPk(Number(idExpense), {
                include: [
                    { 
                        model: UserModel, 
                        as: 'initiator', 
                        attributes: ['id', 'firstname', 'lastname', 'email'] 
                    }
                ]
            });

            //Envoyer un email de notification au participant
            if (participant && participant.user && sharedExpense && sharedExpense.initiator) {
                await sendSharedExpensePay(
                    participant.user, 
                    false, 
                    sharedExpense.description,
                    participant
                )
                
                //Envoyer un email de notification à l'initiateur de la dépense
                await sendSharedExpensePayToInitiator(
                    sharedExpense.initiator,
                    false,
                    participant,
                    participant.user,
                    sharedExpense.description
                )
            }

            logger.info('Dépense partagée payée avec succès', {
                id: expense.id,
                payeur: participant?.user?.firstname + ' ' + participant?.user?.lastname,
                amount: participant?.part
            })

            sendResponse(res, 200, 'Dépense partagée payée avec succès', expense);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async deleteExpense(req: Request, res: Response) {
        const { idExpense } = req.params;
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            if (!idExpense) {
                return sendError(res, 403, 'Veuillez fournir l\'ID de la dépense partagée');
            }

            const sharedExpense = await SharedExpenseModel.findByPk(Number(idExpense), {
                include: [
                    {
                        model: UserModel,
                        as: 'initiator',
                        attributes: ['firstname', 'lastname', 'email', 'id']
                    },
                    {
                        model: ParticipantSharedExpenseModel,
                        as: 'participants',
                        include: [{
                            model: UserModel,
                            as: 'user',
                            attributes: ['firstname', 'lastname', 'email']
                        }]
                    }
                ]
            });
            
            // On notifie l'initiateur du partage
            if (sharedExpense && sharedExpense.initiator) {
                await sendSharedExpenseClose(sharedExpense.initiator)
            }
    
            // On notifie tous les participants à la dépense
            if (sharedExpense && sharedExpense.participants && sharedExpense.participants?.length > 0) {
                sharedExpense.participants.map(async p => {
                    if (p.user) {
                        await sendSharedExpenseCloseToParticipants(sharedExpense, p.user)
                    }
                })
            }

            const expense = await sharedExpenseService.closeExpense(Number(idExpense), req.user.id);
            if (!expense) {
                return sendError(res, 404, 'Dépense partagée non trouvée ou déjà annulée', {expense});
            }

            logger.info('Dépense partagée annulée avec succès', {
                id: sharedExpense?.id,
                user: `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`,
            })

            sendResponse(res, 200, 'Dépense partagée annulée avec succès');
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async deleteAdminExpense(req: Request, res: Response) {
        const { idExpense } = req.params;
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            if (!idExpense) {
                return sendError(res, 403, 'Veuillez fournir l\'ID de la dépense partagée');
            }
            if (req.user.role?.name === 'CUSTOMER') {
                return sendError(res, 400, "Vous n'êtes pas autorisé à effectuer cette action");
            }

            const sharedExpense = await SharedExpenseModel.findByPk(Number(idExpense), {
                include: [
                    {
                        model: UserModel,
                        as: 'initiator',
                        attributes: ['firstname', 'lastname', 'email', 'id']
                    },
                    {
                        model: ParticipantSharedExpenseModel,
                        as: 'participants',
                        include: [{
                            model: UserModel,
                            as: 'user',
                            attributes: ['firstname', 'lastname', 'email']
                        }]
                    }
                ]
            });
            // On notifie l'initiateur du partage
            if (sharedExpense && sharedExpense.initiator) {
                await sendSharedExpenseClose(sharedExpense.initiator)
            }
    
            // On notifie tous les participants à la dépense
            if (sharedExpense && sharedExpense.participants && sharedExpense.participants?.length > 0) {
                sharedExpense.participants.map(async p => {
                    if (p.user) {
                        await sendSharedExpenseCloseToParticipants(sharedExpense, p.user)
                    }
                })
            }

            const expense = await sharedExpenseService.closeAdminExpense(Number(idExpense));
            if (!expense) {
                return sendError(res, 404, 'Dépense partagée non trouvée ou déjà annulée', {expense});
            }

            logger.info('Dépense partagée annulée avec succès par un admin', {
                id: sharedExpense?.id,
                user: `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`
            })

            sendResponse(res, 200, 'Dépense partagée annulée avec succès');
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getUserSharedExpenses(req: Request, res: Response) {
        const { userId } = req.params
        try {
            if (!userId) throw new Error("Veuillez fournir le userId")
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            if (req.user.id !== Number(userId)) {
                return sendError(res, 403, 'Accès refusé');
            }
            const expenses = await sharedExpenseService.listUserSharedExpense(Number(userId))
            sendResponse(res, 200, 'Liste des dépenses partagées créé par vous', expenses)
        } catch (error) {
            sendError(res, 500, 'Erreur serveur', [error instanceof Error ? error.message : String(error)]);
        }
    }

    async getSharedExpenseIncludeMe(req: Request, res: Response) {
        const { userId } = req.params
        try {
            if (!userId) {
                throw new Error("Veuillez fournir le userId et sharedExpenseId")
            }
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            if (req.user.id !== Number(userId)) {
                return sendError(res, 403, 'Accès refusé');
            }
            const participants = await sharedExpenseService.listSharedExpenseIncludeMe(Number(userId))
            sendResponse(res, 200, 'Liste de toutes les dépenses partagées dont tu fais partie', participants)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async updateExpense(req: Request, res: Response) {
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }

            const expenseId = Number(req.params.id);
            if (isNaN(expenseId)) {
                return sendError(res, 400, 'ID de dépense invalide');
            }

            const {
                totalAmount,
                description,
                participants,
                limitDate,
                includeMyself,
                currency,
                methodCalculatingShare
            } = req.body;

            // Validation minimale
            if (
                totalAmount !== undefined && (typeof totalAmount !== 'number' || totalAmount <= 0)
            ) {
                return sendError(res, 403, 'Montant total invalide');
            }
            if (participants && !Array.isArray(participants)) {
                return sendError(res, 403, 'Format des participants incorrect');
            }

            // Préparer les données de mise à jour
            const updateData = {
                totalAmount,
                description,
                limitDate: limitDate ? new Date(limitDate) : undefined,
                currency,
                methodCalculatingShare,
                participants,
                includeMyself: Boolean(includeMyself)
            };

            // Appeler le service de mise à jour avec recalcul
            const updatedExpense = await sharedExpenseService.updateExpenseWithRecalculation(
                expenseId,
                updateData
            );

            logger.info('Dépense partagée mise à jour avec succès', {
                id: updatedExpense.id,
                initiator: updatedExpense.initiator?.firstname + ' ' + updatedExpense.initiator?.lastname,
                amount: updatedExpense.totalAmount
            });

            const initiatorUser = await UserModel.findByPk(updatedExpense.userId);
            //Notifier par mail l'initiateur de la demande partagée
            if (initiatorUser) {
                await sendSharedExpenseCreatedOrUpdated(initiatorUser.email, updatedExpense, 'Update')
            }

            // notifier tous les participants à la demande partagée
            if (updatedExpense.participants) {
                updatedExpense.participants.map(async p => {
                    await sendSharedExpenseCreatedToPaticipants(p.user?.email ?? '', updatedExpense, p)
                })
            }

            sendResponse(res, 200, 'Dépense partagée mise à jour avec succès', updatedExpense);
        } catch (error: any) {
            logger.error('Erreur lors de la mise à jour de la dépense partagée', { error });
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async cancelExpense(req: Request, res: Response) {
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }

            const expenseId = Number(req.params.id);
            if (isNaN(expenseId)) {
                return sendError(res, 400, 'ID de dépense invalide');
            }

            const { cancelReason } = req.body;
            if (!cancelReason || typeof cancelReason !== 'string' || cancelReason.trim() === '') {
                return sendError(res, 400, 'Une raison d\'annulation doit être fournie');
            }

            const cancelledExpense = await sharedExpenseService.cancelSharedExpense(expenseId, cancelReason);

            //Notifier par mail l'initiateur de la demande partagée
            if (cancelledExpense.initiator && cancelledExpense.initiator.email) {
                await sendGlobalEmail(
                    cancelledExpense.initiator.email,
                    "Annulation d'un partage entre amis",
                    `<h3>Annulation d'un partage entre amis</h3>
                    <p>Vous venez d'annuler cette demande avec pour raison : <b>${cancelReason}<b></p>
                    <ul>
                        <li>Méthode de calcul : ${cancelledExpense.methodCalculatingShare}</li>
                        <li>Votre part : ${cancelledExpense.initiatorPart} FCFA</li>
                        <li>Date limite de paiement : ${cancelledExpense.limitDate}</li>
                        <li>Montant total de la dépense : ${cancelledExpense.totalAmount} FCFA</li>
                    </ul>
                    `
                )
            }

            // notifier tous les participants à la demande partagée
            (cancelledExpense.participants ?? []).map(async p => {
                await sendGlobalEmail(
                    p.user?.email ?? '',
                    "Annulation d'un partage entre amis",
                    `<h3>Annulation d'un partage entre amis</h3>
                    <p>Cette demande vient d'etre annulée avec pour raison : <b>${cancelReason}<b></p>
                    <ul>
                        <li>Méthode de calcul : ${cancelledExpense.methodCalculatingShare}</li>
                        <li>Votre part : ${cancelledExpense.initiatorPart} FCFA</li>
                        <li>Date limite de paiement : ${cancelledExpense.limitDate}</li>
                        <li>Montant total de la dépense : ${cancelledExpense.totalAmount} FCFA</li>
                    </ul>
                    `
                )
            })

            logger.info('Dépense partagée annulée avec succès', {
                id: cancelledExpense.id,
                user: `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`,
                reason: cancelReason
            })

            sendResponse(res, 200, 'Dépense annulée avec succès', cancelledExpense);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async cancelPaymentExpense(req: Request, res: Response) {
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }

            const participantId = Number(req.params.participantId);
            if (isNaN(participantId)) {
                return sendError(res, 400, 'ID du participant invalide');
            }

            const cancelledParticipantExpense = await sharedExpenseService.cancelPaymentSharedExpense(participantId);

            //Notifier par mail l'initiateur de la demande partagée
            const sharedExpense = await SharedExpenseModel.findByPk(cancelledParticipantExpense.sharedExpenseId, {
                include: [
                    {
                        model: UserModel,
                        as: 'initiator',
                        attributes: ['firstname', 'lastname', 'email', 'id']
                    }
                ]
            });

            if (sharedExpense!.initiator && sharedExpense!.initiator.email) {
                await sendGlobalEmail(
                    sharedExpense!.initiator.email,
                    "Refus de la demande",
                    `<h3>Refus de la demande</h3>
                    <p>${cancelledParticipantExpense.user!.firstname} a refusé de payer votre partage entre amis</p>
                    `
                )
            }

            logger.info('Dépense partagée refusée avec succès', {
                sharedExpenseId: sharedExpense!.id,
                user: `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`
            })

            sendResponse(res, 200, 'Dépense refusée avec succès', cancelledParticipantExpense);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async updateStatusExpense(req: Request, res: Response) {
        try {
            if (!req.user) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }

            const expenseId = Number(req.params.id);
            if (isNaN(expenseId)) {
                return sendError(res, 400, 'ID de dépense invalide');
            }

            const { status } = req.body;
            if (!status) {
                return sendError(res, 400, 'Un status doit être fournie');
            }

            const cancelledExpense = await sharedExpenseService.updateStatusSharedExpense(
                expenseId, 
                status as 'PENDING' | 'COMPLETED'
            );

            //Notifier par mail l'initiateur de la demande partagée
            if (cancelledExpense.initiator && cancelledExpense.initiator.email) {
                await sendGlobalEmail(
                    cancelledExpense.initiator.email,
                    "Changement status d'un partage entre amis",
                    `<h3>Changement status d'un partage entre amis</h3>
                    <p>Vous venez de modifier le status de cette demande : <b>${cancelledExpense.description}</b></p>
                    <p>Nouveau status : <b>${cancelledExpense.status}</b></p>
                    `
                )
            }

            // notifier tous les participants à la demande partagée
            (cancelledExpense.participants ?? []).map(async p => {
                await sendGlobalEmail(
                    p.user?.email ?? '',
                    "Changement status d'un partage entre amis",
                    `<h3>Changement status d'un partage entre amis</h3>
                    <p>Le status de cette demande <b>${cancelledExpense.description}</b> vient d'être modifié</p>
                    <p>Nouveau status : <b>${cancelledExpense.status}</b></p>
                    `
                )
            })

            logger.info('Status dépense modifié avec succès', {
                id: cancelledExpense.id,
                user: `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`,
                newStatus: status
            })

            sendResponse(res, 200, 'Status dépense modifié avec succès', cancelledExpense);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }
}

export default new SharedExpenseController