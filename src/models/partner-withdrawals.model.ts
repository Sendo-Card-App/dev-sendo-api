import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import MerchantModel from "./merchant.model";
import sequelize from "@config/db";


class PartnerWithdrawalsModel extends Model<
  InferAttributes<PartnerWithdrawalsModel>,
  InferCreationAttributes<PartnerWithdrawalsModel, { omit: 'id' | 'status' | 'createdAt' | 'updatedAt' }>
> {
    declare id: CreationOptional<number>;
    declare partnerId: ForeignKey<MerchantModel['id']>;
    declare amount: number;
    declare phone: string;
    declare status: 'VALIDATED' | 'REJECTED' | 'PENDING' | 'FAILED';
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
    // Relations
    declare partner?: CreationOptional<MerchantModel>;
}

PartnerWithdrawalsModel.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
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
    phone: {
        type: DataTypes.STRING(30),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('VALIDATED', 'REJECTED', 'PENDING'),
        defaultValue: 'PENDING',
        allowNull: false
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
    tableName: 'partner_withdrawals',
    timestamps: true,
})

export default PartnerWithdrawalsModel;