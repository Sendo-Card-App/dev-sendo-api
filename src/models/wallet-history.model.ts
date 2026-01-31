import sequelize from "@config/db";
import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute } from "sequelize";
import WalletModel from "./wallet.model";
import UserModel from "./user.model";

class WalletHistoryModel extends Model<
  InferAttributes<WalletHistoryModel>,
  InferCreationAttributes<WalletHistoryModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
    declare id: number;
    declare previousValue: number;
    declare newValue: number;
    declare walletId: ForeignKey<WalletModel['id']>;
    declare updatedBy: ForeignKey<UserModel['id']>;
    declare reason: string | null | undefined;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    // Relations
    declare wallet?: NonAttribute<WalletModel>;
}

WalletHistoryModel.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    walletId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: WalletModel, key: "id" },
    },
    previousValue: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    newValue: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        //references: { model: UserModel, key: "id" },
    },
    reason: {
        type: DataTypes.STRING,
        allowNull: true
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
    tableName: 'wallet_histories',
    timestamps: true,
})

export default WalletHistoryModel;