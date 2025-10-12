import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute
} from 'sequelize';
import UserModel from './user.model';
import { roles } from '@utils/constants';
import sequelize from '@config/db';

class RoleModel extends Model<
  InferAttributes<RoleModel>,
  InferCreationAttributes<RoleModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: number;
  declare name: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare users?: NonAttribute<UserModel[]>;

  static async initializeRoles() {
    try {
      const count = await RoleModel.count();
      if (count === 0) {
        await RoleModel.bulkCreate(roles);
        console.log('Roles initiaux créés avec succès');
      }
    } catch (error) {
      console.error('Erreur lors de la création des rôles :', error);
    }
  }
}

RoleModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
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
    tableName: 'roles',
    timestamps: true,
    hooks: {
      afterSync: async () => {
        await RoleModel.initializeRoles();
      },
    },
  }
);

export default RoleModel;