import logger from "@config/logger";
import ContactModel from "@models/contact.model";
import contactService from "@services/contactService";
import { sendError, sendResponse } from "@utils/apiResponse";
import { Request, Response } from "express";


class ContactController {
    async synchronizeContacts(req: Request, res: Response) {
        const { contacts } = req.body;
        try {
            if (!contacts || !Array.isArray(contacts)) {
                return sendError(res, 400, 'Format des données invalide');
            }
            if (!req.user || !req.user.id) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            const userId = req.user.id;

            // Formater pour bulkCreate
            const contactsParsed = contacts as ContactModel[];
            const formatted = contactsParsed.map(c => ({
                userId,
                name: c.name,
                phone: c.phone
            }));

            const result = await contactService.synchronizeContacts(formatted, userId)

            logger.info(`Contacts de ${req.user.firstname} ${req.user.lastname} synchronisés`);
            
            sendResponse(res, 200, 'Contacts synchronisés avec succès', { 
                success: true,
                contacts: result
            });
        } catch (error: any) {
            logger.error('Erreur sync contacts :', error);
            sendError(res, 500, 'Échec synchronisation des contacts', [error.message]);
        }
    }

    async getContacts(req: Request, res: Response) {
        const { id } = req.params;
        try {
            if (!id) {
                return sendError(res, 400, 'ID utilisateur manquant');
            }
            if (!req.user || !req.user.id) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            
            const userId = parseInt(id);
            if (isNaN(userId)) {
                return sendError(res, 400, 'ID utilisateur invalide');
            }

            const contacts = await contactService.getContacts(userId);

            logger.info(`Contacts de ${req.user.firstname} ${req.user.lastname} récupérés`);

            sendResponse(res, 200, 'Contacts récupérés avec succès', contacts);
        } catch (error: any) {
            logger.error('Erreur récupération contacts:', error);
            sendError(res, 500, 'Échec récupération des contacts', [error.message]);
        }
    }

    async addContactToFavorites(req: Request, res: Response) {
        const { id } = req.params;
        const { phone } = req.body;
        try {
            if (!id || !phone) {
                return sendError(res, 400, 'Veuillez remplir tous les champs');
            }
            if (!req.user || !req.user.id) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            
            const userId = parseInt(id);
            if (isNaN(userId)) {
                return sendError(res, 400, 'ID utilisateur invalide');
            }

            const contact = await contactService.getContactByPhone(phone);
            if (!contact) {
                return sendError(res, 404, 'Contact non trouvé');
            }

            const isFavorite = await contactService.addContactToFavorites(phone, userId, contact.id);

            logger.info(`Contact ${id} ajouté aux favoris de ${req.user.firstname} ${req.user.lastname}`);

            sendResponse(res, 200, 'Contact ajouté aux favoris avec succès', {
                success: isFavorite,
                contact
            });
        } catch (error: any) {
            logger.error('Erreur ajout contact aux favoris:', error);
            sendError(res, 500, 'Échec ajout contact aux favoris', [error.message]);
        }
    }

    async removeContactFromFavorites(req: Request, res: Response) {
        const { id } = req.params;
        const { phone } = req.body;
        try {
            if (!id || !phone) {
                return sendError(res, 400, 'Veuillez remplir tous les champs');
            }
            if (!req.user || !req.user.id) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            
            const userId = parseInt(id);
            if (isNaN(userId)) {
                return sendError(res, 400, 'ID utilisateur invalide');
            }

            const contact = await contactService.getContactByPhone(phone);
            if (!contact) {
                return sendError(res, 404, 'Contact non trouvé');
            }

            const isRemoved = await contactService.removeContactFromFavorites(contact.id, userId);
            
            logger.info(`Contact ${contact.phone} supprimé des favoris de ${req.user.firstname} ${req.user.lastname}`);

            sendResponse(res, 200, 'Contact supprimé des favoris avec succès', {
                success: isRemoved
            });
        } catch (error: any) {
            logger.error('Erreur suppression contact des favoris:', error);
            sendError(res, 500, 'Échec suppression contact des favoris', [error.message]);
        }
    }

    async getFavoriteContacts(req: Request, res: Response) {
        const { id } = req.params;
        try {
            if (!id) {
                return sendError(res, 400, 'ID utilisateur manquant');
            }
            if (!req.user || !req.user.id) {
                return sendError(res, 401, 'Utilisateur non authentifié');
            }
            
            const userId = parseInt(id);
            if (isNaN(userId)) {
                return sendError(res, 400, 'ID utilisateur invalide');
            }

            const contacts = await contactService.getFavorites(userId);

            logger.info(`Contacts favoris de ${req.user.firstname} ${req.user.lastname} récupérés`);

            sendResponse(res, 200, 'Contacts favoris récupérés avec succès', contacts);
        } catch (error: any) {
            logger.error('Erreur récupération contacts favoris:', error);
            sendError(res, 500, 'Échec récupération des contacts favoris', [error.message]);
        }
    }
}

export default new ContactController();