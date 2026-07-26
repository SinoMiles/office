import { ImageResponse } from 'next/og';
import { BRAND_MARK_URI } from '@/app/brand-mark-uri';

export const alt = 'OfficeGPT - AI 智能办公套件与文档处理工具';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 站点级社交分享图。此前 openGraph 完全没有 images，分享到微信 / X / LinkedIn
// 只有一行纯文字链接，点击率明显吃亏。这里用 next/og 在边缘运行时动态生成，
// 不需要往仓库里放静态图片，改文案也不用重新导图。
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 55%, #6366f1 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '34px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- satori 只认 img，不走 next/image */}
          <img src={BRAND_MARK_URI} width={64} height={64} alt="" />
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -0.5 }}>OfficeGPT</div>
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.18, maxWidth: 980, letterSpacing: -1.5 }}>
          AI 智能办公套件
        </div>
        <div style={{ fontSize: 32, marginTop: 22, color: 'rgba(255,255,255,.82)', maxWidth: 900, lineHeight: 1.45 }}>
          Word · Excel · PPT · PDF 转换、分析与生成
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: 44 }}>
          {['50+ 文档工具', '免费使用', '无需安装'].map((tag) => (
            <div key={tag} style={{ display: 'flex', padding: '11px 22px', borderRadius: 999, background: 'rgba(255,255,255,.14)', fontSize: 24 }}>{tag}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
