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
import sequelize from '@config/db';

class PartyCard extends Model<
  InferAttributes<PartyCard>,
  InferCreationAttributes<PartyCard, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare sessionId: string | null | undefined;
  declare partyKey: string | null | undefined;
  declare userId: ForeignKey<UserModel['id']> | null | undefined;
  declare status: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relation
  declare user?: NonAttribute<UserModel>;
}

PartyCard.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    partyKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'WAITING_FOR_INFORMATION',
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    timestamps: true,
    tableName: 'party_cards',
  }
);

export default PartyCard;