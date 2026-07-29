import User from '@/models/User';
import SystemSetting from '@/models/SystemSetting';
import Subscription from '@/models/Subscription';
import { normalizeBillingSettings } from '@/lib/billing/pricing';
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
        membershipLevel: 'PRO'
      });
      await admin.save();
      console.log(`Administrator created: ${adminEmail}`);
      if (!configuredPassword) {
        console.warn(`[bootstrap] Generated one-time administrator password: ${adminPassword}`);
        console.warn('[bootstrap] Save this password securely. It will not be printed again.');
      }
    } else if (existingAdmin.role !== 'admin' || existingAdmin.membershipLevel === 'ENTERPRISE') {
      await User.updateOne(
        { _id: existingAdmin._id },
        { $set: { role: 'admin', membershipLevel: 'PRO' } },
      );
      console.log(`Existing user promoted to administrator: ${adminEmail}`);
    }

    const billingSettings = await SystemSetting.findOne({ key: 'billing' });
    if (!billingSettings) {
      console.log('Seeding billing settings...');
      const settings = new SystemSetting({
        key: 'billing',
        value: {
          version: 2,
          creditsPerCny: 1000,
          priceMultiplier: 8,
          reservationInputTokens: 16000,
          reservationOutputTokens: 8192,
        }
      });
      await settings.save();
      console.log('Billing settings created.');
    } else {
      const normalizedBilling = normalizeBillingSettings(billingSettings.value || {});
      if (JSON.stringify(billingSettings.value) !== JSON.stringify(normalizedBilling)) {
        billingSettings.value = normalizedBilling;
        await billingSettings.save();
        console.log('Billing settings migrated to multiplier pricing.');
      }
    }

    await SystemSetting.updateOne({ key: 'plans' }, { $unset: { 'value.plans.ENTERPRISE': '' } });
    await SystemSetting.updateOne(
      {
        key: 'plans',
        $or: [
          { 'value.version': { $lt: 4 } },
          { 'value.plans.PRO.monthlyFen': { $in: [2900] } },
          { 'value.plans.PRO.monthlyCredits': { $in: [3000, 50000] } },
        ],
      },
      {
        $set: {
          'value.version': 4,
          'value.plans.PRO.monthlyFen': 1900,
          'value.plans.PRO.monthlyCredits': 30000,
          'value.plans.PRO.highlights': ['每月赠送 30,000 Credits', '任务并发上限提升至 5', '优先任务队列'],
        },
      },
    );
    await User.updateMany({ membershipLevel: 'ENTERPRISE' }, { $set: { membershipLevel: 'PRO' } });
    await Subscription.updateMany(
      { membershipLevel: 'ENTERPRISE', status: 'active' },
      { $set: { membershipLevel: 'PRO', planId: 'PRO' } },
    );
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}
