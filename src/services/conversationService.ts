import ConversationModel from "@models/conversation.model";
import { IConversationCreate } from "../types/Conversation";
import UserModel from "@models/user.model";
import { TypesStatusConversation } from "@utils/constants";
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

class ConversationService {
    async createConversation(conversation: IConversationCreate) {
        return ConversationModel.create(conversation)
    }

    async getUserConversations(userId: number) {
        const cacheKey = `userConversations:${userId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const conversations = await ConversationModel.findAll({
            where: { userId },
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'email']
                },
                {
                    model: UserModel,
                    as: 'admin',
                    attributes: ['id', 'firstname', 'lastname', 'email']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        await redisClient.set(cacheKey, JSON.stringify(conversations), { EX: REDIS_TTL });
        return conversations;
    }

    async changeStatusConversation(id: string, status: TypesStatusConversation, adminId: number) {
        try {
            const [affectedCount] = await ConversationModel.update(
                { status, adminId },
                { where: { id } }
            );
            if (affectedCount === 0) {
                throw new Error('Conversation not found');
            }
        } catch (error: any) {
            throw new Error('Error closing conversation: ' + error.message);
        }
    }

    async getAllConversations(limit: number, startIndex: number, status: string) {
        const cacheKey = `allConversations:${limit}:${startIndex}:${status}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const where: Record<string, any> = {};
        if (status) where.status = status;

        const result = await ConversationModel.findAndCountAll({
            limit,
            offset: startIndex,
            where,
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'email']
                },
                {
                    model: UserModel,
                    as: 'admin',
                    attributes: ['id', 'firstname', 'lastname', 'email']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }
    
    async getConversationById(id: string) {
        const cacheKey = `conversationById:${id}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const conversation = await ConversationModel.findByPk(id, {
            include: [
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'email']
                },
                {
                    model: UserModel,
                    as: 'admin',
                    attributes: ['id', 'firstname', 'lastname', 'email']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        if (conversation) {
            await redisClient.set(cacheKey, JSON.stringify(conversation), { EX: REDIS_TTL });
        }

        return conversation;
    }
}

export default new ConversationService();