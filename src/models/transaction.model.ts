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
import VirtualCardModel from './virtualCard.model';
import { generateTransactionId } from '@utils/functions';
import {
  TypesCurrency,
  typesCurrency,
  typesMethodTransaction,
  TypesMethodTransaction,
  TypesProviderMobile,
  typesStatusTransaction,
  TypesStatusTransaction,
  typesTransaction,
  TypesTransaction,
} from '@utils/constants';
import DestinataireModel from './destinataire.model';
import sequelize from '@config/db';

class TransactionModel extends Model<
  InferAttributes<TransactionModel>,
  InferCreationAttributes<
    TransactionModel,
    {
      omit:
        | 'transactionId'
        | 'receiverId'
        | 'createdAt'
        | 'updatedAt'
        | 'virtualCardId'
        | 'description'
        | 'exchangeRates'
        | 'sendoFees'
        | 'tva'
        | 'totalAmount'
        | 'partnerFees'
        | 'retryCount'
        | 'lastChecked';
    }
  >
> {
  declare id: CreationOptional<number>;
  declare transactionId: string;
  declare amount: number;
  declare currency: TypesCurrency | string;
  declare type: TypesTransaction;
  declare status: TypesStatusTransaction;
  declare userId: ForeignKey<UserModel['id']>;
  declare exchangeRates: number;
  declare sendoFees: number;
  declare tva: number;
  declare totalAmount: number;
  declare partnerFees: number;
  declare description: string;
  declare receiverId: number;
  declare receiverType: 'User' | 'Destinataire';
  declare method: TypesMethodTransaction | null;
  declare provider: TypesProviderMobile | null | string;
  declare transactionReference: string | null;
  declare bankName: string | null;
  declare accountNumber: string | null;
  declare virtualCardId: ForeignKey<VirtualCardModel['id']>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare retryCount: number;
  declare lastChecked: Date;
  // Relations
  declare user?: NonAttribute<UserModel>;
  declare destinataire?: NonAttribute<DestinataireModel>;
  declare card?: NonAttribute<VirtualCardModel>;

  async getReceiver() {
    if (this.receiverType === 'User') {
      return await UserModel.findByPk(this.receiverId, {
        attributes: ['id', 'firstname', 'lastname', 'phone', 'email'],
      });
    } else if (this.receiverType === 'Destinataire') {
      return await DestinataireModel.findByPk(this.receiverId);
    }
    return null;
  }
}

TransactionModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      defaultValue: () => generateTransactionId(),
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    exchangeRates: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.0,
    },
    sendoFees: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.0,
    },
    currency: {
      type: DataTypes.ENUM(...typesCurrency),
      defaultValue: typesCurrency['0'],
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tva: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.0,
    },
    partnerFees: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0.0,
    },
    totalAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(...typesTransaction),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...typesStatusTransaction),
      defaultValue: typesStatusTransaction['0'],
    },
    receiverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    receiverType: {
      type: DataTypes.ENUM('User', 'Destinataire'),
      allowNull: false,
    },
    virtualCardId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'virtual_cards',
        key: 'id',
      },
    },
    method: {
      type: DataTypes.ENUM(...typesMethodTransaction),
      allowNull: true,
      validate: {
        isDepositMethod(value: string) {
          if (this.type === typesTransaction['0'] && !value) {
            throw new Error('Method is required for DEPOSIT transactions');
          }
        },
      },
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isProviderRequired(value: string) {
          if (this.method === typesMethodTransaction['0'] && !value) {
            throw new Error('Provider is required for MOBILE_MONEY transactions');
          }
        },
      },
    },
    transactionReference: {
      type: DataTypes.STRING(191),
      allowNull: true,
      unique: true
    },
    bankName: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    accountNumber: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastChecked: {
      type: DataTypes.DATE,
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
    tableName: 'transactions',
    timestamps: true,
    hooks: {
      beforeCreate: async (transaction) => {
        let transactionId;
        do {
          transactionId = generateTransactionId();
        } while (await TransactionModel.findOne({ where: { transactionId } }));
        transaction.transactionId = transactionId;

        if (transaction.type === typesTransaction['0']) {
          if (!transaction.method) {
            throw new Error('Deposit method must be specified');
          }

          if (transaction.method === typesMethodTransaction['0'] && !transaction.provider) {
            throw new Error('Mobile money provider must be specified');
          }
        }
      },
    },
  }
);

export default TransactionModel;