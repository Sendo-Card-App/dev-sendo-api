import { CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize } from 'sequelize';
import UserModel from './user.model';
import sequelize from '@config/db';

class ContactModel extends Model<
  InferAttributes<ContactModel>,
  InferCreationAttributes<ContactModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: number;
  declare name: string;
  declare phone: string;
  declare userId: ForeignKey<UserModel['id']>;
  declare contactUserId: ForeignKey<UserModel['id']>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare ownerUser?: NonAttribute<UserModel>;
  declare listOwner?: NonAttribute<UserModel>;
}

ContactModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(45),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    contactUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
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
    tableName: 'contacts',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'contactUserId', 'phone'],
      },
    ],
  }
);

export default ContactModel;