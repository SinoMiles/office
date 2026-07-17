import User from '@/models/User';
import SystemSetting from '@/models/SystemSetting';
import { randomBytes } from 'node:crypto';

const DEFAULT_ADMIN_EMAIL = 'sino_miles@foxmail.com';

export async function seedDatabase() {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
      const adminPassword = configuredPassword || randomBytes(18).toString('base64url');
      console.log(`Seeding administrator ${adminEmail}...`);
      const admin = new User({
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        balance: 1000000,
        membershipLevel: 'ENTERPRISE'
      });
      await admin.save();
      console.log(`Administrator created: ${adminEmail}`);
      if (!configuredPassword) {
        console.warn(`[bootstrap] Generated one-time administrator password: ${adminPassword}`);
        console.warn('[bootstrap] Save this password securely. It will not be printed again.');
      }
    } else if (existingAdmin.role !== 'admin') {
      await User.updateOne(
        { _id: existingAdmin._id },
        { $set: { role: 'admin', membershipLevel: 'ENTERPRISE' } },
      );
      console.log(`Existing user promoted to administrator: ${adminEmail}`);
    }

    const billingSettings = await SystemSetting.findOne({ key: 'billing' });
    if (!billingSettings) {
      console.log('Seeding billing settings...');
      const settings = new SystemSetting({
        key: 'billing',
        value: {
          version: 1,
          creditsPerCny: 100,
          reservationInputTokens: 16000,
          reservationOutputTokens: 8192,
          models: {
            default: { inputCreditsPer1K: 2, outputCreditsPer1K: 8, cachedInputCreditsPer1K: 0.5 },
            'deepseek-v4-flash': { inputCreditsPer1K: 2, outputCreditsPer1K: 8, cachedInputCreditsPer1K: 0.5 },
          },
          discountRates: {
            'FREE': 1.0,
            'PRO': 0.8,
            'ENTERPRISE': 0.5
          }
        }
      });
      await settings.save();
      console.log('Billing settings created.');
    }
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}
