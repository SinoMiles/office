// OfficeGPT 标识。原来用的是 ✦ —— 那个四角星是所有 AI 产品的通用符号，
// 谁都在用，既不说明这个产品做什么，也不具备辨识度。
// 换成产品本身的事：一页带折角的文档，上面有已经排好的内容。
//
// 刻意只用三个形状：16px 的标签页图标上，再多一笔就糊成一团。
export default function BrandMark({ size = 28, radius = 8, title = 'OfficeGPT' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      style={{ display: 'block', flex: 'none' }}
    >
      <defs>
        <linearGradient id="brandmark-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx={radius} fill="url(#brandmark-tile)" />
      {/* 纸面：右上角折起 */}
      <path
        d="M11.5 6.5H18L23 11.5V23A2.5 2.5 0 0 1 20.5 25.5H11.5A2.5 2.5 0 0 1 9 23V9A2.5 2.5 0 0 1 11.5 6.5Z"
        fill="#ffffff"
      />
      <path d="M18 6.5L23 11.5H19.5A1.5 1.5 0 0 1 18 10V6.5Z" fill="#a7f3d0" />
      {/* 内容：一长一短，短的那条淡一档，看着像排过版而不是占位线 */}
      <rect x="12" y="15" width="8" height="2" rx="1" fill="#059669" />
      <rect x="12" y="19" width="5.5" height="2" rx="1" fill="#6ee7b7" />
    </svg>
  );
}
