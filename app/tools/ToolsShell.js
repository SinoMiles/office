'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, Grid2X2, Sparkles } from 'lucide-react';
import { toolCategories } from '@/lib/toolsData';
import styles from './tools-shell.module.css';
import { useI18n } from '@/app/i18n/I18nProvider';
import { localizedToolName } from '@/app/i18n/toolNames';

function categoryForPath(pathname) {
  return toolCategories.find((category) =>
    category.tools.some((tool) => pathname === `/tools/${tool.id}`)
  )?.title;
}

export default function ToolsShell({ children }) {
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const activeCategory = categoryForPath(pathname);
  const [openCategory, setOpenCategory] = useState(() => activeCategory || toolCategories[0]?.title);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label={t('tools.nav')}>
        <div className={styles.brandRow}>
          <Link href="/tools" className={styles.brandLink}>
            <span className={styles.brandIcon}><Sparkles size={18} /></span>
            <span>
              <strong>{t('tools.shellTitle')}</strong>
              <small>{t('tools.freeOnline')}</small>
            </span>
          </Link>
          <Link href="/tools" className={styles.allTools} aria-label={t('tools.backAll')}>
            <Grid2X2 size={17} />
          </Link>
        </div>

        <nav className={styles.categoryNav}>
          {toolCategories.map((category, categoryIndex) => {
            const isOpen = openCategory === category.title;
            const isCurrent = activeCategory === category.title;
            return (
              <section className={styles.category} key={category.title}>
                <button
                  type="button"
                  className={`${styles.categoryButton} ${isCurrent ? styles.currentCategory : ''}`}
                  onClick={() => setOpenCategory((current) => current === category.title ? null : category.title)}
                  aria-expanded={isOpen}
                >
                  <span className={styles.categoryIdentity}>
                    <span className={styles.categoryIcon} style={{ background: category.color }}>{category.icon}</span>
                    <span>{t('tools.categories')[categoryIndex]}</span>
                  </span>
                  <ChevronDown className={styles.chevron} data-open={isOpen} size={16} />
                </button>

                <div className={styles.collapse} data-open={isOpen}>
                  <div className={styles.collapseInner}>
                    <div className={styles.toolLinks}>
                      {category.tools.map((tool) => {
                        const isActive = pathname === `/tools/${tool.id}`;
                        return (
                          <Link
                            href={tool.comingSoon ? '#' : `/tools/${tool.id}`}
                            key={tool.id}
                            className={`${styles.toolLink} ${isActive ? styles.activeTool : ''} ${tool.comingSoon ? styles.disabledTool : ''}`}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={(event) => {
                              if (tool.comingSoon) event.preventDefault();
                              else setOpenCategory(category.title);
                            }}
                          >
                            <span className={styles.toolIcon}>{tool.icon}</span>
                            <span className={styles.toolName}>{localizedToolName(tool, locale)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </nav>

        <Link href="/dashboard" className={styles.aiLink}>
          <span className={styles.aiIcon}><Sparkles size={17} /></span>
          <span><strong>Office AI</strong><small>{t('tools.aiComplex')}</small></span>
        </Link>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
