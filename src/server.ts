import 'dotenv-flow/config';
import 'module-alias/register';
import { createApp } from './app';
import sequelize from '@config/db';
import schedulerService from '@services/schedulerService';
import { migrateReferralCodes } from '@utils/functions';
import ReferralCodeModel from '@models/referral-code.model';
import UserModel from '@models/user.model';

const prodPort = Number(process.env.PORT) || 3001;

const { server: prodServer } = createApp();

sequelize.sync({ force: false }).then(async () => { 
  await migrateReferralCodes();

  prodServer.listen(prodPort, () => {
    console.log(`Test server running on http://localhost:${prodPort}`);
    console.log(`Test API Docs on http://localhost:${prodPort}/api/docs`);
  });
 
  //schedulerService.startCheckTransactionsSmobilpay();
  //schedulerService.startCheckTransactionsNeero();
  schedulerService.startPenaliteChecks();
  schedulerService.startRappelsCotisation();
  schedulerService.startCheckPendingOnboardingSession();
});
