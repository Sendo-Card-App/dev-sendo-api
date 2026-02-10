import messageService from "@services/messageService";
import { IMessage, IMessageCreate } from "../types/Conversation";
import { sendError, sendResponse } from "@utils/apiResponse";
import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { sendEmailWithHTML } from "@services/emailService";
import notificationService from "@services/notificationService";
import conversationService from "@services/conversationService";
import logger from "@config/logger";

class MessageController {
    async sendMessage(req: Request, res: Response) {
        const { conversationId, content, senderType } = req.body;
        try {
            if (!req.user) {
                return sendError(res, 401, 'Veuillez vous connecter pour envoyer un message');
            }
            if (!conversationId || !content || !senderType) {
                return sendError(
                    res, 
                    400, 
                    'Veuillez fournir un id de conversation, le type de l\'émetteur et le contenu du message'
                );
            }

            const files = req.files as Express.Multer.File[];

            const message: IMessageCreate = {
                userId: req.user.id,
                conversationId,
                content,
                senderType: senderType || 'CUSTOMER'
            };

            if (files && files.length > 0) {
                let attachments: string[] = []
                files.map(f => attachments.push(f.path))
                message.attachments = JSON.stringify(attachments)
            }

            const messageSaved = await messageService.sendMessage(message);

            if (senderType === 'ADMIN' && messageSaved.conversation && !messageSaved.conversation.adminId) {
                await conversationService.changeStatusConversation(
                    messageSaved.conversation.id,
                    'OPEN',
                    messageSaved.userId
                )
            }

            if (messageSaved.conversation?.adminId === messageSaved.userId) {
                const tokenUser = await notificationService.getTokenExpo(messageSaved.conversation.userId)
                if (tokenUser) {
                    await notificationService.save({
                        title: 'Sendo',
                        userId: messageSaved.conversation.userId,
                        type: 'MESSAGE',
                        content: `${messageSaved.content}`,
                        status: 'SENDED',
                        token: tokenUser.token
                    })
                }

                if (messageSaved.conversation?.user?.email) {
                    sendEmailWithHTML(
                        messageSaved.conversation.user.email,
                        'Nouvelle réponse de SENDO',
                        `<div><p>Un nouveau message vient d'etre envoyé dans votre conversation</p>
                        <p>ID de la conversation :</p> <b>${messageSaved.conversation.id}</b>
                        <p>Date d'envoi :</p> <b>${messageSaved.createdAt}</b>
                        <p>Envoyé par :</p> <b>${messageSaved.conversation.admin?.firstname} ${messageSaved.conversation.admin?.lastname}</b>
                        <p>contenu :</p> <b>${messageSaved.content}</b></div>
                        `
                    );
                }
            } else if (messageSaved.conversation?.userId === messageSaved.userId) {
                if (messageSaved.conversation.admin?.email) {
                    sendEmailWithHTML(
                        messageSaved.conversation.admin.email,
                        'Nouveau message client',
                        `<div><p>Un nouveau message vient d'etre envoyé dans une conversation</p>
                        <p>ID de la conversation :</p> <b>${messageSaved.conversation.id}</b>
                        <p>Date d'envoi :</p> <b>${messageSaved.createdAt}</b>
                        <p>Envoyé par :</p> <b>${messageSaved.user?.firstname} ${messageSaved.user?.lastname}</b>
                        <p>contenu :</p> <b>${messageSaved.content}</b></div>
                        `
                    );
                }
            }

            logger.info("Message envoyé", {
                messageId: messageSaved.id,
                conversationId: messageSaved.conversationId,
                sender: `${req.user?.firstname} ${req.user?.lastname}`
            });

            sendResponse(res, 201, 'Message envoyé avec succès', messageSaved);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getMessagesByConversation(req: Request, res: Response): Promise<void> {
        try {
            const conversationId = req.params.conversationId;
            if (!conversationId) {
                return sendError(res, 400, 'Veuillez fournir un id de conversation');
            }
            const messages = await messageService.getMessagesByConversation(conversationId);
            sendResponse(res, 200, 'Messages récupérés avec succès', messages);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getMessageById(req: Request, res: Response): Promise<void> {
        try {
            const messageId = req.params.messageId;
            if (!messageId) {
                sendError(res, 400, 'Veuillez fournir un id de message');
            }
            const message = await messageService.getMessageById(messageId);
            if (!message) {
                sendError(res, 404, 'Message non trouvé');
            }

            sendResponse(res, 200, 'Message récupéré avec succès', message);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async updateMessage(req: Request, res: Response): Promise<void> {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            sendError(res, 400, 'Erreur de validation', {details: errors.array()});
        }

        try {
            const messageId = req.params.messageId;
            const updates: Partial<IMessage> = req.body;
            const files = req.files as Express.Multer.File[];

            if (files && files.length > 0) {
                let attachments: string[] = []
                files.map(f => attachments.push(f.path))
                updates.attachments = JSON.stringify(attachments)
            }

            const updatedMessage = await messageService.updateMessage(messageId, updates);

            if (!updatedMessage) {
                return sendError(res, 404, 'Message non trouvé');
            }

            // Message modifié par CUSTOMER donc notifier l'ADMIN
            if (updatedMessage && updatedMessage.conversation?.userId === updatedMessage.userId) {
                if (updatedMessage.conversation.admin?.email) {
                    sendEmailWithHTML(
                        updatedMessage.conversation.admin.email,
                        'Message modifié par un client',
                        `<div><p>Un message vient d'être modifié dans une conversation</p>
                        <p>ID de la conversation :</p> <b>${updatedMessage.conversation.id}</b>
                        <p>Date de modification :</p> <b>${updatedMessage.updatedAt}</b>
                        <p>Envoyé par :</p> <b>${updatedMessage.user?.firstname} ${updatedMessage.user?.lastname}</b>
                        <p>contenu :</p> <b>${updatedMessage.content}</b></div>
                        `
                    );
                }
            } else if (updatedMessage && updatedMessage.conversation?.adminId === updatedMessage.userId) {
                // Message modifié par ADMIN donc notifier le CUSTOMER
                if (updatedMessage.conversation?.user?.email) {
                    sendEmailWithHTML(
                        updatedMessage.conversation.user.email,
                        'Message modifié envoyé par SENDO',
                        `<div><p>Un message modifié par SENDO dans votre conversation</p>
                        <p>ID de la conversation :</p> <b>${updatedMessage.conversation.id}</b>
                        <p>Date de modification :</p> <b>${updatedMessage.updatedAt}</b>
                        <p>Envoyé par :</p> <b>${updatedMessage.conversation.admin?.firstname} ${updatedMessage.conversation.admin?.lastname}</b>
                        <p>contenu :</p> <b>${updatedMessage.content}</b></div>
                        `
                    );
                }
            }

            logger.info("Message mis à jour", {
                messageId: updatedMessage.id,
                conversationId: updatedMessage.conversationId,
                updater: `${req.user?.firstname} ${req.user?.lastname}`
            });

            sendResponse(res, 200, 'Message mis à jour avec succès', updatedMessage);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async deleteMessage(req: Request, res: Response): Promise<void> {
        try {
            const messageId = req.params.messageId;
            if (!messageId) {
                sendError(res, 400, 'Veuillez fournir un id de message');
            }

            const deleted = await messageService.deleteMessage(messageId, req.user?.id ?? 0);
            if (!deleted) {
                sendError(res, 404, 'Message non trouvé');
                return
            }

            logger.info("Message supprimé", {
                messageId,
                deleter: req.user ? `ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'Système'
            });

            sendResponse(res, 200, 'Message supprimé avec succès', {});
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async uploadFilesMessage(req: Request, res: Response) {
        try {
            const files = req.files as Express.Multer.File[];
            if (!files || files.length === 0) {
                return sendError(res, 400, 'Aucun fichier téléchargé');
            }

            const filePaths = files.map(file => file.path);
            sendResponse(res, 200, 'Fichiers téléchargés avec succès', filePaths);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }
}

export default new MessageController();