import { ImageResponse } from 'next/og';
import { BRAND_MARK_URI } from '@/app/brand-mark-uri';
import { getAllTools, getToolById } from '@/lib/toolsData';
import { toolSeoEn } from '@/app/i18n/toolSeoEn';

export const alt = 'OfficeGPT document tool';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 每个工具页一张专属分享图 —— 一个文件覆盖全部 50 个工具，
// 无需为每个工具单独导图。
export function generateStaticParams() {
  return getAllTools().filter((tool) => !tool.comingSoon).map((tool) => ({ id: tool.id }));
}

export default async function Image({ params }) {
  const { id } = await params;
  const tool = getToolById(id);
  const english = toolSeoEn(id);
  const title = tool?.name || english?.name || 'OfficeGPT';
  const subtitle = english?.name || tool?.desc || '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #0f172a 0%, #312e81 60%, #4f46e5 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- satori 只认 img，不走 next/image */}
          <img src={BRAND_MARK_URI} width={46} height={46} alt="" />
          <div style={{ fontSize: 29, fontWeight: 700 }}>OfficeGPT</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.14, maxWidth: 1020, letterSpacing: -1.5 }}>{title}</div>
          {subtitle && subtitle !== title ? (
            <div style={{ fontSize: 30, marginTop: 20, color: 'rgba(255,255,255,.75)', maxWidth: 960, lineHeight: 1.4 }}>{subtitle}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', padding: '11px 24px', borderRadius: 999, background: 'rgba(255,255,255,.15)', fontSize: 24 }}>免费在线使用 · 无需注册</div>
          <div style={{ fontSize: 24, color: 'rgba(255,255,255,.6)' }}>officegpt.cn</div>
        </div>
      </div>
    ),
    size,
  );
}
