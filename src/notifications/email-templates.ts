import { JwtUser } from '../auth/decorators/current-user.decorator';

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export class EmailTemplates {
  private static readonly brandColors = {
    primary: '#064E3B', // Deep Emerald Green
    secondary: '#D97706', // Golden Amber
    dark: '#06392F',
    light: '#F8FAFB',
    success: '#059669',
    danger: '#DC2626',
  };

  private static readonly baseUrl = process.env.WEB_APP_URL || 'https://azzaypharmacy.com';

  static staffInvitation(staffName: string, email: string, temporaryPassword: string, invitedBy: string, branchName: string): EmailTemplate {
    return {
      subject: `Welcome to Azzay Pharmacy - Your Account Details`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Azzay Pharmacy</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${this.brandColors.primary}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .content { background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; }
        .button { display: inline-block; background: ${this.brandColors.primary}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .credentials { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${this.brandColors.primary}; }
        .footer { background: ${this.brandColors.light}; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 8px 8px; }
        .highlight { color: ${this.brandColors.primary}; font-weight: 600; }
        .warning { color: ${this.brandColors.danger}; font-weight: 600; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🏥 Azzay Pharmacy</div>
        <p>Pharmacy Management System</p>
    </div>
    
    <div class="content">
        <h2>Welcome aboard, ${staffName}!</h2>
        <p>You've been invited to join <span class="highlight">${branchName}</span> on Azzay Pharmacy by ${invitedBy}.</p>
        
        <p>Azzay Pharmacy is your comprehensive pharmacy management solution, designed to streamline operations, manage inventory, and serve customers better.</p>
        
        <div class="credentials">
            <h3>Your Login Credentials</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${temporaryPassword}</code></p>
            <p class="warning">⚠️ You must change this password on your first login for security.</p>
        </div>
        
        <a href="${this.baseUrl}/login" class="button">Login to Azzay Pharmacy</a>
        
        <h3>Getting Started</h3>
        <ul>
            <li>Log in with your email and temporary password</li>
            <li>Immediately change your password to something secure</li>
            <li>Complete your profile information</li>
            <li>Explore the dashboard and familiarize yourself with the features</li>
        </ul>
        
        <p>If you have any questions or need assistance, please contact your system administrator.</p>
        
        <p>Best regards,<br>The Azzay Pharmacy Team</p>
    </div>
    
    <div class="footer">
        <p>© 2026 Azzay Pharmacy. All rights reserved.</p>
        <p>This is an automated message. Please do not reply to this email.</p>
    </div>
</body>
</html>
      `,
    };
  }

  static salesReceipt(customerName: string, customerEmail: string, saleDetails: {
    saleId: string;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    vat: number;
    total: number;
    paymentMethod: string;
    date: Date;
    branchName: string;
  }): EmailTemplate {
    const formatCurrency = (amount: number) => `₵${(amount / 100).toFixed(2)}`;
    
    return {
      subject: `Azzay Pharmacy Receipt - Sale #${saleDetails.saleId.slice(-8)}`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Azzay Pharmacy Receipt</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${this.brandColors.primary}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .content { background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; }
        .receipt-header { border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 20px; }
        .receipt-id { font-size: 24px; font-weight: bold; color: ${this.brandColors.primary}; }
        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .items-table th { background: #f9fafb; text-align: left; padding: 12px; border-bottom: 2px solid #e5e7eb; }
        .items-table td { padding: 12px; border-bottom: 1px solid #f3f4f6; }
        .totals { margin-top: 20px; padding: 20px; background: #f9fafb; border-radius: 8px; }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .grand-total { font-size: 20px; font-weight: bold; color: ${this.brandColors.primary}; border-top: 2px solid #e5e7eb; padding-top: 12px; margin-top: 12px; }
        .footer { background: ${this.brandColors.light}; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 8px 8px; }
        .thank-you { text-align: center; margin: 30px 0; font-size: 18px; color: ${this.brandColors.primary}; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🏥 Azzay Pharmacy</div>
        <p>Official Receipt</p>
    </div>
    
    <div class="content">
        <div class="receipt-header">
            <h2>Thank you for your purchase!</h2>
            <p class="receipt-id">Receipt #${saleDetails.saleId.slice(-8)}</p>
            <p><strong>Date:</strong> ${saleDetails.date.toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p><strong>Branch:</strong> ${saleDetails.branchName}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Email:</strong> ${customerEmail}</p>
        </div>
        
        <table class="items-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Unit Price</th>
                    <th style="text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${saleDetails.items.map(item => `
                <tr>
                    <td>${item.name}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">${formatCurrency(item.unitPrice)}</td>
                    <td style="text-align: right;">${formatCurrency(item.total)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="totals">
            <div class="total-row">
                <span>Subtotal:</span>
                <span>${formatCurrency(saleDetails.subtotal)}</span>
            </div>
            <div class="total-row">
                <span>VAT (15%):</span>
                <span>${formatCurrency(saleDetails.vat)}</span>
            </div>
            <div class="total-row grand-total">
                <span>Total Paid:</span>
                <span>${formatCurrency(saleDetails.total)}</span>
            </div>
            <div class="total-row" style="margin-top: 12px;">
                <span>Payment Method:</span>
                <span>${saleDetails.paymentMethod}</span>
            </div>
        </div>
        
        <div class="thank-you">
            Thank you for choosing ${saleDetails.branchName}! 🎉
        </div>
        
        <p>Please keep this receipt for your records. If you have any questions about your purchase, don't hesitate to contact us.</p>
        
        <p>Best regards,<br>The team at ${saleDetails.branchName}</p>
    </div>
    
    <div class="footer">
        <p>© 2026 Azzay Pharmacy. All rights reserved.</p>
        <p>This is an automated receipt. Please do not reply to this email.</p>
    </div>
</body>
</html>
      `,
    };
  }

  static customerWelcome(customerName: string, customerCode: string, branchName: string): EmailTemplate {
    return {
      subject: `Welcome to ${branchName} - Your Customer Account`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Our Pharmacy</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${this.brandColors.primary}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .content { background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; }
        .customer-card { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${this.brandColors.primary}; }
        .benefits { margin: 30px 0; }
        .benefit { display: flex; align-items: center; margin-bottom: 15px; }
        .benefit-icon { font-size: 24px; margin-right: 15px; }
        .footer { background: ${this.brandColors.light}; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 8px 8px; }
        .highlight { color: ${this.brandColors.primary}; font-weight: 600; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🏥 ${branchName}</div>
        <p>Your Trusted Pharmacy Partner</p>
    </div>
    
    <div class="content">
        <h2>Welcome, ${customerName}!</h2>
        <p>Thank you for choosing ${branchName} for your healthcare needs. We're delighted to have you as part of our community.</p>
        
        <div class="customer-card">
            <h3>Your Customer Details</h3>
            <p><strong>Customer Code:</strong> <span class="highlight">${customerCode}</span></p>
            <p>Use this code for quick lookup when you visit our pharmacy.</p>
        </div>
        
        <h3>Benefits of Being Our Customer</h3>
        <div class="benefits">
            <div class="benefit">
                <span class="benefit-icon">💊</span>
                <div>
                    <strong>Quick Refills</strong>
                    <p>Fast prescription refills with just your customer code</p>
                </div>
            </div>
            <div class="benefit">
                <span class="benefit-icon">📱</span>
                <div>
                    <strong>Digital Receipts</strong>
                    <p>Receive receipts instantly via email for every purchase</p>
                </div>
            </div>
            <div class="benefit">
                <span class="benefit-icon">🎁</span>
                <div>
                    <strong>Exclusive Offers</strong>
                    <p>Get notifications about special promotions and health tips</p>
                </div>
            </div>
            <div class="benefit">
                <span class="benefit-icon">⏰</span>
                <div>
                    <strong>Medication Reminders</strong>
                    <p>Optional reminders for when to take your medication</p>
                </div>
            </div>
        </div>
        
        <p>Our trained pharmacists are here to provide you with expert advice and quality care. Whether you need prescription medications, over-the-counter products, or health advice, we're here to help.</p>
        
        <p>Visit us anytime and mention your customer code for personalized service!</p>
        
        <p>Warm regards,<br>The team at ${branchName}</p>
    </div>
    
    <div class="footer">
        <p>© 2026 ${branchName}. Powered by Azzay Pharmacy.</p>
        <p>This is an automated message. Please do not reply to this email.</p>
    </div>
</body>
</html>
      `,
    };
  }

  static passwordReset(staffName: string, resetToken: string, requestedBy: string | null = null): EmailTemplate {
    const resetUrl = `${this.baseUrl}/reset-password?token=${resetToken}`;
    
    return {
      subject: 'Azzay Pharmacy - Password Reset Request',
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - Azzay Pharmacy</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${this.brandColors.primary}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .content { background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; }
        .button { display: inline-block; background: ${this.brandColors.primary}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .alert { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .footer { background: ${this.brandColors.light}; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 8px 8px; }
        .highlight { color: ${this.brandColors.primary}; font-weight: 600; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🏥 Azzay Pharmacy</div>
        <p>Password Reset Request</p>
    </div>
    
    <div class="content">
        <h2>Hello ${staffName},</h2>
        
        ${requestedBy ? `
        <p>Your password has been reset by <span class="highlight">${requestedBy}</span>. Please create a new password to secure your account.</p>
        ` : `
        <p>We received a request to reset your password for your Azzay Pharmacy account. If you didn't make this request, please ignore this email.</p>
        `}
        
        <div class="alert">
            ⚠️ For security reasons, this reset link will expire in <strong>24 hours</strong>.
        </div>
        
        <a href="${resetUrl}" class="button">Reset Your Password</a>
        
        <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6b7280;">${resetUrl}</p>
        
        <h3>Security Tips</h3>
        <ul>
            <li>Choose a strong password with at least 8 characters</li>
            <li>Include uppercase, lowercase, numbers, and symbols</li>
            <li>Don't reuse passwords from other accounts</li>
            <li>Never share your password with anyone</li>
        </ul>
        
        <p>If you continue to have issues accessing your account, please contact your system administrator.</p>
        
        <p>Best regards,<br>The Azzay Pharmacy Team</p>
    </div>
    
    <div class="footer">
        <p>© 2026 Azzay Pharmacy. All rights reserved.</p>
        <p>This is an automated message. Please do not reply to this email.</p>
    </div>
</body>
</html>
      `,
    };
  }

  static passwordChanged(staffName: string): EmailTemplate {
    return {
      subject: 'Azzay Pharmacy - Your Password Was Changed',
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Changed - Azzay Pharmacy</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${this.brandColors.primary}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .content { background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; }
        .notice { background: #ecfdf5; border: 1px solid #34d399; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .alert { background: #fef2f2; border: 1px solid #fca5a5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; background: ${this.brandColors.primary}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .footer { background: ${this.brandColors.light}; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 8px 8px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">🏥 Azzay Pharmacy</div>
        <p>Security Notice</p>
    </div>

    <div class="content">
        <h2>Hello ${staffName},</h2>

        <div class="notice">
            ✅ Your account password was changed successfully.
        </div>

        <p>This message confirms a password update on your Azzay Pharmacy account.</p>

        <div class="alert">
            If you did not perform this action, reset your password immediately and notify your administrator.
        </div>

        <a href="${this.baseUrl}/login" class="button">Open Azzay Pharmacy</a>

        <p>For your security, all active sessions were signed out after the password change.</p>
        <p>Best regards,<br>The Azzay Pharmacy Team</p>
    </div>

    <div class="footer">
        <p>© 2026 Azzay Pharmacy. All rights reserved.</p>
        <p>This is an automated security message. Please do not reply to this email.</p>
    </div>
</body>
</html>
      `,
    };
  }
}
