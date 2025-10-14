import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  Association
} from 'sequelize';
import bcrypt from 'bcrypt';
import WalletModel from './wallet.model';
import VirtualCardModel from './virtualCard.model';
import TransactionModel from './transaction.model';
import RoleModel from './role.model';
import KycDocumentModel from './kyc-document.model';
import UserRoleModel from './user-role.model';
import { generateAlphaNumeriqueString, generateMatriculeWallet } from '@utils/functions';
import NotificationModel from './notification.model';
import { typesCurrency, typesStatusUser, TypesStatusUser } from '@utils/constants';
import ContactModel from './contact.model';
import StatisticsService from '@services/statisticService';
import SharedExpenseModel from './shared-expense.model';
import PaymentMethodModel from './payment-method.model';
import CardTransactionDebtsModel from './card-transaction-debts.model';
import sequelize from '@config/db';
import MerchantModel from './merchant.model';

class UserModel extends Model<
  InferAttributes<UserModel>,
  InferCreationAttributes<
    UserModel,
    {
      omit: | 'id'
        | 'createdAt'
        | 'updatedAt'
        | 'isVerifiedEmail'
        | 'numberOfCardsCreated'
        | 'isVerifiedPhone'
        | 'picture'
        | 'referralCode'
        | 'referredBy'
        | 'profession'
        | 'status'
        | 'region'
        | 'city'
        | 'district'
        | 'isVerifiedKYC'
        | 'passcode'
        | 'numberFailureConnection';
    }
  >
> {
  declare id: CreationOptional<number>;
  declare firstname: string;
  declare lastname: string;
  declare email: string;
  declare isVerifiedEmail: boolean;
  declare password: string;
  declare phone: string;
  declare isVerifiedPhone: boolean;
  declare status: TypesStatusUser;
  declare country: string;
  declare address: string;
  declare dateOfBirth: string;
  declare placeOfBirth: string;
  declare profession: string;
  declare region: string;
  declare city: string;
  declare district: string;
  declare isVerifiedKYC: boolean;
  declare picture: string;
  declare passcode: string;
  declare referralCode: string;
  declare referredBy: number;
  declare numberOfCardsCreated: number;
  declare numberFailureConnection: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare wallet?: NonAttribute<WalletModel>;
  declare virtualCards?: NonAttribute<VirtualCardModel[]>;
  declare transactions?: NonAttribute<TransactionModel[]>;
  declare roles?: NonAttribute<RoleModel[]>;
  declare favoriteContacts?: NonAttribute<ContactModel[]>;
  declare kycDocuments?: NonAttribute<KycDocumentModel[]>;
  declare notifications?: NonAttribute<NotificationModel[]>;
  declare sharedExpenses?: NonAttribute<SharedExpenseModel[]>;
  declare paymentMethods?: NonAttribute<PaymentMethodModel[]>;
  declare paymentMethod?: NonAttribute<PaymentMethodModel>;
  declare debts?: NonAttribute<CardTransactionDebtsModel[]>;
  declare merchant?: NonAttribute<MerchantModel>;
  //declare requests?: NonAttribute<RequestModel[]>;
  declare static associations: {
    roles: Association<UserModel, RoleModel>;
  };
  declare static statistics: typeof StatisticsService;

  static async initializeSuperAdmin() {
    try {
      const superAdminEmail = process.env.email;
      let superAdmin = await UserModel.findOne({ where: { email: superAdminEmail } });
      if (!superAdmin) {
        superAdmin = await UserModel.create({
          firstname: process.env.firstname || '',
          lastname: process.env.lastname || '',
          email: process.env.email || '',
          password: process.env.password || '',
          phone: process.env.phone || '',
          country: process.env.country || '',
          address: process.env.address || '',
          dateOfBirth: process.env.dateOfBirth || '',
          placeOfBirth: process.env.placeOfBirth || '',
        });
        console.log('Super admin créé !');
      } else {
        console.log('Super admin déjà existant.');
      }
    } catch (error) {
      console.error('Erreur lors de la création du super admin :', error);
    }
  }

  async comparePassword(candidatePassword: string): Promise<boolean> {
    if (!this.password) {
      return false;
    }

    try {
      const isMatch = await bcrypt.compare(candidatePassword, this.password);
      return isMatch;
    } catch (error) {
      return false;
    }
  }
}

UserModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    firstname: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    lastname: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    isVerifiedEmail: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        min: 8,
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    isVerifiedPhone: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    country: {
      type: DataTypes.STRING(60),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    address: {
      type: DataTypes.STRING(80),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    dateOfBirth: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    placeOfBirth: {
      type: DataTypes.STRING(40),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    picture: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...typesStatusUser),
      allowNull: false,
      defaultValue: typesStatusUser['0'],
    },
    profession: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    region: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    district: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    passcode: {
      type: DataTypes.STRING(6),
      validate: {
        len: [4, 6],
        is: /^\d+$/,
      },
      allowNull: true,
    },
    referralCode: {
      type: DataTypes.STRING(8),
      unique: true,
      allowNull: true,
    },
    referredBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    isVerifiedKYC: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    numberOfCardsCreated: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    numberFailureConnection: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
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
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password && !user.password.startsWith('$2b$')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }

        // Génération du code de parrainage unique
        if (!user.referralCode) {
          let code;
          let exists = true;
          do {
            code = generateAlphaNumeriqueString(8).toUpperCase();
            const userWithCode = await UserModel.findOne({ where: { referralCode: code } });
            if (!userWithCode) exists = false;
          } while (exists);
          user.referralCode = code;
        }
      },
      afterCreate: async (user) => {
        const role = await RoleModel.findByPk(8);
        if (role) {
          await UserRoleModel.create({
            userId: user.id,
            roleId: role.id,
          });
        }
        await WalletModel.create({
          balance: 0,
          userId: user.id,
          currency: typesCurrency['0'],
          matricule: generateMatriculeWallet(),
        });
      },
      beforeUpdate: async (user) => {
        if (user.password && !user.password.startsWith('$2b$')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      afterSync: async () => {
        await UserModel.initializeSuperAdmin()
      }
    },
  }
);

export default UserModel;