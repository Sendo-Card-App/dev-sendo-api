import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import UserModel from './user.model';
import {
  typesNotification,
  TypesNotification,
  TypesStatusNotification,
  typesStatusNotification,
} from '@utils/constants';
import sequelize from '@config/db';

export interface ConfigModelCreate {
  name: string;
  value: number;
  description: string;
}

class NotificationModel extends Model<
  InferAttributes<NotificationModel>,
  InferCreationAttributes<NotificationModel, { omit: 'id' | 'readed' | 'createdAt' | 'updatedAt' }>
> {
  declare id: number;
  declare title: string;
  declare content: string | undefined | null;
  declare status: TypesStatusNotification;
  declare userId: ForeignKey<UserModel['id']>;
  declare token: string;
  declare type: TypesNotification;
  declare readed: boolean;
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  // Relations
  declare user?: NonAttribute<UserModel>;
}

NotificationModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...typesStatusNotification),
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(...typesNotification),
    },
    readed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
    tableName: 'notifications',
    timestamps: true,
  }
);

export default NotificationModel;