import transporter from "@config/mailer";
import { Request, Response } from "express";

const sender = {
  address: process.env.EMAIL_FROM || '',
  name: "Sendo Team",
};

const payschool = {
  address: process.env.EMAIL_FROM || '',
  name: "PaySchool Team"
}

class EmailController {
  async sendEmail(req: Request, res: Response) {
    try {
      const { from, to, subject, text, html } = req.body;
        if (!to) {
            res.status(400).json({ message: 'Recipient email is required' });
        }
        if (!subject) {
            res.status(400).json({ message: 'Email subject is required' });
        }
        // Send email using the transporter
        await transporter.sendMail({
          from: from || payschool,
          to: to,
          subject: subject || 'No Subject',
          ...(html ? { html } : { text: text || 'No content provided' }),
        });

      res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ message: 'Failed to send email' });
    }
  }
}

export default new EmailController();