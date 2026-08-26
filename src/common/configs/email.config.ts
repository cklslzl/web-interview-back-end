// 文件路径：src/common/configs/email.config.ts
import { config } from 'dotenv';
config();

export const EMAIL_CONFIG = {
  host: process.env.EMAIL_HOST || 'smtp.163.com',
  port: parseInt(process.env.EMAIL_PORT || '465', 10),
  secure: true,
  auth: {
    user: process.env.EMAIL_FROM || '',
    pass: process.env.EMAIL_PASSWORD || '',
  },
  from: process.env.EMAIL_FROM || '',
};