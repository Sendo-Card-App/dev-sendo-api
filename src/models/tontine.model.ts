import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  Association
} from 'sequelize';
import MembreTontineModel from './membre-tontine.model';
import TourDistributionModel from './tour-distribution.model';
import CompteSequestreModel from './compte-sequestre.model';
import { generateAlphaNumeriqueString } from '@utils/functions';
import sequelize from '@config/db';

class TontineModel extends Model<
  InferAttributes<TontineModel>,
  InferCreationAttributes<TontineModel, { omit: 'id' | 'invitationCode' | 'createdAt' | 'updatedAt' | 'lastChecked' }>
> {
  declare id: CreationOptional<number>;
  declare nom: string;
  declare type: 'FIXE' | 'ALEATOIRE' | 'VOTE';
  declare frequence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  declare montant: number;
  declare nombreMembres: number;
  declare ordreRotation: CreationOptional<string | null>;
  declare statutReglement: string | null;
  declare modeVersement: 'AUTOMATIC' | 'MANUAL';
  declare description: string | null;
  declare invitationCode: string;
  declare etat: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  declare lastChecked: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare membres?: NonAttribute<MembreTontineModel[]>;
  declare toursDeDistribution?: NonAttribute<TourDistributionModel[]>;
  declare compteSequestre?: NonAttribute<CompteSequestreModel>;
  declare admin?: NonAttribute<MembreTontineModel>;

  declare static associations: {
    membres: Association<TontineModel, MembreTontineModel>;
    toursDeDistribution: Association<TontineModel, TourDistributionModel>;
    compteSequestre: Association<TontineModel, CompteSequestreModel>;
  };
}

TontineModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nom: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('FIXE', 'ALEATOIRE', 'VOTE'),
      allowNull: false,
    },
    frequence: {
      type: DataTypes.ENUM('DAILY', 'WEEKLY', 'MONTHLY'),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    montant: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    nombreMembres: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    modeVersement: {
      type: DataTypes.ENUM('AUTOMATIC', 'MANUAL'),
      allowNull: true,
    },
    ordreRotation: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('ordreRotation');
        return rawValue ? JSON.parse(rawValue) : null;
      },
      set(value: object | null) {
        this.setDataValue('ordreRotation', value ? JSON.stringify(value) : null);
      },
    },
    statutReglement: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    invitationCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      defaultValue: generateAlphaNumeriqueString(6),
    },
    etat: {
      type: DataTypes.ENUM('ACTIVE', 'SUSPENDED', 'CLOSED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    lastChecked: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date du dernier rappel envoyé',
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'tontines',
    timestamps: true,
    hooks: {
      beforeCreate: async (tontine) => {
        let invitationCode;
        do {
          invitationCode = generateAlphaNumeriqueString(6);
        } while (await TontineModel.findOne({ where: { invitationCode } }));
        tontine.invitationCode = invitationCode;
      },
    },
  }
);

export default TontineModel;