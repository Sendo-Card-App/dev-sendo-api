import MessageModel from '@models/message.model';
import { IMessage, IMessageCreate } from '../types/Conversation';
import UserModel from '@models/user.model';
import ConversationModel from '@models/conversation.model';
import conversationService from './conversationService';
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

class MessageService {
    async sendMessage(message: IMessageCreate) {
        const conversation = await ConversationModel.findByPk(message.conversationId);
        if (conversation?.status === 'CLOSED') {
            throw new Error('Cette conversation est déjà fermée');
        }
        if (conversation?.status === 'PENDING') {
            conversation.status = 'OPEN'
            await conversation.save()
        }

        const messageCreated = await MessageModel.create(message);

        const messageFound = await MessageModel.findByPk(messageCreated.id, {
            include: [{
                model: ConversationModel,
                as: 'conversation',
                include: [
                    {
                        model: UserModel,
                        as: 'admin',
                        attributes: ['id', 'firstname', 'lastname', 'email', 'phone']
                    },
                    {
                        model: UserModel,
                        as: 'user',
                        attributes: ['id', 'firstname', 'lastname', 'email', 'phone']
                    }
                ]
            }]
        });

        // Stringify des attachments
        let formattedMessage: any
        if (messageFound) {
            formattedMessage = {
                ...messageFound.get({ plain: true }),
                attachments: messageFound.attachments ? JSON.stringify(messageFound.attachments) : null
            };
        } else {
            formattedMessage = {
                ...messageCreated.get({ plain: true }),
                attachments: messageCreated.attachments ? JSON.stringify(messageCreated.attachments) : null
            };
        }

        return formattedMessage as MessageModel
    }

    async getMessagesByConversation(conversationId: string): Promise<MessageModel[]> {
        /*const cacheKey = `messagesByConversation:${conversationId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const conversation = await conversationService.getConversationById(conversationId);
        if (!conversation) throw new Error("Conversation introuvable");
        if (conversation.status === 'CLOSED') throw new Error("Conversation archivée");

        const messages = await MessageModel.findAll({
            where: { conversationId },
            order: [['createdAt', 'DESC']],
            include: [{
                model: UserModel,
                as: 'user',
                attributes: ['id', 'firstname', 'lastname', 'email', 'phone']
            }],
            limit: 30
        });

        const response = messages.map(message => ({
            ...message.get({ plain: true }),
            attachments: message.attachments ? JSON.parse(message.attachments) : []
        })) as MessageModel[];

        //await redisClient.set(cacheKey, JSON.stringify(response), { EX: REDIS_TTL });
        return response;
    }

    async getMessageById(id: string): Promise<MessageModel | null> {
        /*const cacheKey = `messageById:${id}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const message = await MessageModel.findByPk(id, {
            include: [{
                model: UserModel,
                as: 'user',
                attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
            }]
        });

        if (!message) return null;

        const formattedMessage = {
            ...message.get({ plain: true }),
            attachments: message.attachments ? JSON.parse(message.attachments) : []
        };

        // Marquer comme lu
        message.read = true;
        await message.save();

        //await redisClient.set(cacheKey, JSON.stringify(formattedMessage), { EX: REDIS_TTL });
        return formattedMessage as MessageModel;
    }

    async updateMessage(id: string, updates: Partial<IMessage>) {
        try {
            await MessageModel.update(updates, {
                where: { id }
            })

            const message = await MessageModel.findByPk(id);
            
            // Retourne le message avec attachments parsés
            return {
                ...message?.get({ plain: true }),
                attachments: message?.attachments ? JSON.parse(message.attachments) : []
            } as MessageModel;
        } catch (error: any) {
            throw new Error(`Erreur lors de la mise à jour du message: ${error.message}`);
        }
    }

    async deleteMessage(id: string, userId: number): Promise<boolean> {
        try {
            const message = await MessageModel.findByPk(id);

            if (!message) return false;
            if (message.userId !== userId) throw new Error("Ce message ne vous appartient pas")

            await message.destroy();
            return true;
        } catch (error: any) {
            throw new Error(`Erreur lors de la suppression du message: ${error.message}`);
        }
    }
}

export default new MessageService();