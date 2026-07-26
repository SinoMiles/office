import Link from 'next/link';
import { headers } from 'next/headers';
import { Check, Sparkles } from 'lucide-react';
import { connectToDatabase } from '@/lib/db';
import { absoluteUrl } from '@/lib/seo';
import { normalizeBillingSettings } from '@/lib/billing/pricing';
import { listPlans, normalizePlanSettings, quotePlan } from '@/lib/billing/plans';
import SystemSetting from '@/models/SystemSetting';
import { normalizeLocale } from '@/app/i18n/config';
import { publicMetadata, localizedPath } from '@/app/i18n/publicSeo';

export const dynamic = 'force-dynamic';

const COPY = {
  'zh-CN': {
    title: 'OfficeGPT 价格与会员套餐',
    description: '按 Token 实际用量计费，免费额度可直接使用。专业版与企业版提供折扣与每月赠送额度，支持月付、季付和年付。',
    heading: '简单透明的定价',
    sub: '所有确定性文档工具永久免费。AI 能力按实际 Token 用量结算，会员享受折扣与每月赠送额度。',
    free: '免费版',
    freePrice: '¥0',
    freeDesc: '无需注册即可使用全部 35 个文档转换与处理工具',
    freeItems: ['35 个文档工具全部可用', 'Word / Excel / PPT / PDF 互转', '按需充值使用 AI 能力', '文件处理后即时删除'],
    perMonth: '/月起',
    monthlyCredits: '每月赠送额度',
    discount: 'Token 折扣',
    cta: '立即订阅',
    freeCta: '免费开始使用',
    faqTitle: '常见问题',
    creditTitle: 'Credits 怎么算？',
    creditBody: (rate) => `1 元人民币 = ${rate} Credits。Credits 按模型实际返回的输入、输出与缓存 Token 用量结算，不足 1 Credit 的部分按小数计费，用多少扣多少。`,
    faqs: [
      ['文档转换工具需要付费吗？', '不需要。Word 转 PDF、PDF 拆分合并、Excel 清洗等 35 个确定性工具永久免费，且无需注册即可使用。'],
      ['Credits 会过期吗？', '不会。充值和赠送的 Credits 长期有效，账户余额不设有效期。'],
      ['会员到期后余额还在吗？', '在。会员到期只影响折扣倍率和每月赠送，已有的 Credits 余额不受影响，可以继续使用。'],
      ['可以退款吗？', '可以。请联系客服说明订单号，我们会按微信支付原路退回，已发放的 Credits 会按退款比例扣回。'],
      ['支持哪些支付方式？', '目前支持微信支付扫码。企业客户如需对公转账或发票，请联系我们。'],
    ],
  },
  en: {
    title: 'OfficeGPT Pricing and Membership Plans',
    description: 'Pay only for the tokens you actually use. All 35 document tools are free forever. Pro and Enterprise plans add discounted token rates and monthly credit grants.',
    heading: 'Straightforward pricing',
    sub: 'Every deterministic document tool is free forever. AI features are billed on actual token usage, and members get discounted rates plus a monthly credit grant.',
    free: 'Free',
    freePrice: '¥0',
    freeDesc: 'Use all 35 document conversion and processing tools without an account',
    freeItems: ['All 35 document tools', 'Word / Excel / PPT / PDF conversion', 'Top up to use AI features', 'Files deleted right after processing'],
    perMonth: '/month from',
    monthlyCredits: 'Monthly credits',
    discount: 'Token discount',
    cta: 'Subscribe',
    freeCta: 'Start for free',
    faqTitle: 'Frequently asked questions',
    creditTitle: 'How are Credits calculated?',
    creditBody: (rate) => `¥1 buys ${rate} Credits. Credits are settled against the input, output and cached token counts the model actually reports, down to fractional amounts — you pay for exactly what you use.`,
    faqs: [
      ['Do the document tools cost anything?', 'No. Word to PDF, PDF split and merge, Excel cleanup and the other 32 deterministic tools are free forever, and no account is required.'],
      ['Do Credits expire?', 'No. Both purchased and granted Credits stay in your balance indefinitely.'],
      ['What happens to my balance when a plan expires?', 'It stays. Expiry only removes the discount rate and monthly grant; your existing Credits remain usable.'],
      ['Can I get a refund?', 'Yes. Contact support with your order number and we will refund through WeChat Pay. Granted Credits are clawed back in proportion to the refund.'],
      ['Which payment methods are supported?', 'WeChat Pay QR code today. Enterprise customers needing bank transfer or invoicing should contact us.'],
    ],
  },
};

export async function generateMetadata() {
  const locale = normalizeLocale((await headers()).get('x-office-locale'));
  const copy = COPY[locale] || COPY['zh-CN'];
  const shared = publicMetadata(locale, '/pricing');
  return {
    ...shared,
    title: copy.title,
    description: copy.description,
    openGraph: { ...shared.openGraph, title: copy.title, description: copy.description, url: localizedPath(locale, '/pricing') },
  };
}

async function loadPricing() {
  try {
    await connectToDatabase();
    const [planSetting, billingSetting] = await Promise.all([
      SystemSetting.findOne({ key: 'plans' }).lean(),
      SystemSetting.findOne({ key: 'billing' }).lean(),
    ]);
    return { planSettings: planSetting?.value || {}, billing: normalizeBillingSettings(billingSetting?.value || {}) };
  } catch {
    // 定价页是纯营销页，数据库不可用时也要能渲染出默认套餐，不能因此 500。
    return { planSettings: {}, billing: normalizeBillingSettings({}) };
  }
}

export default async function PricingPage() {
  const locale = normalizeLocale((await headers()).get('x-office-locale'));
  const copy = COPY[locale] || COPY['zh-CN'];
  const { planSettings, billing } = await loadPricing();
  const { periods } = normalizePlanSettings(planSettings);
  const plans = listPlans(planSettings).map((plan) => ({
    ...plan,
    discountRate: billing.discountRates[plan.membershipLevel] ?? 1,
    quotes: periods.map((period) => quotePlan(planSettings, plan.id, period.months)).filter(Boolean),
  }));

  const route = localizedPath(locale, '/pricing');
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      ...plans.map((plan) => ({
        '@type': 'Product',
        name: `OfficeGPT ${plan.name}`,
        description: plan.highlights.join('; '),
        url: absoluteUrl(route),
        brand: { '@type': 'Brand', name: 'OfficeGPT' },
        offers: plan.quotes.map((quote) => ({
          '@type': 'Offer',
          name: quote.periodLabel,
          price: (quote.amountFen / 100).toFixed(2),
          priceCurrency: 'CNY',
          availability: 'https://schema.org/InStock',
          url: absoluteUrl(route),
        })),
      })),
      {
        '@type': 'FAQPage',
        mainEntity: copy.faqs.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'OfficeGPT', item: absoluteUrl(localizedPath(locale, '/')) },
          { '@type': 'ListItem', position: 2, name: locale === 'zh-CN' ? '价格' : 'Pricing', item: absoluteUrl(route) },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      <main className="container" style={{ padding: '72px 20px 96px', maxWidth: '1120px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{ fontSize: '2.6rem', fontWeight: 800, marginBottom: '14px' }}>{copy.heading}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '680px', margin: '0 auto', lineHeight: 1.75 }}>{copy.sub}</p>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`, gap: '20px', marginBottom: '56px' }}>
          <article style={{ padding: '30px', borderRadius: '18px', border: '1px solid var(--border)', background: 'white', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{copy.free}</h2>
            <div style={{ fontSize: '2.6rem', fontWeight: 800, margin: '10px 0 4px', lineHeight: 1 }}>{copy.freePrice}</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', minHeight: '44px', lineHeight: 1.6 }}>{copy.freeDesc}</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 26px', display: 'grid', gap: '10px', flex: 1 }}>
              {copy.freeItems.map((item) => (
                <li key={item} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <Check size={15} color="#059669" style={{ flexShrink: 0, marginTop: '3px' }} /><span>{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/tools" className="btn btn-outline" style={{ justifyContent: 'center', padding: '12px' }}>{copy.freeCta}</Link>
          </article>

          {plans.map((plan, index) => {
            const monthly = plan.quotes.find((quote) => quote.periodMonths === 1) || plan.quotes[0];
            const featured = index === 0;
            return (
              <article key={plan.id} style={{ position: 'relative', padding: '30px', borderRadius: '18px', border: `1.5px solid ${featured ? 'var(--primary)' : 'var(--border)'}`, background: featured ? 'linear-gradient(160deg, rgba(79,70,229,.05), rgba(99,102,241,.09))' : 'white', display: 'flex', flexDirection: 'column' }}>
                {featured && <span style={{ position: 'absolute', top: '-11px', left: '30px', padding: '3px 12px', borderRadius: '20px', background: 'var(--primary)', color: 'white', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Sparkles size={12} /> {locale === 'zh-CN' ? '最受欢迎' : 'Most popular'}</span>}
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{plan.name}</h2>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '10px 0 4px' }}>
                  <span style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1 }}>¥{(plan.monthlyFen / 100).toFixed(0)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{copy.perMonth}</span>
                </div>
                <div style={{ display: 'flex', gap: '14px', fontSize: '0.82rem', color: 'var(--text-muted)', minHeight: '44px', alignItems: 'center' }}>
                  <span>{copy.monthlyCredits} <b style={{ color: '#059669' }}>{plan.monthlyCredits.toLocaleString(locale)}</b></span>
                  <span>{copy.discount} <b style={{ color: 'var(--primary)' }}>{(plan.discountRate * 10).toFixed(1)}</b></span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 20px', display: 'grid', gap: '10px', flex: 1 }}>
                  {plan.highlights.map((item) => (
                    <li key={item} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      <Check size={15} color="#059669" style={{ flexShrink: 0, marginTop: '3px' }} /><span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {plan.quotes.map((quote) => (
                    <span key={quote.periodMonths} style={{ padding: '5px 10px', borderRadius: '8px', background: 'var(--background)', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {quote.periodLabel} ¥{(quote.amountFen / 100).toFixed(0)}
                      {quote.savedFen > 0 && <b style={{ color: '#059669', marginLeft: '5px' }}>-¥{(quote.savedFen / 100).toFixed(0)}</b>}
                    </span>
                  ))}
                </div>
                <Link href="/dashboard/billing" className={featured ? 'btn btn-primary' : 'btn btn-outline'} style={{ justifyContent: 'center', padding: '12px' }}>
                  {copy.cta} · ¥{((monthly?.amountFen || plan.monthlyFen) / 100).toFixed(0)}
                </Link>
              </article>
            );
          })}
        </section>

        <section style={{ padding: '26px 30px', borderRadius: '16px', background: 'var(--background)', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '10px' }}>{copy.creditTitle}</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, margin: 0 }}>{copy.creditBody(billing.creditsPerCny.toLocaleString(locale))}</p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>{copy.faqTitle}</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {copy.faqs.map(([question, answer]) => (
              <details key={question} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 18px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 650 }}>{question}</summary>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.75, margin: '12px 0 0' }}>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
