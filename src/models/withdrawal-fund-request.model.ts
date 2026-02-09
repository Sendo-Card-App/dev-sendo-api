import { DataTypes, Model, NonAttribute } from "sequelize";
import sequelize from "@config/db";
import FundSubscriptionModel from "./fund-subscription.model";
import UserModel from "./user.model";

export class WithdrawalFundRequestModel extends Model {
  public id!: string;
  public subscriptionId!: string;
  public userId!: number;
  public type!: "INTEREST_ONLY" | "FULL_WITHDRAWAL";
  public status!: "PENDING" | "APPROVED" | "REJECTED";
  public processedAt?: Date;

  // Relations
  public fundSubscription?: NonAttribute<FundSubscriptionModel>;
  public user?: NonAttribute<UserModel>;
}

WithdrawalFundRequestModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    subscriptionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("INTEREST_ONLY", "FULL_WITHDRAWAL"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"),
      defaultValue: "PENDING",
    },
    processedAt: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: "withdrawal_fund_requests",
    timestamps: true
  }
);

export default WithdrawalFundRequestModel;