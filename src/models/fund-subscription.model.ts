import { DataTypes, ForeignKey, Model, NonAttribute } from "sequelize";
import sequelize from "@config/db";
import FundModel from "./fund.model";
import UserModel from "./user.model";

export class FundSubscriptionModel extends Model {
  public id!: string;
  public userId!: number;
  public fundId!: string;
  public currency!: "XAF" | "CAD";
  public amount!: number;
  public commissionRate!: number;
  public interestAmount!: number;
  public startDate!: Date;
  public endDate!: Date;
  public status!: "ACTIVE" | "MATURED" | "CLOSED";

  // Relations
  public fund?: NonAttribute<FundModel>;
  public user?: NonAttribute<UserModel>;
}

FundSubscriptionModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fundId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    currency: {
      type: DataTypes.ENUM("XAF", "CAD"),
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    commissionRate: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    interestAmount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "MATURED", "CLOSED"),
      defaultValue: "ACTIVE",
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
    tableName: "fund_subscriptions",
    timestamps: true
  }
);

export default FundSubscriptionModel;