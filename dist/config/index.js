"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), ".env") });
exports.config = {
    node_env: process.env.NODE_ENV,
    port: process.env.PORT,
    database_url: process.env.DATABASE_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    CLOUDINARY: {
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
        CLOUDINARY_URL: process.env.CLOUDINARY_URL
    },
    EMAIL_SENDER: {
        EMAIL: process.env.EMAIL,
        APP_PASS: process.env.APP_PASS,
    },
    jwt: {
        jwt_secret: process.env.JWT_SECRET,
        expires_in: process.env.EXPIRES_IN,
        refresh_token_secret: process.env.REFRESH_TOKEN_SECRET,
        refresh_token_expires_in: process.env.REFRESH_TOKEN_EXPIRES_IN,
        reset_pass_secret: process.env.RESET_PASS_TOKEN,
        reset_pass_token_expires_in: process.env.RESET_PASS_TOKEN_EXPIRES_IN,
    },
    SMTP: {
        USER: process.env.SMTP_USER,
        PASS: process.env.SMTP_PASS,
        PORT: Number(process.env.SMTP_PORT),
        HOST: process.env.SMTP_HOST,
        FROM: process.env.SMTP_FROM,
    },
    REDIS: {
        HOST: process.env.REDIS_HOST,
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
        TOKEN: process.env.MAILTRAP_TOKEN,
        FROM_EMAIL: process.env.MAILTRAP_FROM_EMAIL || "noreply@cybernark.com",
        FROM_NAME: process.env.MAILTRAP_FROM_NAME || "CyberNark",
        TEMPLATES: {
            SUPPLIER_INVITATION: process.env.MAILTRAP_SUPPLIER_INVITATION_TEMPLATE,
            WELCOME_EMAIL: process.env.MAILTRAP_WELCOME_TEMPLATE,
            PASSWORD_RESET: process.env.MAILTRAP_PASSWORD_RESET_TEMPLATE,
            OTP_VERIFICATION: process.env.MAILTRAP_OTP_TEMPLATE,
            EMAIL_VERIFICATION: process.env.MAILTRAP_EMAIL_VERIFICATION_TEMPLATE,
            ASSESSMENT_ASSIGNED: process.env.MAILTRAP_ASSESSMENT_ASSIGNED_TEMPLATE,
            REPORT_READY: process.env.MAILTRAP_REPORT_READY_TEMPLATE,
            CONTRACT_EXPIRY: process.env.MAILTRAP_CONTRACT_EXPIRY_TEMPLATE,
            HIGH_RISK_ALERT: process.env.MAILTRAP_HIGH_RISK_ALERT_TEMPLATE,
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
        SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
        PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
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
};
