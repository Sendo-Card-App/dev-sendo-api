import ConfigModel from "@models/config.model";
import {Config} from "../types/Config"
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

interface ConfigCreate {
    name: string;
    value: number;
    description: string;
}

class ConfigService {
    async create(config: ConfigCreate) {
        return await ConfigModel.create(config);
    }

    async update(name: string, value: number) {
        const options = { where: { name }, returning: true };
        await ConfigModel.update({ value }, options);
        // Invalider le cache lié
        await redisClient.del(`configByName:${name}`);
        const configUpdate = await ConfigModel.findOne({ where: { name } });
        return configUpdate;
    }

    async list() {
        const cacheKey = 'config:list';
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const configs = await ConfigModel.findAll();
        await redisClient.set(cacheKey, JSON.stringify(configs), { EX: REDIS_TTL });
        return configs;
    }

    async getConfig(id: number) {
        const cacheKey = `config:id:${id}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const config = await ConfigModel.findByPk(id);
        if (config) {
            await redisClient.set(cacheKey, JSON.stringify(config), { EX: REDIS_TTL });
        }
        return config;
    }

    async getConfigByName(name: Config['name']) {
        const cacheKey = `configByName:${name}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const config = await ConfigModel.findOne({ where: { name } });
        if (config) {
            await redisClient.set(cacheKey, JSON.stringify(config), { EX: REDIS_TTL });
        }
        return config;
    }
}

export default new ConfigService();