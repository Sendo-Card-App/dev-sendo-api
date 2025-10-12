import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute
} from 'sequelize';
import FundRequestModel from './fund-request.model';
import UserModel from './user.model';
import TransactionModel from './transaction.model';
import sequelize from '@config/db';

class RequestRecipientModel extends Model<
  InferAttributes<RequestRecipientModel>,
  InferCreationAttributes<RequestRecipientModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: number;
  declare status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PAID' | 'PARTIALLY_PAID';
  declare fundRequestId: number;
  declare recipientId: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare requestFund?: NonAttribute<FundRequestModel>;
  declare recipient?: NonAttribute<UserModel>;
  declare payments?: NonAttribute<TransactionModel[]>;
}

RequestRecipientModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'PAID', 'PARTIALLY_PAID'),
      defaultValue: 'PENDING',
    },
    fundRequestId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'fund_requests',
        key: 'id',
      },
    },
    recipientId: {
      type: DataTypes.INTEGER,
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
    tableName: 'request_recipients',
    timestamps: true,
  }
);

export default RequestRecipientModel;