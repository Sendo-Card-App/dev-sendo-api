import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute } from "sequelize";
import UserModel from "./user.model";
import sequelize from "@config/db";
import TransactionPartnerFeesModel from "./transaction-partner-fees.model";
import PartnerWithdrawalsModel from "./partner-withdrawals.model";


class MerchantModel extends Model<
    InferAttributes<MerchantModel>,
    InferCreationAttributes<MerchantModel, { omit: 'id' | 'balance' | 'createdAt' | 'updatedAt' }>
> {
    declare id: CreationOptional<number>;
    declare userId: ForeignKey<UserModel['id']>;
    declare typeAccount: 'Particulier' | 'Entreprise';
    declare status: 'ACTIVE' | 'PENDING' | 'REFUSED';
    declare balance: number;
    declare code: string;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
    
    // Relations
    declare user?: NonAttribute<UserModel>;
    declare transactions?: NonAttribute<TransactionPartnerFeesModel[]>;
    declare withdrawals?: NonAttribute<PartnerWithdrawalsModel[]>;
}

MerchantModel.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        unique: true,
    },
    typeAccount: {
        type: DataTypes.ENUM('Particulier', 'Entreprise'),
        allowNull: false,
    },
    balance: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    code: {
        type: DataTypes.STRING(9),
        allowNull: false,
        unique: true
    },
    status: {
        type: DataTypes.ENUM('ACTIVE', 'PENDING', 'REFUSED'),
        defaultValue: 'PENDING',
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
}, {
    sequelize,
    tableName: 'merchants',
    timestamps: true
});

export default MerchantModel;