import ConfigModel from "@models/config.model";
import { UpdateOptions } from "sequelize";
import {Config} from "../types/Config"

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
        const options: UpdateOptions = {
            where: { name: name },
            returning: true
        };
        await ConfigModel.update({ value: value }, options)
        const configUpdate = ConfigModel.findOne({
            where: {
                name: name
            }
        })
        return configUpdate
    }

    async list() {
        return await ConfigModel.findAll();
    }

    async getConfig(id: number) {
        return await ConfigModel.findByPk(id);
    }

    async getConfigByName(name: Config['name']) {
        return ConfigModel.findOne({
            where: { name: name }
        })
    }
}

export default new ConfigService();