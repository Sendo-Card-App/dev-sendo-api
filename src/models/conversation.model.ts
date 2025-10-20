import { typesStatusConversation, TypesStatusConversation } from '@utils/constants';
import {
  CreationOptional,
  DataTypes,
  ENUM,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute
} from 'sequelize';
import UserModel from './user.model';
import sequelize from '@config/db';

class ConversationModel extends Model<
  InferAttributes<ConversationModel>,
  InferCreationAttributes<ConversationModel, { omit: 'id' | 'adminId' | 'createdAt' | 'updatedAt' }>
> {
  declare id: string;
  declare userId: ForeignKey<UserModel['id']>;
  declare adminId?: ForeignKey<UserModel['id']> | null;
  declare status: TypesStatusConversation;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare user?: NonAttribute<UserModel>;
  declare admin?: NonAttribute<UserModel>;
}

ConversationModel.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: ENUM(...typesStatusConversation),
      allowNull: false,
      defaultValue: typesStatusConversation['2'],
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'conversations',
  }
);

export default ConversationModel;