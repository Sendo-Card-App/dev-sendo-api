import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute
} from 'sequelize';
import UserModel from './user.model';
import sequelize from '@config/db';

class PhoneNumberUserModel extends Model<
  InferAttributes<PhoneNumberUserModel>,
  InferCreationAttributes<PhoneNumberUserModel, { omit: 'id' | 'isVerified' | 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare phone: string;
  declare isVerified: boolean;
  declare userId: ForeignKey<UserModel['id']>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare user?: NonAttribute<UserModel>;
}

PhoneNumberUserModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
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
    modelName: 'PhoneNumberUser',
    tableName: 'phone_number_users',
    timestamps: true,
  }
);

export default PhoneNumberUserModel;