import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute
} from 'sequelize';
import UserModel from './user.model';
import ConversationModel from './conversation.model';
import sequelize from '@config/db';

class MessageModel extends Model<
  InferAttributes<MessageModel>,
  InferCreationAttributes<MessageModel, { omit: 'id' | 'read' | 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<string>;
  declare content: string;
  declare senderType: 'CUSTOMER' | 'ADMIN';
  declare read: boolean;
  declare attachments?: CreationOptional<string>;
  declare userId: ForeignKey<UserModel['id']>;
  declare conversationId: ForeignKey<ConversationModel['id']>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  // Relations
  declare user?: NonAttribute<UserModel>;
  declare conversation?: NonAttribute<ConversationModel>;
}

MessageModel.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    senderType: {
      type: DataTypes.ENUM('CUSTOMER', 'ADMIN'),
      allowNull: false,
    },
    conversationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'conversations',
        key: 'id',
      },
    },
    read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    attachments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'messages',
    paranoid: true,    // Active soft delete (champ deletedAt)
    timestamps: true,  // createdAt et updatedAt automatiques
  }
);

export default MessageModel;