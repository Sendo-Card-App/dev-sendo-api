import sequelize from '@config/db';
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model
} from 'sequelize';

class PubModel extends Model<
  InferAttributes<PubModel>,
  InferCreationAttributes<PubModel, { omit: 'id' | 'createdAt' | 'updatedAt' | 'isActive' }>
> {
  declare id: CreationOptional<number>;
  declare name: string | null | undefined;
  declare description: string | null | undefined;
  declare imageUrl: string;
  declare price: number | null | undefined;
  declare link: string | null | undefined;
  declare isActive: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

PubModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    link: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'publicites',
    timestamps: true,
  }
);

export default PubModel;