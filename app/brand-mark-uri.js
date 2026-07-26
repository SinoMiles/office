// 社交分享图走 next/og（satori）渲染，那里不能直接用 React 组件里的 <svg>，
// 但支持 <img> 引 data URI。标记本身只有几百字节，内联进来比再拉一个静态文件省事，
// 也保证 OG 图和站内导航用的是同一个标记。
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
<defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs>
<rect width="32" height="32" rx="7" fill="url(#t)"/>
<path d="M11.5 6.5H18L23 11.5V23A2.5 2.5 0 0 1 20.5 25.5H11.5A2.5 2.5 0 0 1 9 23V9A2.5 2.5 0 0 1 11.5 6.5Z" fill="#ffffff"/>
<path d="M18 6.5L23 11.5H19.5A1.5 1.5 0 0 1 18 10V6.5Z" fill="#a7f3d0"/>
<rect x="12" y="15" width="8" height="2" rx="1" fill="#059669"/>
<rect x="12" y="19" width="5.5" height="2" rx="1" fill="#6ee7b7"/>
</svg>`;

export const BRAND_MARK_URI = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString('base64')}`;
