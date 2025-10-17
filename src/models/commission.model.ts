import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { PalierModel } from "./palier.model";
import sequelize from "@config/db";

export class CommissionModel extends Model<
  InferAttributes<CommissionModel>,
  InferCreationAttributes<CommissionModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
    declare id: CreationOptional<number>;
    declare typeCommission: 'POURCENTAGE' | 'FIXE';
    declare montantCommission: number;
    declare description: string | null | undefined;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

CommissionModel.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    typeCommission: { 
        type: DataTypes.ENUM('POURCENTAGE', 'FIXE'), 
        allowNull: false 
    },
    montantCommission: { 
        type: DataTypes.DECIMAL, 
        allowNull: false 
    },
    description: { 
        type: DataTypes.STRING,
        allowNull: true 
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
}, { 
    sequelize, 
    timestamps: true,
    modelName: 'commissions'
});