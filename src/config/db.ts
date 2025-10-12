import { Sequelize } from 'sequelize';
import { loadEnv } from './env';

loadEnv();

const sequelize = new Sequelize(
  {
    host: process.env.DB_HOST,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dialect: 'mysql',
    port: Number(process.env.DB_PORT) || 3306,
    logging: console.log,
    timezone: '+00:00',
    define: {
      charset: 'utf8',
      //collate: 'utf8mb4_unicode_ci',
      timestamps: true
    },
    dialectOptions: {
      charset: 'utf8',
      socketPath: null,
      supportBigNumbers: true,
      decimalNumbers: true
    },
    protocol: 'tcp',
  },
);

export default sequelize;