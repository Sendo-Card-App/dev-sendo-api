import RequestModel from "@models/request.model"
import WalletModel from "@models/wallet.model";
import { typesConfig, typesDemande, TypesDemande, typesStatusDemande, TypesStatusDemande } from "@utils/constants"
import configService from "./configService";
import UserModel from "@models/user.model";
import sequelize from '@config/db';
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

export interface RequestCreate {
    type: TypesDemande;
    description?: string;
    status: TypesStatusDemande;
    userId: number;
    reviewedById?: number;
    url: string;
    
}

export interface UpdateStatusRequest {
    status: TypesStatusDemande;
    reviewedById: number;
}

class DemandeService {
    async askRequest(request: RequestCreate) {
        const transaction = await sequelize.transaction();
        try {
            if (request.type === typesDemande['0']) {
                const config = await configService.getConfigByName(typesConfig['13'])
                if (!config) throw new Error('Configuration introuvable');

                const isRequestExists = await RequestModel.findOne({
                    where: {
                        userId: request.userId,
                        type: typesDemande['0'],
                        status: typesStatusDemande['1']
                    },
                    transaction
                });
                if (isRequestExists) throw new Error('Une demande de NIU est déjà en cours');

                const wallet = await WalletModel.findOne({
                    where: { userId: request.userId },
                    transaction
                });

                if (!wallet) throw new Error('Portefeuille introuvable');
                if (wallet.balance < config.value) throw new Error('Solde insuffisant');

                await wallet.decrement('balance', { by: config.value, transaction });
                await transaction.commit();
            }
            return RequestModel.create(request)
        } catch (error) {
            await transaction.rollback();
            throw error;
        }      
    }

    async listRequest(
        limit: number, 
        startIndex: number, 
        status: TypesStatusDemande,
        type: TypesDemande
    ) {
        /*const cacheKey = `listRequest:${status}:${type}:${limit}:${startIndex}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const where: Record<string, any> = {};
        if (status) where.status = status;
        if (type) where.type = type;

        const result = await RequestModel.findAndCountAll({
            limit,
            offset: startIndex,
            where,
            include: [
                {
                model: UserModel,
                as: 'user',
                attributes: ['id', 'firstname', 'lastname']
                },
                {
                model: UserModel,
                as: 'reviewedBy',
                foreignKey: 'reviewedById',
                attributes: ['id', 'firstname', 'lastname']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        //await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }
    
    async getRequestById(id: number) {
        /*const cacheKey = `requestById:${id}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const request = await RequestModel.findByPk(id);
        /*if (request) {
            await redisClient.set(cacheKey, JSON.stringify(request), { EX: REDIS_TTL });
        }*/
        return request;
    }

    async updateStatusRequest(
        id: number, 
        update: UpdateStatusRequest, 
        url?: string,
        reason?: string
    ) {
        const transaction = await sequelize.transaction();
        try {
            const request = await RequestModel.findByPk(id, {
                include: [
                    { model: UserModel, as: 'user' }
                ]
            })
            if (!request) throw new Error('Demande introuvable');
            if (request.type === typesDemande['0'] && update.status === typesStatusDemande['0']) {
                request.url = url || null
                request.reason = null
            }
            if (update.status === typesStatusDemande['2']) {
                if (!reason) throw new Error('Veuillez fournir une raison du refus');
                request.reason = reason
            }
            request.status = update.status
            request.reviewedById = update.reviewedById
            return request.save();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async listRequestUser(
        limit: number, 
        startIndex: number, 
        status: TypesStatusDemande,
        type: TypesDemande,
        userId: number
    ) {
        /*const cacheKey = `listRequestUser:${userId}:${status}:${type}:${limit}:${startIndex}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const where: Record<string, any> = { userId };
        if (status) where.status = status;
        if (type) where.type = type;

        const result = await RequestModel.findAndCountAll({
            limit,
            offset: startIndex,
            where,
            include: [
                {
                model: UserModel,
                as: 'reviewedBy',
                foreignKey: 'reviewedById',
                attributes: ['id', 'firstname', 'lastname']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        //await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }
}

export default new DemandeService()