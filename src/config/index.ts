import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export const config = {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL as string,
  FRONTEND_URL: process.env.FRONTEND_URL as string,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  
  CLOUDINARY: {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME as string,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY as string,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET as string,
    CLOUDINARY_URL: process.env.CLOUDINARY_URL as string
  },

  EMAIL_SENDER: {
    EMAIL: process.env.EMAIL,
    APP_PASS: process.env.APP_PASS,
  },
  
  jwt: {
    jwt_secret: process.env.JWT_SECRET as string,
    expires_in: process.env.EXPIRES_IN as string,
    refresh_token_secret: process.env.REFRESH_TOKEN_SECRET as string,
    refresh_token_expires_in: process.env.REFRESH_TOKEN_EXPIRES_IN as string,
    reset_pass_secret: process.env.RESET_PASS_TOKEN as string,
    reset_pass_token_expires_in: process.env.RESET_PASS_TOKEN_EXPIRES_IN as string,
  },
  
  SMTP: {
    USER: process.env.SMTP_USER,
    PASS: process.env.SMTP_PASS,
    PORT: Number(process.env.SMTP_PORT),
    HOST: process.env.SMTP_HOST,
    FROM: process.env.SMTP_FROM,
  },
  
  REDIS: {
    HOST: process.env.REDIS_HOST as string,
    PORT: Number(process.env.REDIS_PORT),
    USERNAME: process.env.REDIS_USERNAME,
    PASSWORD: process.env.REDIS_PASSWORD,
  },
  
  APP: {
    NAME: process.env.APP_NAME || "CyberNark",
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || "support@cybernark.com",
    WEBSITE: process.env.APP_WEBSITE || "https://cybernark.com",
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:4000',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    FREE_TRIAL_DAYS: parseInt(process.env.FREE_TRIAL_DAYS || "14"),
  },
  
  MAILTRAP: {
    TOKEN: process.env.MAILTRAP_TOKEN as string,
    FROM_EMAIL: process.env.MAILTRAP_FROM_EMAIL || "noreply@cybernark.com",
    FROM_NAME: process.env.MAILTRAP_FROM_NAME || "CyberNark",
    TEMPLATES: {
      SUPPLIER_INVITATION: process.env.MAILTRAP_SUPPLIER_INVITATION_TEMPLATE as string,
      WELCOME_EMAIL: process.env.MAILTRAP_WELCOME_TEMPLATE as string,
      PASSWORD_RESET: process.env.MAILTRAP_PASSWORD_RESET_TEMPLATE as string,
      OTP_VERIFICATION: process.env.MAILTRAP_OTP_TEMPLATE as string,
      EMAIL_VERIFICATION: process.env.MAILTRAP_EMAIL_VERIFICATION_TEMPLATE as string,
      ASSESSMENT_ASSIGNED: process.env.MAILTRAP_ASSESSMENT_ASSIGNED_TEMPLATE as string,
      REPORT_READY: process.env.MAILTRAP_REPORT_READY_TEMPLATE as string,
      CONTRACT_EXPIRY: process.env.MAILTRAP_CONTRACT_EXPIRY_TEMPLATE as string,
      HIGH_RISK_ALERT: process.env.MAILTRAP_HIGH_RISK_ALERT_TEMPLATE as string,
    }
  },
  
  OTP: {
    EXPIRATION: 60, // 5 minutes in seconds
    LENGTH: 6
  },

  VERIFICATION: {
    EXPIRATION: parseInt(process.env.EMAIL_VERIFICATION_EXPIRATION || "3600"),
  },
  
  STRIPE: {
    SECRET_KEY: process.env.STRIPE_SECRET_KEY as string,
    WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET as string,
    PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY as string,
    DEFAULT_CURRENCY: process.env.STRIPE_DEFAULT_CURRENCY || 'eur',
    FREE_TRIAL_DAYS: Number(process.env.FREE_TRIAL_DAYS || 14),
  },
  
  BIV_SCORING: {
    BUSINESS_IMPACT_WEIGHT: 0.40,
    INTEGRITY_WEIGHT: 0.30,
    AVAILABILITY_WEIGHT: 0.30,
    RISK_THRESHOLDS: {
      HIGH: 40,
      MEDIUM: 70,
      LOW: 100
    }
  },
  
  ASSESSMENT: {
    DEFAULT_PASSING_SCORE: 70,
    AUTO_SUBMIT_HOURS: 72,
  }
} as const;