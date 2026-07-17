import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from './legal-document.module.css';

export default function LegalDocument({ title, intro, sections }) {
  return (
    <main className={styles.page}>
      <article className={styles.document}>
        <Link href="/" className={styles.back}><ArrowLeft size={16} />返回首页</Link>
        <header className={styles.header}>
          <span>OfficeGPT · 法律文件</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <time>更新日期：2026 年 7 月 17 日</time>
        </header>
        <nav className={styles.switcher} aria-label="法律文件">
          <Link href="/terms">服务条款</Link>
          <Link href="/privacy">隐私政策</Link>
        </nav>
        <div className={styles.content}>
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
