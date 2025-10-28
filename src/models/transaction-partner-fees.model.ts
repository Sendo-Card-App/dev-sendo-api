import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import MerchantModel from "./merchant.model";
import TransactionModel from "./transaction.model";
import sequelize from "@config/db";


class TransactionPartnerFeesModel extends Model<
  InferAttributes<TransactionPartnerFeesModel>,
  InferCreationAttributes<TransactionPartnerFeesModel,
    {
      omit: 'id' | 'isWithdrawn' | 'createdAt' | 'updatedAt'
    }
  >
> {
    declare id: CreationOptional<number>;
    declare transactionId: ForeignKey<TransactionModel['id']>;;
    declare partnerId: ForeignKey<MerchantModel['id']>;
    declare amount: number;
    declare isWithdrawn: boolean;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    // Relations
    declare partner?: CreationOptional<MerchantModel>;
    declare transaction?: CreationOptional<TransactionModel>;
}

TransactionPartnerFeesModel.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    transactionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'transactions',
            key: 'id',
        },
    },
    partnerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'merchants',
            key: 'id'
        },
    },
    amount: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    isWithdrawn: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    }
}, {
    sequelize,
    tableName: 'transactions_partner_fees',
    timestamps: true,
})

export default TransactionPartnerFeesModel;