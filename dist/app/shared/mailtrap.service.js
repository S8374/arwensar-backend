"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mailtrapService = exports.MailtrapService = void 0;
// src/shared/mailtrap.service.ts
const mailtrap_1 = require("mailtrap");
const config_1 = require("../../config");
const ApiError_1 = __importDefault(require("../../error/ApiError"));
class MailtrapService {
    constructor() {
        this.client = new mailtrap_1.MailtrapClient({
            token: config_1.config.MAILTRAP.TOKEN,
        });
        this.fromEmail = config_1.config.MAILTRAP.FROM_EMAIL;
        this.fromName = config_1.config.MAILTRAP.FROM_NAME;
        if (!config_1.config.MAILTRAP.TOKEN) {
            throw new Error("MAILTRAP_TOKEN is required in environment variables");
        }
    }
    /**
     * Send HTML email using the new Mailtrap API
     */
    sendHtmlEmail(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { to, subject, html, text, category = "General" } = options;
                const sender = {
                    email: this.fromEmail,
                    name: this.fromName,
                };
                const recipients = [
                    {
                        email: to,
                    },
                ];
                const response = yield this.client.send({
                    from: sender,
                    to: recipients,
                    subject,
                    html,
                    text: text || this.htmlToText(html),
                    category,
                });
                console.log(`✅ HTML email sent to ${to} via Mailtrap. Message ID: ${(_a = response.message_ids) === null || _a === void 0 ? void 0 : _a[0]}`);
                return response;
            }
            catch (error) {
                console.error("Mailtrap HTML email sending error:", error);
                throw new ApiError_1.default(500, `Failed to send HTML email: ${error.message}`);
            }
        });
    }
    /**
     * Send email using template
     */
    sendEmail(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { to, template_uuid, template_variables, html, text, subject, attachments } = options;
                const sender = {
                    email: this.fromEmail,
                    name: this.fromName,
                };
                const recipients = [
                    {
                        email: to,
                    },
                ];
                const emailOptions = {
                    from: sender,
                    to: recipients,
                };
                if (template_uuid) {
                    emailOptions.template_uuid = template_uuid;
                    if (template_variables) {
                        emailOptions.template_variables = template_variables;
                    }
                }
                else {
                    if (!subject || !html) {
                        throw new Error("Subject and HTML content are required for non-template emails");
                    }
                    emailOptions.subject = subject;
                    emailOptions.html = html;
                    emailOptions.text = text || this.htmlToText(html);
                }
                if (attachments) {
                    emailOptions.attachments = attachments;
                }
                const response = yield this.client.send(emailOptions);
                console.log(`✅ Email sent to ${to}. Message ID: ${(_a = response.message_ids) === null || _a === void 0 ? void 0 : _a[0]}`);
                return response;
            }
            catch (error) {
                console.error("Mailtrap email sending error:", error);
                throw new ApiError_1.default(500, `Failed to send email: ${error.message}`);
            }
        });
    }
    /**
     * Send supplier invitation email
     */
    sendSupplierInvitationEmail(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const registrationUrl = `${config_1.config.APP.WEBSITE}/supplier/register?token=${data.invitationToken}`;
            // Use HTML email since we don't have template
            const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Supplier Invitation - ${data.vendorCompany}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin-top: 10px; font-size: 16px;">Join ${data.vendorCompany} on CyberNark</p>
        </div>
        
        <div style="background-color: #fff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #333; margin-top: 0;">Hello ${data.supplierName},</h2>
          
          <p>${data.vendorName} from <strong>${data.vendorCompany}</strong> has invited you to join their supplier network on CyberNark.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #444;">What is CyberNark?</h3>
            <p>CyberNark is a supplier risk assessment platform that helps vendors and suppliers manage compliance, security, and risk assessments efficiently.</p>
          </div>
          
          <p>To complete your registration and access the platform, click the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              Complete Registration
            </a>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Important:</strong> This invitation link will expire in 7 days. If you have any questions, please contact ${data.vendorCompany} directly.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;">
          
          <p style="color: #666; font-size: 14px; margin-bottom: 5px;">
            <strong>Need help?</strong> Contact our support team at <a href="mailto:${config_1.config.APP.SUPPORT_EMAIL}" style="color: #667eea;">${config_1.config.APP.SUPPORT_EMAIL}</a>
          </p>
          
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            This email was sent by CyberNark on behalf of ${data.vendorCompany}. If you believe you received this email in error, please ignore it.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          <p><a href="${config_1.config.APP.WEBSITE}" style="color: #667eea;">Visit our website</a></p>
        </div>
      </body>
      </html>
    `;
            return this.sendHtmlEmail({
                to: data.supplierEmail,
                subject: `Invitation to Join ${data.vendorCompany} on CyberNark`,
                html: htmlContent,
                category: "Supplier Invitation",
            });
        });
    }
    /**
     * Send OTP verification email
     */
    sendOTPEmail(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const subject = data.type === 'password_reset'
                ? 'Password Reset Code - CyberNark'
                : 'Verify Your Email - CyberNark';
            const title = data.type === 'password_reset'
                ? 'Password Reset Code'
                : 'Email Verification Code';
            const message = data.type === 'password_reset'
                ? 'Use the code below to reset your password. This code will expire in 10 minutes.'
                : 'Thank you for registering with CyberNark. Use the code below to verify your email address. This code will expire in 10 minutes.';
            const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - CyberNark</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${title}</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin-top: 10px; font-size: 16px;">CyberNark Security Code</p>
        </div>
        
        <div style="background-color: #fff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #333; margin-top: 0;">Hello ${data.name},</h2>
          
          <p>${message}</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #f8f9fa; border: 2px dashed #667eea; border-radius: 10px; padding: 25px; display: inline-block;">
              <div style="font-size: 40px; font-weight: bold; letter-spacing: 10px; color: #667eea; font-family: 'Courier New', monospace;">
                ${data.otp}
              </div>
            </div>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Security Notice:</strong> Never share this code with anyone. CyberNark will never ask for your verification code.
            </p>
          </div>
          
          <p>If you didn't request this code, please ignore this email or contact our support team immediately.</p>
          
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;">
          
          <p style="color: #666; font-size: 14px; margin-bottom: 5px;">
            <strong>Need help?</strong> Contact our support team at <a href="mailto:${config_1.config.APP.SUPPORT_EMAIL}" style="color: #667eea;">${config_1.config.APP.SUPPORT_EMAIL}</a>
          </p>
          
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            This is an automated email, please do not reply to this message.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          <p><a href="${config_1.config.APP.WEBSITE}" style="color: #667eea;">Visit our website</a></p>
        </div>
      </body>
      </html>
    `;
            return this.sendHtmlEmail({
                to: data.email,
                subject: subject,
                html: htmlContent,
                category: data.type === 'password_reset' ? "Password Reset" : "Email Verification",
            });
        });
    }
    /**
     * Send welcome email
     */
    sendWelcomeEmail(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const subject = data.userType === 'vendor'
                ? 'Welcome to CyberNark - Your Vendor Dashboard is Ready!'
                : 'Welcome to CyberNark - Your Supplier Account is Activated!';
            const dashboardUrl = `${config_1.config.APP.WEBSITE}/dashboard`;
            const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to CyberNark</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 32px;">🎉 Welcome Aboard!</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin-top: 10px; font-size: 18px;">Your CyberNark account is now active</p>
        </div>
        
        <div style="background-color: #fff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #333; margin-top: 0;">Hello ${data.name},</h2>
          
          <p>Welcome to CyberNark! We're excited to have you on board. Your account has been successfully activated and is ready to use.</p>
          
          ${data.userType === 'vendor' ? `
            <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #444;">As a Vendor, you can:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Manage your supplier network</li>
                <li>Conduct risk assessments</li>
                <li>Review compliance evidence</li>
                <li>Generate detailed reports</li>
                <li>Track NIS2 compliance status</li>
              </ul>
            </div>
          ` : `
            <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #444;">As a Supplier, you can:</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Complete assigned assessments</li>
                <li>Upload required evidence</li>
                <li>Track your compliance status</li>
                <li>Communicate with vendors</li>
                <li>Monitor your risk score</li>
              </ul>
            </div>
          `}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              Go to Dashboard
            </a>
          </div>
          
          <div style="background-color: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #2e7d32;">📚 Getting Started Guide</h4>
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li>Complete your profile information</li>
              <li>Explore the dashboard features</li>
              <li>Review any pending tasks</li>
              <li>Check out our documentation</li>
              <li>Contact support if you need help</li>
            </ol>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;">
          
          <div style="display: flex; justify-content: space-between; margin-top: 30px;">
            <div style="text-align: center; flex: 1;">
              <div style="background-color: #667eea; color: white; width: 40px; height: 40px; line-height: 40px; border-radius: 50%; margin: 0 auto 10px; font-size: 20px;">📞</div>
              <p style="margin: 0; font-size: 12px; color: #666;">Support</p>
              <p style="margin: 5px 0 0; font-size: 14px;"><a href="mailto:${config_1.config.APP.SUPPORT_EMAIL}" style="color: #667eea;">${config_1.config.APP.SUPPORT_EMAIL}</a></p>
            </div>
            <div style="text-align: center; flex: 1;">
              <div style="background-color: #667eea; color: white; width: 40px; height: 40px; line-height: 40px; border-radius: 50%; margin: 0 auto 10px; font-size: 20px;">📖</div>
              <p style="margin: 0; font-size: 12px; color: #666;">Documentation</p>
              <p style="margin: 5px 0 0; font-size: 14px;"><a href="${config_1.config.APP.WEBSITE}/docs" style="color: #667eea;">View Docs</a></p>
            </div>
            <div style="text-align: center; flex: 1;">
              <div style="background-color: #667eea; color: white; width: 40px; height: 40px; line-height: 40px; border-radius: 50%; margin: 0 auto 10px; font-size: 20px;">🎓</div>
              <p style="margin: 0; font-size: 12px; color: #666;">Tutorials</p>
              <p style="margin: 5px 0 0; font-size: 14px;"><a href="${config_1.config.APP.WEBSITE}/tutorials" style="color: #667eea;">Learn More</a></p>
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          <p><a href="${config_1.config.APP.WEBSITE}" style="color: #667eea;">Visit our website</a> | <a href="${config_1.config.APP.WEBSITE}/privacy" style="color: #667eea;">Privacy Policy</a></p>
        </div>
      </body>
      </html>
    `;
            return this.sendHtmlEmail({
                to: data.email,
                subject: subject,
                html: htmlContent,
                category: "Welcome Email",
            });
        });
    }
    /**
     * Send password reset email
     */
    sendPasswordResetEmail(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const resetUrl = `${config_1.config.APP.WEBSITE}/reset-password?token=${data.resetToken}`;
            const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - CyberNark</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin-top: 10px; font-size: 16px;">CyberNark Account Security</p>
        </div>
        
        <div style="background-color: #fff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #333; margin-top: 0;">Hello ${data.name},</h2>
          
          <p>We received a request to reset your CyberNark account password. Click the button below to create a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              Reset Password
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
          <p style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px; color: #667eea;">
            ${resetUrl}
          </p>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Security Alert:</strong> This password reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support immediately.
            </p>
          </div>
          
          <p>For security reasons, we recommend:</p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Choose a strong, unique password</li>
            <li>Enable two-factor authentication</li>
            <li>Never share your password with anyone</li>
            <li>Use a password manager</li>
          </ul>
          
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;">
          
          <p style="color: #666; font-size: 14px; margin-bottom: 5px;">
            <strong>Need help?</strong> Contact our support team at <a href="mailto:${config_1.config.APP.SUPPORT_EMAIL}" style="color: #667eea;">${config_1.config.APP.SUPPORT_EMAIL}</a>
          </p>
          
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            This is an automated security email, please do not reply to this message.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>© ${new Date().getFullYear()} CyberNark. All rights reserved.</p>
          <p><a href="${config_1.config.APP.WEBSITE}" style="color: #667eea;">Visit our website</a> | <a href="${config_1.config.APP.WEBSITE}/security" style="color: #667eea;">Security Center</a></p>
        </div>
      </body>
      </html>
    `;
            return this.sendHtmlEmail({
                to: data.email,
                subject: 'Reset Your CyberNark Password',
                html: htmlContent,
                category: "Password Reset",
            });
        });
    }
    /**
     * Convert HTML to plain text
     */
    htmlToText(html) {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Test email connection
     */
    testEmailConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const testResponse = yield this.sendHtmlEmail({
                    to: "test@example.com",
                    subject: "Mailtrap Connection Test - CyberNark",
                    html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; text-align: center;">✅ Mailtrap Connection Test Successful!</h2>
            <p>This is a test email to verify that your Mailtrap configuration is working correctly.</p>
            <p>If you're receiving this email, your email service is properly configured.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">Test sent at: ${new Date().toLocaleString()}</p>
          </div>
        `,
                    text: "Mailtrap Connection Test - This is a test email to verify your Mailtrap configuration is working correctly.",
                });
                console.log("✅ Mailtrap connection test successful");
                return testResponse;
            }
            catch (error) {
                console.error("❌ Mailtrap connection test failed:", error);
                throw error;
            }
        });
    }
}
exports.MailtrapService = MailtrapService;
// Create and export singleton instance
exports.mailtrapService = new MailtrapService();
