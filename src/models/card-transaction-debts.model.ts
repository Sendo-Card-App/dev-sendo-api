import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize } from 'sequelize';
import UserModel from './user.model';
import VirtualCardModel from './virtualCard.model';
import sequelize from '@config/db';
import TransactionModel from './transaction.model';

class CardTransactionDebtsModel extends Model<
  InferAttributes<CardTransactionDebtsModel>,
  InferCreationAttributes<CardTransactionDebtsModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: number;
  declare amount: number;
  declare intitule: string;
  declare userId: ForeignKey<UserModel['id']>;
  declare cardId: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare user?: NonAttribute<UserModel>;
  declare card?: NonAttribute<VirtualCardModel>;
}

CardTransactionDebtsModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    intitule: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    cardId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'virtual_cards',
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
    tableName: 'card_transaction_debts',
    timestamps: true,
  }
);

export default CardTransactionDebtsModel;
