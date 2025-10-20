import KYCService from '../src/services/kycService';
import { describe, it, expect } from '@jest/globals';

describe('KYCService', () => {
  it('doit extraire le numéro d\'identité depuis une image', async () => {
    const imagePath = 'https://res.cloudinary.com/dviktmefh/image/upload/v1751114798/WhatsApp_Image_2025-06-28_at_13.34.08_88047d20_gw4hev.jpghttps://res.cloudinary.com/dviktmefh/image/upload/v1750717511/bank_files/bank_file_3_1750717511354.pdf';

    const result = await KYCService.recognizeImage(imagePath);

    //expect(result).toMatch(/^\d{7}$|^\d{17}$/);
    expect(result).toEqual(expect.stringMatching(/^\d{7}$|^\d{17}$/));
  });
});