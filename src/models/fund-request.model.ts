import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute
} from 'sequelize';
import UserModel from './user.model';
import RequestRecipientModel from './request-recipient.model';
import sequelize from '@config/db';

class FundRequestModel extends Model<
  InferAttributes<FundRequestModel>,
  InferCreationAttributes<FundRequestModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: number;
  declare amount: number;
  declare description: string;
  declare deadline: Date;
  declare status: 'PENDING' | 'PARTIALLY_FUNDED' | 'FULLY_FUNDED' | 'CANCELLED';
  declare userId: number;
  declare reference: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare requesterFund?: NonAttribute<UserModel>;
  declare recipients?: NonAttribute<RequestRecipientModel[]>;
}

FundRequestModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    deadline: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'PARTIALLY_FUNDED', 'FULLY_FUNDED', 'CANCELLED'),
      defaultValue: 'PENDING',
    },
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reference: {
      type: DataTypes.STRING,
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
    tableName: 'fund_requests',
    timestamps: true,
  }
);

export default FundRequestModel;