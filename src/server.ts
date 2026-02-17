import 'dotenv-flow/config';
import 'module-alias/register';
import { createApp } from './app';
import sequelize from '@config/db';
import schedulerService from '@services/schedulerService';
import { migrateReferralCodes } from '@utils/functions';

const prodPort = Number(process.env.PORT) || 3001;

const { server } = createApp();

async function bootstrap() {
  try {
    await sequelize.sync({ force: false });
    await migrateReferralCodes();

    server.listen(prodPort, () => {
      console.log(`API running on http://localhost:${prodPort}`);
      console.log(`API Docs on http://localhost:${prodPort}/api/docs`);
    });

    schedulerService.startPenaliteChecks();
    schedulerService.startRappelsCotisation();
    schedulerService.startCheckPendingOnboardingSession();
  } catch (error) {
    console.error("❌ Erreur bootstrap serveur", error);
    process.exit(1);
  }
}

bootstrap();