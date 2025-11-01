import PubModel from "@models/pub-model";
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

class PubService {
    async getPubs(limit: number, startIndex: number) {
        /*const cacheKey = `pubs:${limit}:${startIndex}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const result = await PubModel.findAndCountAll({
            limit,
            offset: startIndex,
            order: [["createdAt", "DESC"]],
        });

        //await redisClient.set(cacheKey, JSON.stringify(result), { EX: REDIS_TTL });
        return result;
    }

    async getPubById(id: number) {
        /*const cacheKey = `pub:${id}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const pub = await PubModel.findByPk(id);
        /*if (pub) {
            await redisClient.set(cacheKey, JSON.stringify(pub), { EX: REDIS_TTL });
        }*/
        return pub;
    }

    async createPub(pubData: {
        name?: string;
        imageUrl: string;
        price?: number;
        description?: string;
        link?: string;
    }) {
        return PubModel.create(pubData);
    }

    async updatePub(pubData: {
        id: number;
        name?: string;
        imageUrl?: string;
        price?: number;
        description?: string;
        link?: string;
        isActive?: boolean;
    }) {
        const pub = await PubModel.findByPk(pubData.id);
        if (!pub) {
            throw new Error("Pub not found");
        }
        return pub.update(pubData);
    }

    async deletePub(id: number) {
        const pub = await PubModel.findByPk(id);
        if (!pub) {
            throw new Error("Pub not found");
        }
        return pub.destroy();
    }
}

export default new PubService();