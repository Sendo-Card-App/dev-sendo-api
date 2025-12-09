import sequelize from "@config/db";
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, NonAttribute } from "sequelize";
import UserModel from "./user.model";
import WalletModel from "./wallet.model";


class ReferralCodeModel extends Model<
  InferAttributes<ReferralCodeModel>,
  InferCreationAttributes<ReferralCodeModel, { omit: 'id' | 'usedBy' | 'createdAt' | 'updatedAt' }>
> {
    declare id: number;
    declare code: string;
    declare userId: number;
    declare isUsed: boolean;
    declare usedBy: { userId: number; isUsed: boolean }[];
    //declare maxUses: number | null;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
    // Relations
    declare owner?: NonAttribute<UserModel>;
    declare wallet?: NonAttribute<WalletModel>;
}

ReferralCodeModel.init({
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    code: {
        type: DataTypes.STRING(8),
        unique: true,
        allowNull: false
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    isUsed: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false 
    },
    usedBy: {
        type: DataTypes.TEXT,
        defaultValue: '[]',                 
        get() {
            const raw = this.getDataValue('usedBy');
            try {
                return raw ? JSON.parse(String(raw)) : [];
            } catch {
                return [];
            }
        },
        set(value: { userId: number; isUsed: boolean }[]) {
            this.setDataValue('usedBy', JSON.stringify(value) as any);
        }
    },
    /*maxUses: { 
        type: DataTypes.INTEGER, 
        defaultValue: 5 
    },*/
    createdAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    },
    updatedAt: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    }
}, { 
    sequelize, 
    tableName: 'referral_codes', 
    timestamps: true,
    /*indexes: [
        { fields: ['code'], unique: true },
        { fields: ['userId'] }
    ]*/
});

export default ReferralCodeModel;