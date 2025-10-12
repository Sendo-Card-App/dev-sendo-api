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
import VirtualCardModel from './virtualCard.model';
import sequelize from '@config/db';

class PaymentMethodModel extends Model<
  InferAttributes<PaymentMethodModel>,
  InferCreationAttributes<PaymentMethodModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare paymentMethodId: string;
  declare type: 'MOBILE_MONEY' | 'NEERO_MERCHANT' | 'PAYPAL' | 'NEERO_PERSON' | 'NEERO_CARD';
  declare phone: string | null | undefined;
  declare userId: ForeignKey<UserModel['id']> | null | undefined;
  declare cardId: ForeignKey<VirtualCardModel['id']> | null | undefined;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relation
  declare user?: NonAttribute<UserModel>;
  declare card?: NonAttribute<VirtualCardModel>;
}

PaymentMethodModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    paymentMethodId: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('MOBILE_MONEY', 'NEERO_MERCHANT', 'PAYPAL', 'NEERO_PERSON', 'NEERO_CARD'),
      allowNull: false,
      defaultValue: 'MOBILE_MONEY',
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    cardId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    timestamps: true,
    tableName: 'payment_methods',
  }
);

export default PaymentMethodModel;