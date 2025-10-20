import notificationService from '@services/notificationService';
import { PaginatedData } from '../types/BaseEntity';
import { sendError, sendResponse } from '@utils/apiResponse';
import { typesNotification, TypesNotification } from '@utils/constants';
import { Request, Response } from 'express';
import admin from 'firebase-admin'
import logger from '@config/logger';
import Expo from 'expo-server-sdk';

// Créer une instance Expo
const expo = new Expo();

class NotificationController {
    async sendNotification(req: Request, res: Response) {
        const { token, title, body, type } = req.body;

        if (!token || !title || !body || !type) {
            return sendError(res, 403, 'Veuillez fournir tous les éléments');
        }

        if (!req.user || !req.user.id) {
            return sendError(res, 403, 'Utilisateur non authentifié');
        }

        // Vérifier que le token est un token Expo valide
        if (!Expo.isExpoPushToken(token)) {
            return sendError(res, 400, 'Le token fourni n\'est pas un token Expo valide');
        }
        
        // Construire le message Expo
        const messages = [{
            to: token,
            sound: 'default',
            title,
            body,
            data: { type }
        }];

        try {
            // Envoyer la notification via Expo
            const chunks = expo.chunkPushNotifications(messages);
            const tickets = [];

            for (const chunk of chunks) {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
                logger.info("notification envoyée : ", tickets)
            }

            // Sauvegarder la notification dans ta base
            const notification = await notificationService.save({
                title,
                content: body,
                userId: req.user.id,
                status: 'SENDED',
                token,
                type,
            });

            sendResponse(res, 200, 'Notification envoyée avec succès', {
                notification,
                tickets,
            });
        } catch (error: any) {
            logger.error('Erreur lors de l’envoi de la notification via Expo', error);
            sendError(res, 500, 'Erreur lors de l’envoi de la notification', [error.message]);
        }
    }

    async list(req: Request, res: Response) {
        const { page, limit, startIndex, type, status } = res.locals.pagination;

        try {
            const notifications = await notificationService.listByType(type, status, limit, startIndex);
            const totalPages = Math.ceil(notifications.count / limit);
            
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: notifications.count,
                items: notifications.rows
            };

            sendResponse(res, 200, 'Notifications récupérés', responseData);
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération des notifications', [error.message])
        }
    }

    async getNotificationsUser(req: Request, res: Response) {
        const { page, limit, startIndex, type, status } = res.locals.pagination;
        const { userId } = req.params;

        try {
            const notifications = await notificationService.getNotificationsUser(
                parseInt(userId), 
                type, 
                status, 
                limit, 
                startIndex
            )
            const totalPages = Math.ceil(notifications.count / limit);
            
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: notifications.count,
                items: notifications.rows
            };

            sendResponse(res, 200, 'Notifications récupérés', responseData);
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération des notifications des users', [error.message])
        }
    }

    async markedAsRead(req: Request, res: Response) {
        const { id } = req.params;

        try {
            if (!id) {
                return sendError(res, 400, 'Veuillez fournir un ID de notification');
            }

            const notification = await notificationService.markedAsRead(parseInt(id));

            logger.info("Notification marquée comme lue", {
                notification: `${notification.title} - ${notification.content}`,
                user: `${notification.user?.firstname} ${notification.user?.lastname}`
            });
            
            sendResponse(res, 200, 'Notification marquée comme lue', notification);
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la mise à jour de la notification', [error.message]);
        }
    }
}

export default new NotificationController()