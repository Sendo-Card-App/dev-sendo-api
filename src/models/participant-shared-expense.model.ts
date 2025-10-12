import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute
} from 'sequelize';
import SharedExpenseModel from './shared-expense.model';
import UserModel from './user.model';
import { TypesPaymentStatusSharedExpense, typesPaymentStatusSharedExpense } from '@utils/constants';
import sequelize from '@config/db';

class ParticipantSharedExpenseModel extends Model<
  InferAttributes<ParticipantSharedExpenseModel>,
  InferCreationAttributes<ParticipantSharedExpenseModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare part: number;
  declare sharedExpenseId: ForeignKey<SharedExpenseModel['id']>;
  declare userId: ForeignKey<UserModel['id']>;
  declare paymentStatus: TypesPaymentStatusSharedExpense;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare user?: NonAttribute<UserModel>;
  declare sharedExpenses?: NonAttribute<SharedExpenseModel[]>;
  declare sharedExpense?: NonAttribute<SharedExpenseModel>;
}

ParticipantSharedExpenseModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    part: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    paymentStatus: {
      type: DataTypes.ENUM(...typesPaymentStatusSharedExpense),
      defaultValue: typesPaymentStatusSharedExpense['0'],
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
    tableName: 'participants_shared_expense',
    timestamps: true,
  }
);

export default ParticipantSharedExpenseModel;