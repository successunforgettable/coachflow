import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "ZAP <noreply@zapcampaigns.com>";
const APP_NAME = "ZAP";

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Reset your ${APP_NAME} password`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #111; border-radius: 12px; border: 1px solid #222; overflow: hidden;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #7c3aed, #5b21b6); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">⚡ ZAP</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">AI Marketing Generator</p>
    </div>
    
    <!-- Body -->
    <div style="padding: 32px;">
      <h2 style="color: #fff; margin: 0 0 12px; font-size: 20px;">Reset your password</h2>
      <p style="color: #aaa; margin: 0 0 24px; line-height: 1.6;">
        Hi ${name}, we received a request to reset the password for your ZAP account. 
        Click the button below to choose a new password.
      </p>
      
      <a href="${resetUrl}" 
         style="display: block; background: #7c3aed; color: white; text-decoration: none; 
                padding: 14px 24px; border-radius: 8px; text-align: center; 
                font-weight: 600; font-size: 16px; margin-bottom: 24px;">
        Reset Password →
      </a>
      
      <p style="color: #666; font-size: 13px; margin: 0 0 8px;">
        This link expires in <strong style="color: #aaa;">1 hour</strong>.
      </p>
      <p style="color: #666; font-size: 13px; margin: 0;">
        If you didn't request a password reset, you can safely ignore this email. 
        Your password will not be changed.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="padding: 20px 32px; border-top: 1px solid #222;">
      <p style="color: #444; font-size: 12px; margin: 0; text-align: center;">
        © ${new Date().getFullYear()} ZAP · zapcampaigns.com
      </p>
    </div>
  </div>
</body>
</html>
    `,
    text: `Hi ${name},\n\nWe received a request to reset the password for your ZAP account.\n\nClick this link to reset your password:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request a password reset, you can safely ignore this email.\n\n— The ZAP Team`,
  });

  if (error) {
    console.error("[Email] Failed to send password reset email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  console.log("[Email] Password reset email sent:", data?.id, "to:", to);
  return data;
}

export async function sendWelcomeEmail({
  to,
  name,
}: {
  to: string;
  name: string;
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Welcome to ${APP_NAME} ⚡`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #111; border-radius: 12px; border: 1px solid #222; overflow: hidden;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #7c3aed, #5b21b6); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">⚡ ZAP</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">AI Marketing Generator</p>
    </div>
    
    <!-- Body -->
    <div style="padding: 32px;">
      <h2 style="color: #fff; margin: 0 0 12px; font-size: 20px;">Welcome to ZAP, ${name}! 🎉</h2>
      <p style="color: #aaa; margin: 0 0 16px; line-height: 1.6;">
        Your account is ready. You now have access to all 9 AI marketing generators — 
        ads, emails, WhatsApp sequences, landing pages, and more.
      </p>
      <p style="color: #aaa; margin: 0 0 24px; line-height: 1.6;">
        Start by telling ZAP about your program, and it will generate everything you need 
        to attract your ideal clients.
      </p>
      
      <a href="https://zapcampaigns.com/dashboard" 
         style="display: block; background: #7c3aed; color: white; text-decoration: none; 
                padding: 14px 24px; border-radius: 8px; text-align: center; 
                font-weight: 600; font-size: 16px; margin-bottom: 24px;">
        Go to Dashboard →
      </a>
    </div>
    
    <!-- Footer -->
    <div style="padding: 20px 32px; border-top: 1px solid #222;">
      <p style="color: #444; font-size: 12px; margin: 0; text-align: center;">
        © ${new Date().getFullYear()} ZAP · zapcampaigns.com
      </p>
    </div>
  </div>
</body>
</html>
    `,
    text: `Welcome to ZAP, ${name}!\n\nYour account is ready. Go to your dashboard:\nhttps://zapcampaigns.com/dashboard\n\n— The ZAP Team`,
  });

  if (error) {
    console.error("[Email] Failed to send welcome email:", error);
    // Don't throw — welcome email failure shouldn't block signup
    return null;
  }

  console.log("[Email] Welcome email sent:", data?.id, "to:", to);
  return data;
}
