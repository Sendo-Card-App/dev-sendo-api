import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  ForeignKey,
  CreationOptional,
  NonAttribute,
} from 'sequelize';
import UserModel from './user.model';
import { typesToken, TypesToken } from '@utils/constants';
import sequelize from '@config/db';

class TokenModel extends Model<
  InferAttributes<TokenModel>,
  InferCreationAttributes<TokenModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: number;
  declare userId: ForeignKey<UserModel['id']>;
  declare token: string;
  declare deviceId?: string;
  declare tokenType: TypesToken;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare user?: NonAttribute<UserModel>;
}

TokenModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    deviceId: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    tokenType: {
      type: DataTypes.ENUM(...typesToken),
      allowNull: false,
      defaultValue: typesToken['0'],
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
    tableName: 'tokens',
    timestamps: true,
    indexes: [
      {
        fields: ['tokenType'],
      },
    ],
  }
);

export default TokenModel;