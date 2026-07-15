import User from '@/models/User';
import SystemSetting from '@/models/SystemSetting';

export async function seedDatabase() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const existingAdmin = adminEmail ? await User.findOne({ email: adminEmail }) : null;
    if (adminEmail && adminPassword && !existingAdmin) {
      console.log('Seeding admin user...');
      const admin = new User({
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        balance: 1000000,
        membershipLevel: 'ENTERPRISE'
      });
      await admin.save();
      console.log('Admin user created.');
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
