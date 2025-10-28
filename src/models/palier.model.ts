import sequelize from "@config/db";
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, NonAttribute } from "sequelize";
import { CommissionModel } from "./commission.model";


export class PalierModel extends Model<
  InferAttributes<PalierModel>,
  InferCreationAttributes<PalierModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
    declare id: CreationOptional<number>;
    declare montantMin: string;
    declare montantMax: string;
    declare commissionId: number;
    declare description: string | null | undefined;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    // Relations
    declare commission?: NonAttribute<CommissionModel>; 
}

PalierModel.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    montantMin: { 
        type: DataTypes.DECIMAL, 
        allowNull: false 
    },
    montantMax: { 
        type: DataTypes.DECIMAL, 
        allowNull: false 
    },
    commissionId: {
        type: DataTypes.INTEGER,
        references: { 
            model: CommissionModel, 
            key: 'id' 
        },
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
    modelName: 'paliers' 
});