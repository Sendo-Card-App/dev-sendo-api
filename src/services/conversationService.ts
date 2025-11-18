import ConversationModel from "@models/conversation.model";
import { IConversationCreate } from "../types/Conversation";
import UserModel from "@models/user.model";
import { TypesStatusConversation } from "@utils/constants";

class ConversationService {
    async createConversation(conversation: IConversationCreate) {
        return ConversationModel.create(conversation)
    }

    async getUserConversations(userId: number) {
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
            order: [['updatedAt', 'DESC']]
        });

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
            order: [['updatedAt', 'DESC']]
        });

        return result;
    }
    
    async getConversationById(id: string) {
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
            ]
        });

        return conversation;
    }
}

export default new ConversationService();