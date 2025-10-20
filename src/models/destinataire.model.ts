import sequelize from '@config/db';
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model
} from 'sequelize';

class DestinataireModel extends Model<
  InferAttributes<DestinataireModel>,
  InferCreationAttributes<DestinataireModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare firstname: string;
  declare lastname: string;
  declare country: string;
  declare provider: string;
  declare phone: string;
  declare address: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

DestinataireModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    firstname: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    lastname: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    provider: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING(100),
      allowNull: false,
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
    tableName: 'destinataires',
    timestamps: true,
  }
);

export default DestinataireModel;