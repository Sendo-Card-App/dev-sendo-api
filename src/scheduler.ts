import 'dotenv-flow/config';
import 'module-alias/register';

import schedulerService from '@services/schedulerService';

(async () => {
    await schedulerService.startAnnualFundMaturity();
})();