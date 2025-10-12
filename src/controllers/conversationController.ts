import conversationService from "@services/conversationService";
import { PaginatedData } from "../types/BaseEntity";
import { sendError, sendResponse } from "@utils/apiResponse";
import { TypesStatusConversation, typesStatusConversation } from "@utils/constants";
import { Request, Response } from "express";
import logger from "@config/logger";

class ConversationController {
    async createConversation(req: Request, res: Response) {
        try {
            if (!req.user) {
                return sendError(res, 401, 'Veuillez vous connecter pour créer une conversation');
            }

            const conversation = {
                userId: req.user.id,
                status: typesStatusConversation['0']
            };

            const conversationSaved = await conversationService.createConversation(conversation);

            logger.info("Conversation créée", {
                conversation: `Conversation ID : ${conversationSaved.id} - Status : ${conversationSaved.status}`,
                user: `User ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`
            });

            sendResponse(res, 201, 'Conversation créée avec succès', conversationSaved)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getUserConversations(req: Request, res: Response) {
        const { userId } = req.params;
        try {
            if (!req.user) {
                return sendError(res, 401, 'Veuillez vous connecter pour voir vos conversations');
            }
            if (!userId) {
                return sendError(res, 400, 'Veuillez fournir un userId');
            }

            const conversations = await conversationService.getUserConversations(parseInt(userId));
            sendResponse(res, 200, 'Conversations récupérées avec succès', conversations)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async changeStatusConversation(req: Request, res: Response) {
        const { conversationId } = req.params;
        const { status } = req.body
        try {
            if (!req.user) {
                return sendError(res, 401, 'Veuillez vous connecter pour modifier une conversation');
            }
            if (!conversationId) {
                return sendError(res, 400, 'Veuillez fournir un id de conversation');
            }

            await conversationService.changeStatusConversation(
                conversationId, 
                status as TypesStatusConversation,
                req.user.id
            );

            logger.info("Status de la conversation modifiée", {
                conversation: `Conversation ID : ${conversationId} - New Status : ${status}`,
                admin: `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}`
            });
            
            sendResponse(res, 200, 'Status de la conversation modifiée avec succès', {})
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getAllConversations(req: Request, res: Response) {
        const { page, limit, startIndex, status } = res.locals.pagination;
        try {
            if (!req.user) {
                return sendError(res, 401, 'Veuillez vous connecter pour voir toutes les conversations');
            }

            const conversations = await conversationService.getAllConversations(limit, startIndex, status);
            const totalPages = Math.ceil(conversations.count / limit);
                  
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: conversations.count,
                items: conversations.rows,
            };
            sendResponse(res, 200, 'Toutes les conversations récupérées avec succès', responseData)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getConversation(req: Request, res: Response) {
        const { conversationId } = req.params;
        
        try {
            if (!conversationId) {
                return sendError(res, 400, 'Veuillez fournir un id de conversation');
            }

            const conversation = await conversationService.getConversationById(conversationId)
            if (!conversation) {
                sendError(res, 404, 'Conversation introuvable')
                return
            }

            sendResponse(res, 200, 'Conversation trouvée', conversation)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }
}

export default new ConversationController();