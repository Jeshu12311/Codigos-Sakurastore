export interface MailMessage {
  id: string;
  sender: string;
  subject: string;
  text: string;
  receivedAt: Date;
}
