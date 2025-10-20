import nodemailer, { Transporter } from 'nodemailer';
import { loadEnv } from './env';
import { MailtrapTransport } from "mailtrap"

loadEnv();

const TOKEN = process.env.TOKEN_MAILTRAP_DOMAIN || '';

const transporter = nodemailer.createTransport(
  MailtrapTransport({
    token: TOKEN,
  })
);

transporter.verify((error) => {
  if (error) console.error('SMTP Error:', error);
  else console.log('SMTP Server Ready');
});

/*const transporter: Transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});*/

export default transporter;