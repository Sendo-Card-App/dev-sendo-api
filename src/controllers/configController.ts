import logger from "@config/logger";
import configService from "@services/configService";
//import fastForexService from "@services/fastForexService";
import { sendError, sendResponse } from "@utils/apiResponse";
import { Request, Response } from "express";

class ConfigController {
    async create(req: Request, res: Response) {
        const { name, value, description } = req.body;
        if (!name || !value || !description) {
            return sendError(res, 400, 'Tous les champs sont requis');
        }
        try {
            const config = await configService.create({ name, value, description })

            logger.info("Configuration créée", {
                config: `${config.name} - ${config.value}`,
                description: config.description,
                admin: `Admin ID : ${req.user?.id} - ${req.user?.firstname} ${req.user?.lastname}`
            });

            sendResponse(res, 200, 'Configuration créée avec succès', config);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async update(req: Request, res: Response) {
        const { value } = req.body;
        const { id } = req.params;
        if (id === undefined || id === null || value === undefined || value === null) {
            return sendError(res, 400, 'Tous les champs sont requis');
        }
        try {
            const config = await configService.getConfig(parseInt(id));
            if (!config) {
                return sendError(res, 404, 'Configuration introuvable');
            }
            const update = await configService.update(config.name, value);

            logger.info("Configuration modifiée", {
                config: `${config.name} - ${config.value}`,
                description: config.description,
                admin: `Admin ID : ${req.user?.id} - ${req.user?.firstname} ${req.user?.lastname}`
            });
            
            sendResponse(res, 200, 'Configuration modifiée avec succès', update);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async list(req: Request, res: Response) {
        try {
            const configs = await configService.list();
            sendResponse(res, 200, 'Liste de toutes les configurations', configs);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    /*async showCurrencyValue(req: Request, res: Response) {
        const { from, to, amount } = req.query;
        if (!from || !to || !amount) {
            return sendError(res, 400, 'Tous les paramètres sont requis');
        }
        try {
            const fromStr = from as string;
            const toStr = to as string;
            const amountNum = parseFloat(amount as string);
            const response = await fastForexService.getConvert(fromStr, toStr, amountNum);
            sendResponse(res, 200, 'Valeur convertie de la monnaie', response);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getOneValue(req: Request, res: Response) {
        const { from, to  } = req.query;
        if (!from || !to) {
            sendError(res, 400, 'Tous les paramètres sont requis')
        }
        try {
            const fromStr = from as string;
            const toStr = to as string;
            const response = await fastForexService.getOne(fromStr, toStr);
            sendResponse(res, 200, 'Valeur de la monnaie retournée', response)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }

    async getMultiValue(req: Request, res: Response) {
        const { from, to  } = req.query;
        if (!from || !to) {
            sendError(res, 400, 'Tous les paramètres sont requis')
        }
        try {
            const fromStr = from as string;
            const toStr = to as string;
            const response = await fastForexService.getMulti(fromStr, toStr);
            sendResponse(res, 200, 'Valeur de la monnaie retournée', response)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message])
        }
    }*/
}

export default new ConfigController();