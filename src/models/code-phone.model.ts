import { CreationOptional, DataTypes, Model } from 'sequelize';
import UserModel from './user.model';
import sequelize from '@config/db';

class CodePhoneModel extends Model {
  declare id: number;
  declare userId: number;
  declare phone: string;
  declare code: string;
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare user?: UserModel;
}

CodePhoneModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    code: {
      type: DataTypes.STRING(6),
      allowNull: false,
      unique: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
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
    tableName: 'codes_phone',
    timestamps: true,
  }
);

export default CodePhoneModel;