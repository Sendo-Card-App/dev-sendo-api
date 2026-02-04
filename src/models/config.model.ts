import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';
import { configs } from '@utils/constants';
import sequelize from '@config/db';

export interface ConfigModelCreate {
  name: string;
  value: number | string;
  description: string;
}

class ConfigModel extends Model<
  InferAttributes<ConfigModel>,
  InferCreationAttributes<ConfigModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: number;
  declare name: string;
  declare value: number | string;
  declare description: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static async initializeBaseConfigs(configs: ConfigModelCreate[]) {
    try {
      const count = await ConfigModel.count();
      if (count === 0) {
        await ConfigModel.bulkCreate(configs);
        console.log('Configs initiaux créés avec succès');
      }
    } catch (error) {
      console.error('Erreur lors de la création des configs :', error);
    }
  }
}

ConfigModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(45),
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '0.0', // value est string donc valeur par défaut chaîne
    },
    description: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'configs',
    timestamps: true,
    hooks: {
      afterSync: async () => {
        await ConfigModel.initializeBaseConfigs(configs);
      },
    },
  }
);

export default ConfigModel;