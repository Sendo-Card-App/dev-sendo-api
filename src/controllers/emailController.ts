import transporter from "@config/mailer";
import UserModel from "@models/user.model";
import { sendGlobalEmail } from "@services/emailService";
import { sendError, sendResponse } from "@utils/apiResponse";
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

  async sendEmailMarketing(req: Request, res: Response) {
    try {
      const { subject, text } = req.body;
      if (!subject || !text) {
        return sendError(res, 400, 'subject and text is required', []);
      }

      const allUsers = await UserModel.findAll({
        attributes: ['email', 'firstname'],
        where: { status: 'ACTIVE' }
      })

      for (const user of allUsers) {
        await sendGlobalEmail(
          user.email,
          subject,
          `<p>Bonjour ${user.firstname},<br> ${text}</p>`,
          'INFORMATION'
        )
      }

      sendResponse(res, 200, 'Email marketing sent successfully');
    } catch (error: any) {
      console.error('Error sending email:', error);
      sendError(res, 500, 'Failed to send email marketing', [error.message]);
    }
  }
}

export default new EmailController();