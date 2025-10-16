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
import {
  typesCurrency,
  TypesCurrency,
  typesStatusWallet,
  TypesStatusWallet,
} from '@utils/constants';
import { generateMatriculeWallet } from '@utils/functions';
import sequelize from '@config/db';

class WalletModel extends Model<
  InferAttributes<WalletModel>,
  InferCreationAttributes<WalletModel, { omit: 'id' | 'status' }>
> {
  declare id: CreationOptional<number>;
  declare balance: number;
  declare currency: TypesCurrency;
  declare status: TypesStatusWallet;
  declare userId: ForeignKey<UserModel['id']>;
  declare matricule: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare user?: NonAttribute<UserModel>;
}

WalletModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    balance: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    currency: {
      type: DataTypes.ENUM(...typesCurrency),
      defaultValue: typesCurrency['0'],
    },
    status: {
      type: DataTypes.ENUM(...typesStatusWallet),
      allowNull: false,
      defaultValue: typesStatusWallet['0'],
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      validate: {
        async isValidUser(value: number) {
          const user = await UserModel.findByPk(value);
          if (!user) {
            throw new Error('Utilisateur invalide');
          }
        },
      },
    },
    matricule: {
      type: DataTypes.STRING(9),
      unique: true,
      allowNull: false,
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
    modelName: 'Wallet',
    tableName: 'wallets',
    timestamps: true,
    hooks: {
      beforeCreate: async (wallet) => {
        wallet.status = typesStatusWallet['0'];
      },
      afterUpdate: async (wallet) => {
        if (wallet.changed('balance')) {
          const userExists = await UserModel.findByPk(wallet.userId);
          if (!userExists) {
            throw new Error('Utilisateur lié au portefeuille introuvable');
          }
        }
      },
      beforeUpdate: (wallet) => {
        if (wallet.getDataValue('balance') < 0) {
          //throw new Error('Solde négatif interdit');
        }
      },
      afterSync: async () => {
        const walletAdmin = await WalletModel.findOne({
          where: { userId: 1 }
        })
        if (!walletAdmin) {
          await WalletModel.create({
            balance: 0,
            userId: 1,
            currency: typesCurrency['0'],
            matricule: generateMatriculeWallet(),
          });
          console.log("Wallet Admin créé")
        } else {
          console.log("Wallet Admin existe déjà")
        }
      }
    },
  }
);

export default WalletModel;