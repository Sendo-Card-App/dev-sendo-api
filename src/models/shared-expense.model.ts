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
import { typesCurrency, TypesCurrency, TypesStatusSharedExpense, typesStatusSharedExpense } from '@utils/constants';
import ParticipantSharedExpenseModel from './participant-shared-expense.model';
import sequelize from '@config/db';

class SharedExpenseModel extends Model<
  InferAttributes<SharedExpenseModel>,
  InferCreationAttributes<SharedExpenseModel, { omit: 'id' | 'cancelReason' | 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare totalAmount: number;
  declare description: string;
  declare userId: ForeignKey<UserModel['id']>;
  declare initiatorPart: number;
  declare status: TypesStatusSharedExpense;
  declare limitDate: Date;
  declare currency: TypesCurrency;
  declare methodCalculatingShare: 'auto' | 'manual';
  declare cancelReason: string;
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  // Relations
  declare initiator?: NonAttribute<UserModel>;
  declare participants?: NonAttribute<ParticipantSharedExpenseModel[]>;
}

SharedExpenseModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    initiatorPart: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...typesStatusSharedExpense),
      defaultValue: typesStatusSharedExpense['0'],
    },
    limitDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    currency: {
      type: DataTypes.ENUM(...typesCurrency),
      defaultValue: typesCurrency['0'],
    },
    methodCalculatingShare: {
      type: DataTypes.ENUM('auto', 'manual'),
      defaultValue: 'auto',
    },
    cancelReason: {
      type: DataTypes.STRING,
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
    tableName: 'shared_expenses',
    timestamps: false,
  }
);

export default SharedExpenseModel;