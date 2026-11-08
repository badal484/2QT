import { Router, Request, Response } from 'express';
import { query } from '../db';
import { deletionRequestLimiter } from '../middleware/rateLimiter';

const router = Router();

// ─── Shared Brand Design Tokens ──────────────────────────────────────────────
const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
    background-color: #05050A;
    color: #D4D4D8;
    line-height: 1.6;
    padding: 0;
  }
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 48px 24px 80px 24px;
  }
  .brand-badge {
    display: inline-flex;
    align-items: center;
    background: rgba(255, 107, 53, 0.12);
    border: 1px solid rgba(255, 107, 53, 0.3);
    color: #FF6B35;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 4px 12px;
    border-radius: 9999px;
    margin-bottom: 20px;
  }
  h1 { color: #FFFFFF; font-size: 32px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.5px; }
  .subtitle { color: #71717A; font-size: 14px; margin-bottom: 36px; }
  h2 { color: #FFFFFF; font-size: 18px; font-weight: 700; margin: 28px 0 12px 0; }
  h3 { color: #E4E4E7; font-size: 15px; font-weight: 600; margin-bottom: 6px; }
  p { margin-bottom: 14px; font-size: 14px; color: #A1A1AA; }
  ul, ol { margin-left: 20px; margin-bottom: 16px; font-size: 14px; color: #A1A1AA; }
  li { margin-bottom: 6px; }
  a { color: #FF6B35; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .card {
    background: rgba(24, 24, 27, 0.6);
    border: 1px solid #27272A;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
  }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } }
  .alert-danger { background: rgba(127, 29, 29, 0.2); border: 1px solid rgba(185, 28, 28, 0.35); border-radius: 12px; padding: 16px; }
  .alert-warning { background: rgba(120, 53, 15, 0.2); border: 1px solid rgba(180, 83, 9, 0.35); border-radius: 12px; padding: 16px; }
  .alert-success { background: rgba(6, 78, 59, 0.25); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 12px; padding: 24px; text-align: center; }
  .form-group { margin-bottom: 20px; }
  label { display: block; font-size: 13px; font-weight: 600; color: #FFFFFF; margin-bottom: 8px; }
  input[type="tel"], textarea {
    width: 100%;
    background: #09090B;
    border: 1px solid #3F3F46;
    border-radius: 10px;
    padding: 12px 14px;
    color: #FFFFFF;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
  }
  input[type="tel"]:focus, textarea:focus { border-color: #FF6B35; }
  .checkbox-group { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 24px; }
  .checkbox-group input { margin-top: 3px; accent-color: #FF6B35; cursor: pointer; }
  .checkbox-group label { font-size: 13px; color: #A1A1AA; font-weight: 400; cursor: pointer; }
  .btn {
    display: inline-block;
    background: #FF6B35;
    color: #FFFFFF;
    font-size: 14px;
    font-weight: 700;
    padding: 14px 28px;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    width: 100%;
    transition: opacity 0.15s;
  }
  .btn:hover { opacity: 0.9; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .error-banner { background: rgba(220, 38, 38, 0.15); border: 1px solid rgba(220, 38, 38, 0.4); color: #FCA5A5; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; display: none; }
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #27272A; font-size: 13px; color: #71717A; text-align: center; }
`;

// ─── Public Privacy Policy Route ─────────────────────────────────────────────
router.get(['/privacy', '/privacy-policy'], (req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — Eigen Foods Delivery</title>
  <meta name="description" content="Official Privacy Policy for the Eigen Foods Delivery platform.">
  <style>${STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="brand-badge">EIGEN FOODS</div>
    <h1>Privacy Policy</h1>
    <p class="subtitle">Effective Date: August 2026 · Last Updated: October 2026</p>

    <div class="card">
      <h2>1. Introduction</h2>
      <p><strong>Eigen Foods</strong> ("Company", "we", "us", or "our") operates the food delivery platform, accessible via our mobile applications and websites. We respect your privacy and are committed to protecting your personal data in accordance with applicable Indian laws, including the <em>Information Technology Act, 2000</em> and the <em>Consumer Protection (E-Commerce) Rules, 2020</em>.</p>
    </div>

    <div class="card">
      <h2>2. Information We Collect</h2>
      <p>We collect only the information necessary to provide, fulfill, and improve our food delivery service:</p>
      <ul>
        <li><strong>Account Information:</strong> Your mobile phone number (used for secure OTP authentication), full name, and email address (optional).</li>
        <li><strong>Delivery Information:</strong> Physical delivery addresses, saved landmark instructions, and recipient contact details.</li>
        <li><strong>Location Data:</strong> Approximate and precise geolocation when using the app to browse local cloud kitchens and track live orders. <em>We do not track your location in the background.</em></li>
        <li><strong>Payment & Transaction Data:</strong> Payment transaction identifiers and order histories. All credit/debit card, UPI, and net-banking transactions are securely processed by our RBI-licensed payment gateway partner (Razorpay). <strong>We never store your credit/debit card numbers or CVV on our servers.</strong></li>
        <li><strong>Device & Diagnostic Data:</strong> Device model, OS version, app version, and crash logs (collected via Sentry) to resolve software errors.</li>
      </ul>
    </div>

    <div class="card">
      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>Authenticating your account and maintaining your session.</li>
        <li>Processing your food orders and routing them to the assigned cloud kitchen.</li>
        <li>Facilitating doorstep delivery via our delivery fleet (riders receive your delivery address and masked contact details only during active delivery).</li>
        <li>Sending critical transactional updates (order confirmation, prep status, live rider dispatch) via push notifications, SMS, or WhatsApp.</li>
        <li>Processing refunds and managing Eigen Foods Wallet credits.</li>
        <li>Complying with statutory accounting, GST tax invoicing, and food safety regulations.</li>
      </ul>
    </div>

    <div class="card">
      <h2>4. Third-Party Disclosures & Service Partners</h2>
      <p>We never sell, rent, or trade your personal data. We share information only with trusted service partners under strict confidentiality:</p>
      <ul>
        <li><strong>Delivery Fleet:</strong> Delivery executives receive order items, address, and delivery instructions strictly during active fulfillment.</li>
        <li><strong>Payment Gateway (Razorpay):</strong> Transaction details for processing payments and settling refunds.</li>
        <li><strong>SMS & Communications (MSG91):</strong> Mobile number for delivering one-time passwords (OTP).</li>
        <li><strong>Push Notifications (Google Firebase):</strong> Device tokens for real-time order status notifications.</li>
        <li><strong>Legal & Regulatory Authorities:</strong> Only when required by Indian law or judicial process.</li>
      </ul>
    </div>

    <div class="card">
      <h2>5. Location Data Usage</h2>
      <p>The Eigen Foods Customer App requests access to <strong>Location (ACCESS_FINE_LOCATION and ACCESS_COARSE_LOCATION)</strong> strictly while the application is in use. This permission is required to detect whether you are within an active cloud-kitchen delivery zone and to display real-time rider approach on the order tracking map. The customer app does <strong>not</strong> request or use background location.</p>
    </div>

    <div class="card">
      <h2>6. Data Retention & Account Deletion</h2>
      <p>You have the right to request the permanent deletion of your Eigen Foods account and associated personal data at any time:</p>
      <ul>
        <li><strong>In-App Deletion:</strong> Open the Eigen Foods Customer App → Navigate to <em>Profile</em> → Scroll to <em>Support</em> → Tap <em>Delete Account</em>. Deletion of your personal profile, addresses, and device tokens occurs immediately.</li>
        <li><strong>Online Web Deletion:</strong> If you cannot access the app, you may submit a request through our public <a href="/delete-account"><strong>Account Deletion Request Page</strong></a>.</li>
      </ul>
      <p><strong>Legal Retention Exemption:</strong> In accordance with the <em>Central Goods and Services Tax (CGST) Act, 2017</em>, historical financial transaction ledgers, tax invoices, and accounting records must be retained for a statutory period of 7 years. Personal identifying details (profile photo, delivery address, notification tokens) are permanently purged or anonymized.</p>
    </div>

    <div class="card">
      <h2>7. Children's Privacy</h2>
      <p>Our service is directed exclusively to individuals aged 18 and older. We do not knowingly collect personal information from children under 18 years of age.</p>
    </div>

    <div class="card">
      <h2>8. Contact & Grievance Redressal</h2>
      <p>In accordance with the <em>Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</em>, you may contact our Grievance Officer regarding your personal data:</p>
      <p><strong>Eigen Foods</strong><br>
      Attn: Privacy & Grievance Officer<br>
      Email: <a href="mailto:support@eigenfoods.app">support@eigenfoods.app</a><br>
      Registered Location: Ranchi, Jharkhand, India</p>
    </div>

    <div class="footer">
      <p>&copy; 2026 Eigen Foods. All rights reserved.</p>
      <p style="margin-top: 8px;"><a href="/delete-account">Request Account Deletion</a> · <a href="/privacy">Privacy Policy</a></p>
    </div>
  </div>
</body>
</html>`;
  res.type('html').send(html);
});

// ─── Public Account Deletion Page Route ──────────────────────────────────────
router.get('/delete-account', (req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Request Account & Data Deletion — Eigen Foods</title>
  <meta name="description" content="Submit a formal request to permanently delete your Eigen Foods customer account and personal data.">
  <style>${STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="brand-badge">EIGEN FOODS · ACCOUNT & DATA PRIVACY</div>
    <h1>Request Account & Data Deletion</h1>
    <p class="subtitle">Compliant with Google Play Developer Policies and Indian Data Protection Regulations</p>

    <div class="card">
      <h2>How Account Deletion Works</h2>
      <p>You can delete your account using either of two methods:</p>
      <ol>
        <li><strong>Inside the Eigen Foods Mobile App (Instant):</strong> Open the Eigen Foods app → Go to <strong>Profile</strong> → Scroll to <strong>Support</strong> → Tap <strong style="color: #F87171;">Delete Account</strong>. If you have no active orders in progress, your account and personal data are deleted immediately.</li>
        <li><strong>Via This Web Form (For uninstalled apps):</strong> If you no longer have the app installed or cannot access your phone, enter your registered 10-digit mobile number below. Our privacy team will record your request, verify identity, and process deletion within 30 days.</li>
      </ol>
    </div>

    <div class="grid-2" style="margin-bottom: 24px;">
      <div class="alert-danger">
        <h3 style="color: #FCA5A5;">What Will Be Deleted Permanently:</h3>
        <ul>
          <li>Full name and profile details</li>
          <li>Registered mobile number and email</li>
          <li>All saved delivery addresses and GPS landmarks</li>
          <li>Push notification device tokens</li>
          <li>Unused wallet balances & loyalty points (forfeited)</li>
        </ul>
      </div>
      <div class="alert-warning">
        <h3 style="color: #FCD34D;">What Is Retained by Law:</h3>
        <ul>
          <li>Order payment IDs and transaction records</li>
          <li>Tax invoices and GST audit ledgers</li>
          <li><strong>Retention Period:</strong> 7 years as mandated by the Indian Central Goods and Services Tax (CGST) Act, 2017</li>
        </ul>
      </div>
    </div>

    <!-- Confirmation Banner (Shown After Server Submission) -->
    <div id="confirmation-view" class="alert-success" style="display: none; margin-bottom: 32px;">
      <div style="font-size: 40px; margin-bottom: 12px;">✅</div>
      <h2 style="color: #34D399; margin: 0 0 8px 0;">Account Deletion Request Received</h2>
      <p style="color: #E4E4E7; font-size: 15px; margin-bottom: 12px;">
        Your formal deletion request has been registered under Tracking ID:<br>
        <strong id="request-id-display" style="color: #FF6B35; font-family: monospace; font-size: 16px;"></strong>
      </p>
      <p style="color: #A1A1AA; font-size: 13px; max-width: 600px; margin: 0 auto 16px auto;">
        Registered phone: <strong id="phone-display" style="color: #FFFFFF;"></strong>.<br>
        Our privacy operations team will process personal data deletion within 30 calendar days. 
        You will receive an SMS confirmation once personal data has been purged.
      </p>
      <p style="font-size: 12px; color: #71717A;">
        Note: Submitting this web form initiates an official deletion request. Orders currently out for delivery must complete before deletion is finalized.
      </p>
    </div>

    <!-- Web Deletion Request Form -->
    <div id="form-card" class="card">
      <h2>Submit Web Deletion Request</h2>
      <div id="error-box" class="error-banner"></div>

      <form id="deletion-form">
        <div class="form-group">
          <label for="phone">Registered Mobile Number (10 Digits)</label>
          <div style="display: flex; gap: 8px;">
            <span style="background: #18181B; border: 1px solid #3F3F46; padding: 12px 14px; border-radius: 10px; color: #A1A1AA; font-size: 14px;">+91</span>
            <input type="tel" id="phone" name="phone" placeholder="9876543210" maxlength="10" required>
          </div>
        </div>

        <div class="form-group">
          <label for="reason">Reason for Leaving (Optional)</label>
          <textarea id="reason" name="reason" rows="3" placeholder="Tell us why you want to delete your account..." maxlength="500"></textarea>
        </div>

        <div class="checkbox-group">
          <input type="checkbox" id="terms" name="terms" required>
          <label for="terms">
            I acknowledge that this action requests permanent deletion of my Eigen Foods personal profile, saved addresses, and wallet balance. I understand that statutory GST tax invoices and accounting records must be retained for 7 years under Indian law.
          </label>
        </div>

        <button type="submit" id="submit-btn" class="btn">Submit Deletion Request</button>
      </form>
    </div>

    <div class="footer">
      <p>&copy; 2026 Eigen Foods. All rights reserved.</p>
      <p style="margin-top: 8px;"><a href="/privacy">Back to Privacy Policy</a></p>
    </div>
  </div>

  <script>
    const form = document.getElementById('deletion-form');
    const submitBtn = document.getElementById('submit-btn');
    const errorBox = document.getElementById('error-box');
    const formCard = document.getElementById('form-card');
    const confirmationView = document.getElementById('confirmation-view');
    const requestIdDisplay = document.getElementById('request-id-display');
    const phoneDisplay = document.getElementById('phone-display');

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      errorBox.style.display = 'none';

      const phoneVal = document.getElementById('phone').value.trim();
      const reasonVal = document.getElementById('reason').value.trim();
      const termsChecked = document.getElementById('terms').checked;

      const digits = phoneVal.replace(/\\D/g, '');
      if (digits.length !== 10) {
        errorBox.textContent = 'Please enter a valid 10-digit Indian mobile number.';
        errorBox.style.display = 'block';
        return;
      }

      if (!termsChecked) {
        errorBox.textContent = 'Please check the box to acknowledge data deletion terms.';
        errorBox.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting Request...';

      try {
        const response = await fetch('/api/v1/customer/deletion-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: digits,
            reason: reasonVal,
            confirmed: true
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Failed to submit request.');
        }

        // Show confirmation
        requestIdDisplay.textContent = data.requestId;
        phoneDisplay.textContent = '+91 ' + digits;
        formCard.style.display = 'none';
        confirmationView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

      } catch (err) {
        errorBox.textContent = err.message || 'An error occurred. Please try again.';
        errorBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Deletion Request';
      }
    });
  </script>
</body>
</html>`;
  res.type('html').send(html);
});

// ─── Public API: Handle Server-Backed Deletion Request ────────────────────────
router.post('/api/v1/customer/deletion-request', deletionRequestLimiter, async (req: Request, res: Response) => {
  try {
    const { phone, reason, confirmed } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'INVALID_PHONE', message: 'Phone number is required.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'INVALID_PHONE', message: 'Must be a 10-digit Indian mobile number.' });
    }

    if (!confirmed) {
      return res.status(400).json({ error: 'TERMS_NOT_ACCEPTED', message: 'You must acknowledge the deletion terms.' });
    }

    const normalizedPhone = '91' + cleanPhone;
    const sanitizedReason = reason ? String(reason).trim().slice(0, 500) : null;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const userAgent = req.headers['user-agent'] ? String(req.headers['user-agent']).slice(0, 255) : null;

    // Ensure the table exists in PostgreSQL
    await query(`
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) NOT NULL,
        reason TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        resolved_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Insert deletion request record
    const { rows } = await query(`
      INSERT INTO account_deletion_requests (phone, reason, ip_address, user_agent, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, created_at
    `, [normalizedPhone, sanitizedReason, clientIp, userAgent]);

    const requestId = rows[0]?.id || `DEL-${Date.now()}`;

    return res.status(201).json({
      success: true,
      requestId,
      phone: `+91 ${cleanPhone.slice(0, 2)}****${cleanPhone.slice(6)}`,
      message: 'Account deletion request recorded successfully. Our team will verify and complete deletion within 30 days.',
      estimatedDays: 30
    });
  } catch (err: any) {
    console.error('[ACCOUNT_DELETION_REQUEST_ERROR]', err.message);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Unable to process your deletion request right now. Please try again later or contact support@eigenfoods.app.'
    });
  }
});

export default router;
