import 'dotenv-flow/config';
import 'module-alias/register';
import { createApp } from './app';
import sequelize from '@config/db';
import schedulerService from '@services/schedulerService';

const devPort = Number(process.env.PORT) || 3001;

const { server: devServer } = createApp();

sequelize.sync({ force: false }).then(() => {
  devServer.listen(devPort, () => {
    console.log(`Dev server running on http://localhost:${devPort}`);
    console.log(`Dev API Docs on http://localhost:${devPort}/api/docs`);
  });
  
  //schedulerService.startCheckTransactionsSmobilpay();
  schedulerService.startCheckTransactionsNeero();
  schedulerService.startPenaliteChecks();
  schedulerService.startRappelsCotisation();
  schedulerService.startCheckPendingOnboardingSession();
});
