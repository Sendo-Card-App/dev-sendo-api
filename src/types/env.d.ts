declare namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      PORT: string;
      DATABASE_URL: string;
      JWT_SECRET: string;
      CLOUDINARY_CLOUD_NAME: string;
      CLOUDINARY_API_KEY: string;
      CLOUDINARY_API_SECRET: string;
      SMOBILPAY_CASHIN_MTN_SERVICE: string;
      SMOBILPAY_CASHOUT_MTN_SERVICE: string;
      SMOBILPAY_CASHIN_ORANGE_SERVICE: string;
      SMOBILPAY_CASHOUT_ORANGE_SERVICE: string;
    }
}  