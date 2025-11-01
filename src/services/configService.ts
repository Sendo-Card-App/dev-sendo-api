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
        const configUpdate = await ConfigModel.findOne({ where: { name } });
        return configUpdate;
    }

    async list() {
        const configs = await ConfigModel.findAll();
        return configs;
    }

    async getConfig(id: number) {
        const config = await ConfigModel.findByPk(id);
        return config;
    }

    async getConfigByName(name: Config['name']) {
        const config = await ConfigModel.findOne({ where: { name } });
        return config;
    }
}

export default new ConfigService();