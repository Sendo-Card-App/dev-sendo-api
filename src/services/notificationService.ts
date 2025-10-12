import NotificationModel from "@models/notification.model";
import TokenModel from "@models/token.model";
import { TypesNotification } from "@utils/constants";
import axios from 'axios';

export interface NotificationCreate {
    title: string;
    content?: string;
    userId: number;
    status: 'SENDED' | 'NOT_SENDED';
    token: string;
    type: TypesNotification;
}

class NotificationService {
    /**
     * Envoie une notification Expo et sauvegarde la notification en base
     */
    async save(notification: NotificationCreate) {
        try {
            // Récupération du token Expo de l'utilisateur
            const tokenRecord = await this.getTokenExpo(notification.userId);
            if (!tokenRecord) {
                throw new Error('Token Expo introuvable pour cet utilisateur');
            }

            const expoPushToken = tokenRecord.token;

            // Construction du payload Expo
            const payload = {
                to: expoPushToken,
                sound: 'default',
                title: notification.title,
                body: notification.content || '',
                data: {
                    type: notification.type,
                    userId: notification.userId
                }
            };

            // Envoi de la notification via Expo Push API
            const response = await axios.post('https://exp.host/--/api/v2/push/send', payload, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                timeout: 5000
            });

            // Vérification de la réponse
            const status = response.status === 200 ? 'SENDED' : 'NOT_SENDED';

            // Sauvegarde en base
            const savedNotification = await NotificationModel.create({
                title: notification.title,
                content: notification.content,
                userId: notification.userId,
                status,
                token: expoPushToken,
                type: notification.type
            });

            return savedNotification;

        } catch (error: any) {
            // Log de l'erreur
            console.error('Erreur envoi notification Expo:', error.message || error);
        }
    }

    async list(limit: number, startIndex:number) {
        return NotificationModel.findAndCountAll({
            offset: startIndex,
            limit,
            order: [['createdAt', 'DESC']]
        })
    }

    async listByType(
        type: TypesNotification, 
        status: 'SENDED' | 'NOT_SENDED', 
        limit: number, 
        startIndex: number
    ) {
        const where: Record<string, any> = {};
        if (type) {
            where.type = type;
        }
        if (status) {
            where.status = status;
        }

        return NotificationModel.findAndCountAll({
            where,
            offset: startIndex,
            limit,
            order: [['createdAt', 'DESC']]
        })
    }

    async getNotificationsUser(
        userId: number, 
        type: TypesNotification, 
        status: 'SENDED' | 'NOT_SENDED', 
        limit: number, startIndex: number
    ) {
        const where: Record<string, any> = {};
        if (userId) {
            where.userId = userId;
        }
        if (type) {
            where.type = type;
        }
        if (status) {
            where.status = status;
        }
        
        return NotificationModel.findAndCountAll({
            where,
            offset: startIndex,
            limit,
            order: [['createdAt', 'DESC']]
        })
    }

    async markedAsRead(notificationId: number) {
        const notification = await NotificationModel.findByPk(notificationId);
        if (!notification) {
            throw new Error('Notification non trouvée');
        }

        notification.readed = true;
        await notification.save();
        return notification;
    }

    async getTokenExpo(userId: number) {
        return TokenModel.findOne({
            where: {
                tokenType: 'EXPO',
                userId
            },
            attributes: ['token', 'userId']
        })
    }
}

export default new NotificationService()