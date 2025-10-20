import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  NonAttribute
} from 'sequelize';
import UserModel from './user.model';
import { TypesStatusCard, typesStatusCard } from '@utils/constants';
import PaymentMethodModel from './payment-method.model';
import CardTransactionDebtsModel from './card-transaction-debts.model';
import sequelize from '@config/db';

class VirtualCardModel extends Model<
  InferAttributes<VirtualCardModel>,
  InferCreationAttributes<VirtualCardModel, { omit: 'id' | 'last4Digits' | 'paymentRejectNumber' | 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare cardId: number;
  declare last4Digits: string;
  declare partyId: string;
  declare status: TypesStatusCard;
  declare userId: ForeignKey<UserModel['id']>;
  declare cardName: string;
  declare expirationDate: string;
  declare paymentRejectNumber: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare user?: NonAttribute<UserModel>;
  declare paymentMethod?: NonAttribute<PaymentMethodModel>;
  declare debts?: NonAttribute<CardTransactionDebtsModel[]>;
}

VirtualCardModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cardId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    cardName: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    partyId: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    last4Digits: {
      type: DataTypes.STRING(4),
      allowNull: true,
    },
    expirationDate: {
      type: DataTypes.STRING(5),
      allowNull: false,
      validate: {
        is: /^(0[1-9]|1[0-2])\/?([0-9]{2})$/,
      },
    },
    paymentRejectNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM(...typesStatusCard),
      allowNull: false,
      defaultValue: typesStatusCard['0'],
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
    tableName: 'virtual_cards',
    timestamps: true,
    /*
    hooks: {
      beforeCreate: (card) => {
        card.cardNumber = card.cardNumber.replace(/\s+/g, '');
      },
      beforeUpdate: (card) => {
        if (card.changed('cardNumber')) {
          card.cardNumber = card.cardNumber.replace(/\s+/g, '');
        }
      }
    }
    */
  }
);

// Exemple de méthode toJSON personnalisée pour masquer les données sensibles (optionnel)
/*
VirtualCardModel.prototype.toJSON = function() {
  const values: { [key: string]: any } = Object.assign({}, this.get());
  values.cardNumber = values.cardNumber.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1********$4');
  delete values.cvv;
  return values;
};
*/

export default VirtualCardModel;