import logger from "@config/logger";
import pubService from "@services/pubService";
import { PaginatedData } from "../types/BaseEntity";
import { sendError, sendResponse } from "@utils/apiResponse";
import { Request, Response } from "express";


class PubController {
    async getPubs(req: Request, res: Response) {
        const { page, limit, startIndex } = res.locals.pagination;
        try {
            const pubs = await pubService.getPubs(limit, startIndex);

            const totalPages = Math.ceil(pubs.count / limit);
                              
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: pubs.count,
                items: pubs.rows
            };
            
            logger.info("Publicités récupérées");
            
            sendResponse(res, 200, 'Publicités récupérées avec succès', responseData);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getPubById(req: Request, res: Response) {
        const { id } = req.params;
        if (!id) {
            return sendError(res, 400, 'ID de la publicité requis');
        }
        try {
            const pub = await pubService.getPubById(parseInt(id));
            if (!pub) {
                return sendError(res, 404, 'Publicité introuvable');
            }
            
            logger.info("Publicité récupérée", { id: pub.id });
            
            sendResponse(res, 200, 'Publicité récupérée avec succès', pub);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async createPub(req: Request, res: Response) {
        const { name, price, description, link } = req.body;
        
        try {
            const file = req.file as Express.Multer.File;
            if (!file) {
                throw new Error('Aucun document fourni');
            }
            console.log('body pub file : ', file);
            const pub = await pubService.createPub({ 
                name, 
                imageUrl: file.path, 
                price, 
                description, 
                link 
            });
            
            logger.info("Publicité créée", { id: pub.id, user: req.user?.id });
            
            sendResponse(res, 201, 'Publicité créée avec succès', pub);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async updatePub(req: Request, res: Response) {
        const { id } = req.params;
        const { name, imageUrl, price, description, link, isActive } = req.body;
        if (!id || !imageUrl) {
            return sendError(res, 400, 'ID de la publicité et URL de l\'image requis');
        }
        try {
            const pub = await pubService.updatePub({ id: parseInt(id), name, imageUrl, price, description, link, isActive });
            
            logger.info("Publicité modifiée", { id: pub.id, user: req.user?.id });
            
            sendResponse(res, 200, 'Publicité modifiée avec succès', pub);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async deletePub(req: Request, res: Response) {
        const { id } = req.params;
        if (!id) {
            return sendError(res, 400, 'ID de la publicité requis');
        }
        try {
            await pubService.deletePub(parseInt(id));
            
            logger.info("Publicité supprimée", { id });
            
            sendResponse(res, 204, 'Publicité supprimée avec succès');
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }
}

const controller = new PubController();
export default controller;