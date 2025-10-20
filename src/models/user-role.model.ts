import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional
} from 'sequelize';
import RoleModel from './role.model';
import sequelize from '@config/db';

class UserRoleModel extends Model<
  InferAttributes<UserRoleModel>,
  InferCreationAttributes<UserRoleModel, { omit: 'id' }>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare roleId: number;
}

UserRoleModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      primaryKey: true,
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id',
      },
      primaryKey: true,
    },
  },
  {
    sequelize,
    tableName: 'user_roles',
    timestamps: false,
    hooks: {
      afterSync: async () => {
        const role = await RoleModel.findByPk(1);
        let userRoleAdmin = UserRoleModel.findOne({
          where: {
            userId: 1,
            roleId: role!.id
          }
        })
        if (role && !userRoleAdmin) {
          await UserRoleModel.create({
            userId: 1,
            roleId: role?.id,
          });
          console.log(" User role admin created")
        } else {
          console.log('User role admin déjà existant.');
        }
      }
    }
  }
);

export default UserRoleModel;