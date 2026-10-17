const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== PHASE B REMEDIATION: COMPLIANCE & ACCOUNT DELETION VERIFICATION ===');

let totalTests = 0;
let passedTests = 0;

function it(description, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ✓ ${description}`);
    } catch (err) {
        console.error(`  ✗ ${description}`);
        console.error(`    ${err.message}`);
        throw err;
    }
}

function describe(suiteName, fn) {
    console.log(`\n--- ${suiteName} ---`);
    fn();
}

const ROOT_DIR = path.resolve(__dirname, '../../..');

// 1. Android Manifest Verification
describe('Patch 1: Android Manifest Permissions & Service Separation', () => {
    const mainManifestPath = path.join(ROOT_DIR, 'mobile/android/app/src/main/AndroidManifest.xml');
    const riderManifestPath = path.join(ROOT_DIR, 'mobile/android/app/src/rider/AndroidManifest.xml');

    it('main (shared/buyer) AndroidManifest.xml exists and is readable', () => {
        assert.ok(fs.existsSync(mainManifestPath), 'Main AndroidManifest.xml must exist');
    });

    const mainContent = fs.readFileSync(mainManifestPath, 'utf8');

    it('removes ACCESS_BACKGROUND_LOCATION from the shared/buyer manifest', () => {
        assert.equal(
            mainContent.includes('android.permission.ACCESS_BACKGROUND_LOCATION'),
            false,
            'Buyer app manifest must not request ACCESS_BACKGROUND_LOCATION (Google Play Policy rejection risk)'
        );
    });

    it('removes FOREGROUND_SERVICE_LOCATION and FOREGROUND_SERVICE from the shared/buyer manifest', () => {
        assert.equal(
            mainContent.includes('android.permission.FOREGROUND_SERVICE_LOCATION'),
            false,
            'Buyer app manifest must not declare FOREGROUND_SERVICE_LOCATION permission'
        );
        assert.equal(
            mainContent.includes('android.permission.FOREGROUND_SERVICE'),
            false,
            'Buyer app manifest must not declare FOREGROUND_SERVICE permission'
        );
    });

    it('removes LocationForegroundService from the shared/buyer manifest', () => {
        assert.equal(
            mainContent.includes('LocationForegroundService'),
            false,
            'Buyer app manifest must not declare LocationForegroundService'
        );
    });

    it('retains necessary buyer location permissions (FINE and COARSE location)', () => {
        assert.ok(
            mainContent.includes('android.permission.ACCESS_FINE_LOCATION'),
            'Buyer app must retain ACCESS_FINE_LOCATION for delivery address selection'
        );
        assert.ok(
            mainContent.includes('android.permission.ACCESS_COARSE_LOCATION'),
            'Buyer app must retain ACCESS_COARSE_LOCATION'
        );
    });

    it('rider AndroidManifest.xml exists and retains rider-specific background location and foreground service', () => {
        assert.ok(fs.existsSync(riderManifestPath), 'Rider AndroidManifest.xml must exist');
        const riderContent = fs.readFileSync(riderManifestPath, 'utf8');

        assert.ok(
            riderContent.includes('android.permission.ACCESS_BACKGROUND_LOCATION'),
            'Rider flavor must retain ACCESS_BACKGROUND_LOCATION for real-time delivery telemetry'
        );
        assert.ok(
            riderContent.includes('android.permission.FOREGROUND_SERVICE_LOCATION'),
            'Rider flavor must retain FOREGROUND_SERVICE_LOCATION'
        );
        assert.ok(
            riderContent.includes('android.permission.FOREGROUND_SERVICE'),
            'Rider flavor must retain FOREGROUND_SERVICE'
        );
        assert.ok(
            riderContent.includes('LocationForegroundService'),
            'Rider flavor must declare LocationForegroundService'
        );
    });
});

// 2. Customer Profile In-App Account Deletion
describe('Patch 2: In-App Account Deletion (Mobile ProfileScreen)', () => {
    const profileScreenPath = path.join(ROOT_DIR, 'mobile/src/screens/ProfileScreen.tsx');

    it('ProfileScreen.tsx exists and is readable', () => {
        assert.ok(fs.existsSync(profileScreenPath), 'ProfileScreen.tsx must exist');
    });

    const profileContent = fs.readFileSync(profileScreenPath, 'utf8');

    it('includes a discoverable Delete Account button with danger styling and Trash2 icon', () => {
        assert.ok(profileContent.includes('Delete Account'), 'Must include "Delete Account" label');
        assert.ok(profileContent.includes('Trash2'), 'Must use Trash2 icon for delete account');
        assert.ok(profileContent.includes('colors.danger'), 'Must apply colors.danger styling');
    });

    it('gates Delete Account action to customer/buyer only (!isRider)', () => {
        assert.ok(
            profileContent.includes('!isRider &&'),
            'Delete Account action in customer profile must be gated so rider profile does not invoke customer endpoint'
        );
    });

    it('prompts user with explicit confirmation dialog explaining consequences', () => {
        assert.ok(
            profileContent.includes('showDialog({'),
            'Must display confirmation dialog via design system showDialog before invoking deletion'
        );
        assert.ok(
            profileContent.includes('permanently delete your account'),
            'Dialog must explicitly explain permanent deletion'
        );
        assert.ok(
            profileContent.includes('personal profile, phone number, and delivery addresses will be permanently removed'),
            'Dialog must explain personal profile data deletion'
        );
        assert.ok(
            profileContent.includes('wallet balance or loyalty points will be forfeited'),
            'Dialog must explain forfeiture of wallet and points'
        );
        assert.ok(
            profileContent.includes('tax invoice records are retained for compliance as required by law'),
            'Dialog must disclose statutory retention of invoice/order records'
        );
    });

    it('calls verified backend endpoint DELETE /customer/me', () => {
        assert.ok(
            profileContent.includes("api.delete('/customer/me')"),
            'Must invoke backend DELETE /customer/me endpoint'
        );
    });

    it('on confirmed deletion, disconnects socket, logs out to navigate to Auth', () => {
        assert.ok(
            profileContent.includes('disconnectSocket()'),
            'Must cleanly disconnect socket connection on account deletion'
        );
        assert.ok(
            profileContent.includes('dispatch(logout())'),
            'Must dispatch logout action to clear auth Redux state and return to auth stack'
        );
    });

    it('on failure or active orders, preserves session and displays actionable error message', () => {
        assert.ok(
            profileContent.includes('Deletion Failed'),
            'Must display "Deletion Failed" dialog title'
        );
        assert.ok(
            profileContent.includes('active order in progress'),
            'Must advise user to wait if an active order is in progress'
        );
    });
});

// 3. Backend Customer Account Deletion & Transaction Safety
describe('Patch 3: Backend Account Deletion Logic, Transaction Safety & Token Purge', () => {
    const customerRoutePath = path.join(ROOT_DIR, 'backend/src/routes/customer.ts');
    const authMiddlewarePath = path.join(ROOT_DIR, 'backend/src/middleware/auth.ts');

    it('backend routes and auth middleware files exist', () => {
        assert.ok(fs.existsSync(customerRoutePath), 'customer.ts route file must exist');
        assert.ok(fs.existsSync(authMiddlewarePath), 'auth.ts middleware file must exist');
    });

    const customerContent = fs.readFileSync(customerRoutePath, 'utf8');
    const authContent = fs.readFileSync(authMiddlewarePath, 'utf8');

    it('enforces transaction safety: rejects deletion when active orders are in progress', () => {
        assert.ok(
            customerContent.includes("status NOT IN ('delivered', 'cancelled')"),
            'Must check for active orders not yet delivered or cancelled'
        );
        assert.ok(
            customerContent.includes("'ACTIVE_ORDERS_EXIST'"),
            'Must return HTTP 400 with ACTIVE_ORDERS_EXIST error code'
        );
    });

    it('anonymizes customer personal profile and marks is_active = false', () => {
        assert.ok(
            customerContent.includes("name = 'Deleted User'"),
            'Must anonymize user name'
        );
        assert.ok(
            customerContent.includes("phone = 'DELETED_' || id"),
            'Must anonymize phone to avoid duplicate unique key conflicts while removing PII'
        );
        assert.ok(
            customerContent.includes("email = NULL"),
            'Must nullify email address'
        );
        assert.ok(
            customerContent.includes("is_active = false"),
            'Must deactivate user account (is_active = false)'
        );
        assert.ok(
            customerContent.includes("deleted_at = NOW()"),
            'Must record soft-deletion timestamp'
        );
    });

    it('purges personal delivery addresses and FCM device tokens', () => {
        assert.ok(
            customerContent.includes('DELETE FROM addresses WHERE customer_id = $1'),
            'Must delete customer saved delivery addresses'
        );
        assert.ok(
            customerContent.includes('DELETE FROM device_tokens WHERE user_id = $1'),
            'Must delete active FCM push notification tokens'
        );
    });

    it('revokes refresh tokens', () => {
        assert.ok(
            customerContent.includes('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1'),
            'Must revoke all issued refresh tokens for deleted user'
        );
    });

    it('clears temporary Redis cart session and invalidates user cache', () => {
        assert.ok(
            customerContent.includes('keys.customerCart(userId)'),
            'Must delete customer cart key from Redis'
        );
        assert.ok(
            customerContent.includes("cancelTriggerJobs('cart_abandoned', userId)"),
            'Must cancel scheduled abandoned cart notifications'
        );
        assert.ok(
            customerContent.includes('invalidateUserCache(userId)'),
            'Must call invalidateUserCache to flush cached metadata'
        );
    });

    it('preserves legally required financial and order records for statutory compliance', () => {
        assert.equal(
            customerContent.includes('DELETE FROM orders WHERE'),
            false,
            'Must NOT delete order records (required for GST/tax compliance)'
        );
        assert.equal(
            customerContent.includes('DELETE FROM payments WHERE'),
            false,
            'Must NOT delete payment transaction records'
        );
    });

    it('auth middleware immediately rejects inactive accounts on subsequent requests', () => {
        assert.ok(
            authContent.includes('!userData || !userData.is_active'),
            'Auth middleware must verify is_active status'
        );
        assert.ok(
            authContent.includes('User deactivated or not found'),
            'Must return 401 when account is deactivated'
        );
    });
});

// 4. Public Web Deletion Request Page & Privacy Policy Linking
describe('Patch 4: Public Web Deletion Page (/delete-account) & Privacy Policy Link', () => {
    const webDeletePagePath = path.join(ROOT_DIR, 'web/app/delete-account/page.tsx');
    const privacyPagePath = path.join(ROOT_DIR, 'web/app/privacy/page.tsx');

    it('/delete-account page exists in the web Next.js application', () => {
        assert.ok(fs.existsSync(webDeletePagePath), 'web/app/delete-account/page.tsx must exist');
    });

    const webDeleteContent = fs.readFileSync(webDeletePagePath, 'utf8');

    it('provides clear step-by-step instructions for in-app deletion and web requests', () => {
        assert.ok(
            webDeleteContent.includes('Inside the Mobile App:'),
            'Must provide in-app deletion steps'
        );
        assert.ok(
            webDeleteContent.includes('Via This Web Form:'),
            'Must provide web deletion request procedure'
        );
    });

    it('includes identity verification form with registered mobile number validation', () => {
        assert.ok(
            webDeleteContent.includes('Registered 10-Digit Mobile Number'),
            'Must require registered mobile number for identity verification'
        );
        assert.ok(
            webDeleteContent.includes('cleanPhone.length !== 10'),
            'Must validate standard 10-digit mobile number format'
        );
    });

    it('accurately discloses data retention and removal timeline under applicable law', () => {
        assert.ok(
            webDeleteContent.includes('Indian Central Goods and Services Tax (CGST) Act, 2017'),
            'Must cite CGST Act 2017 for statutory invoice retention'
        );
        assert.ok(
            webDeleteContent.includes('7 years as mandated by the Indian Central Goods and Services Tax'),
            'Must disclose statutory 7-year retention period for accounting records'
        );
        assert.ok(
            webDeleteContent.includes('within 30 days'),
            'Must disclose maximum processing timeline of 30 days for web requests'
        );
    });

    it('dispatches working request via mailto link to official support email', () => {
        assert.ok(
            webDeleteContent.includes('support@go2qt.com'),
            'Must direct deletion requests to support@go2qt.com'
        );
        assert.ok(
            webDeleteContent.includes('Account Deletion Request'),
            'Must format subject with Account Deletion Request'
        );
    });

    it('Privacy policy links directly to /delete-account', () => {
        assert.ok(fs.existsSync(privacyPagePath), 'privacy/page.tsx must exist');
        const privacyContent = fs.readFileSync(privacyPagePath, 'utf8');

        assert.ok(
            privacyContent.includes('/delete-account'),
            'Privacy policy must contain direct link to /delete-account'
        );
        assert.ok(
            privacyContent.includes('Account Deletion Page'),
            'Privacy policy must clearly label the link as Account Deletion Page'
        );
    });
});

// 5. Phase A Security Regressions Guard
describe('Phase A Regression Guard: Release Signing & API Key Security', () => {
    const buildGradlePath = path.join(ROOT_DIR, 'mobile/android/app/build.gradle');
    const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');

    it('release build type uses signingConfigs.release and never falls back to debug', () => {
        assert.ok(
            buildGradleContent.includes('signingConfig signingConfigs.release'),
            'Release build type must explicitly use signingConfigs.release'
        );
        const releaseBlockMatch = buildGradleContent.match(/release\s*\{([\s\S]*?)\}/);
        assert.ok(releaseBlockMatch, 'Release build type block must exist');
        assert.equal(
            releaseBlockMatch[1].includes('signingConfigs.debug'),
            false,
            'Release build block must never reference signingConfigs.debug'
        );
    });

    it('validates release signing properties at build time', () => {
        assert.ok(
            buildGradleContent.includes('MYAPP_RELEASE_STORE_FILE'),
            'Must require MYAPP_RELEASE_STORE_FILE'
        );
        assert.ok(
            buildGradleContent.includes('MYAPP_RELEASE_KEY_ALIAS'),
            'Must require MYAPP_RELEASE_KEY_ALIAS'
        );
    });

    it('requires GOOGLE_MAPS_API_KEY with no fallback in release builds', () => {
        assert.ok(
            buildGradleContent.includes("'GOOGLE_MAPS_API_KEY'"),
            'requiredProps must include GOOGLE_MAPS_API_KEY'
        );
        assert.ok(
            buildGradleContent.includes('Release builds require an explicitly configured GOOGLE_MAPS_API_KEY'),
            'Release task graph must reject builds without GOOGLE_MAPS_API_KEY'
        );
    });
});

console.log(`\n========================================`);
console.log(`Phase B Test Results: ${passedTests}/${totalTests} tests passed.`);
console.log(`========================================\n`);
