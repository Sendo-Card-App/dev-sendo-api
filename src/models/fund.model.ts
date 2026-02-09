import { DataTypes, Model } from "sequelize";
import sequelize from "@config/db";
import FundSubscriptionModel from "./fund-subscription.model";

export class FundModel extends Model {
  public id!: string;
  public name!: string;
  public amountXAF!: number;
  public amountCAD!: number;
  public annualCommission!: number;

  // Relations
  public fund_subscriptions?: FundSubscriptionModel[];

  static async basicFunds() {
    const funds = [
        {
            name: "Sdo Invest Start",
            amountXAF: 100000,
            amountCAD: 200,
            annualCommission: 10
        },
        {
            name: "Sdo Invest Basic",
            amountXAF: 250000,
            amountCAD: 300,
            annualCommission: 10
        },
        {
            name: "Sdo Secure Fund",
            amountXAF: 500000,
            amountCAD: 500,
            annualCommission: 10
        },
        {
            name: "Sdo Capital",
            amountXAF: 750000,
            amountCAD: 750,
            annualCommission: 10
        },
        {
            name: "Sdo Croissance",
            amountXAF: 1000000,
            amountCAD: 1000,
            annualCommission: 10
        }
    ]
    const existFunds = await FundModel.findAll()
    if (existFunds && existFunds.length === 0)
      await FundModel.bulkCreate(funds)
    else
      console.log('funds déjà créés')
  }
}

FundModel.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amountXAF: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amountCAD: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    annualCommission: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 10,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    }
  },
  {
    sequelize,
    tableName: "funds",
    timestamps: true,
    hooks: {
        afterSync: async () => {
            await FundModel.basicFunds()
        }
    }
  }
);

export default FundModel;