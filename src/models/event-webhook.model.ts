import sequelize from "@config/db";
import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";

class WebhookEventModel extends Model<
    InferAttributes<WebhookEventModel>,
    InferCreationAttributes<WebhookEventModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
    declare id: number;
    declare statusCode?: number;
    declare statusMessage?: string;
    declare webhookId: string;
    declare content: string;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

WebhookEventModel.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    statusCode: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    statusMessage: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    webhookId: {
        type: DataTypes.STRING(65),
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
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
    tableName: 'webhook_events',
    timestamps: true,
})

export default WebhookEventModel