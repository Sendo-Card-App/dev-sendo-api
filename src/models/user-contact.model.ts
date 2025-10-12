import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model
} from 'sequelize';
import UserModel from './user.model';
import ContactModel from './contact.model';
import sequelize from '@config/db';

class UserContactModel extends Model<
  InferAttributes<UserContactModel>,
  InferCreationAttributes<UserContactModel, { omit: 'id' }>
> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<UserModel['id']>;
  declare contactId: ForeignKey<ContactModel['id']>;
}

UserContactModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    contactId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'contacts', key: 'id' },
    },
  },
  {
    sequelize,
    tableName: 'user_contacts',
    timestamps: false,
  }
);

export default UserContactModel;
