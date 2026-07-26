const formats = { pdf:'PDF', ppt:'PPT', word:'Word', excel:'Excel', csv:'CSV', json:'JSON', jpg:'JPG', png:'PNG', img:'Images', xls:'XLS', xlsx:'XLSX', ocr:'OCR', ai:'AI' };

const words = {
  en: { to:'to', text:'Text', images:'Images', extract:'Extract', notes:'Notes', clean:'Clean', metadata:'Metadata', page:'Page', numbers:'Numbers', dedupe:'Remove duplicates', merge:'Merge', split:'Split', sheets:'Sheets', columns:'Columns', formula:'Formula', audit:'Audit', workbook:'Workbook', summary:'Summary', watermark:'Watermark', encrypt:'Encrypt', translate:'Translate', polish:'Polish', chat:'Chat', contract:'Contract', review:'Review', document:'Document', compare:'Compare', redact:'Redact', meeting:'Meeting', minutes:'Minutes', weekly:'Weekly', report:'Report', annual:'Annual', resume:'Résumé', analysis:'Analysis', outline:'Outline', official:'Official' },
  ja: { to:'変換', text:'テキスト', images:'画像', extract:'抽出', notes:'ノート', clean:'クリーンアップ', metadata:'メタデータ', page:'ページ', numbers:'番号', dedupe:'重複削除', merge:'結合', split:'分割', sheets:'シート', columns:'列', formula:'数式', audit:'監査', workbook:'ブック', summary:'要約', watermark:'透かし', encrypt:'暗号化', translate:'翻訳', polish:'校正', chat:'対話', contract:'契約書', review:'レビュー', document:'文書', compare:'比較', redact:'墨消し', meeting:'会議', minutes:'議事録', weekly:'週次', report:'報告', annual:'年次', resume:'履歴書', analysis:'分析', outline:'構成案', official:'公文書' },
  ko: { to:'변환', text:'텍스트', images:'이미지', extract:'추출', notes:'노트', clean:'정리', metadata:'메타데이터', page:'페이지', numbers:'번호', dedupe:'중복 제거', merge:'병합', split:'분할', sheets:'시트', columns:'열', formula:'수식', audit:'검사', workbook:'통합 문서', summary:'요약', watermark:'워터마크', encrypt:'암호화', translate:'번역', polish:'교정', chat:'대화', contract:'계약서', review:'검토', document:'문서', compare:'비교', redact:'비식별화', meeting:'회의', minutes:'회의록', weekly:'주간', report:'보고서', annual:'연간', resume:'이력서', analysis:'분석', outline:'개요', official:'공문서' },
  es: { to:'a', text:'Texto', images:'Imágenes', extract:'Extraer', notes:'Notas', clean:'Limpiar', metadata:'metadatos', page:'Página', numbers:'números', dedupe:'Quitar duplicados', merge:'Combinar', split:'Dividir', sheets:'hojas', columns:'columnas', formula:'Fórmulas', audit:'Auditoría', workbook:'Libro', summary:'Resumen', watermark:'Marca de agua', encrypt:'Cifrar', translate:'Traducir', polish:'Mejorar', chat:'Chat', contract:'Contrato', review:'Revisión', document:'Documento', compare:'Comparar', redact:'Ocultar datos', meeting:'Reunión', minutes:'Acta', weekly:'Semanal', report:'Informe', annual:'Anual', resume:'Currículum', analysis:'Análisis', outline:'Esquema', official:'Oficial' },
  pt: { to:'para', text:'Texto', images:'Imagens', extract:'Extrair', notes:'Notas', clean:'Limpar', metadata:'metadados', page:'Página', numbers:'números', dedupe:'Remover duplicados', merge:'Mesclar', split:'Dividir', sheets:'planilhas', columns:'colunas', formula:'Fórmulas', audit:'Auditoria', workbook:'Pasta', summary:'Resumo', watermark:'Marca d’água', encrypt:'Criptografar', translate:'Traduzir', polish:'Aprimorar', chat:'Chat', contract:'Contrato', review:'Revisão', document:'Documento', compare:'Comparar', redact:'Ocultar dados', meeting:'Reunião', minutes:'Ata', weekly:'Semanal', report:'Relatório', annual:'Anual', resume:'Currículo', analysis:'Análise', outline:'Roteiro', official:'Oficial' },
  fr: { to:'vers', text:'Texte', images:'Images', extract:'Extraire', notes:'Notes', clean:'Nettoyer', metadata:'métadonnées', page:'Page', numbers:'numéros', dedupe:'Supprimer les doublons', merge:'Fusionner', split:'Diviser', sheets:'feuilles', columns:'colonnes', formula:'Formules', audit:'Audit', workbook:'Classeur', summary:'Résumé', watermark:'Filigrane', encrypt:'Chiffrer', translate:'Traduire', polish:'Améliorer', chat:'Dialogue', contract:'Contrat', review:'Révision', document:'Document', compare:'Comparer', redact:'Masquer les données', meeting:'Réunion', minutes:'Compte rendu', weekly:'Hebdomadaire', report:'Rapport', annual:'Annuel', resume:'CV', analysis:'Analyse', outline:'Plan', official:'Officiel' },
  de: { to:'zu', text:'Text', images:'Bilder', extract:'Extrahieren', notes:'Notizen', clean:'Bereinigen', metadata:'Metadaten', page:'Seite', numbers:'Nummern', dedupe:'Duplikate entfernen', merge:'Zusammenführen', split:'Teilen', sheets:'Blätter', columns:'Spalten', formula:'Formeln', audit:'Prüfung', workbook:'Arbeitsmappe', summary:'Zusammenfassung', watermark:'Wasserzeichen', encrypt:'Verschlüsseln', translate:'Übersetzen', polish:'Überarbeiten', chat:'Dialog', contract:'Vertrag', review:'Prüfung', document:'Dokument', compare:'Vergleichen', redact:'Schwärzen', meeting:'Besprechung', minutes:'Protokoll', weekly:'Wöchentlich', report:'Bericht', annual:'Jährlich', resume:'Lebenslauf', analysis:'Analyse', outline:'Gliederung', official:'Amtlich' },
};

import { toolSeoEn } from './toolSeoEn';

export function localizedToolName(tool, locale) {
  if (locale === 'zh-CN') return tool.name;
  // 英文有逐个撰写的正式名称，优先用它；机械拼词只作为兜底。
  const authored = locale === 'en' ? toolSeoEn(tool.id)?.name : null;
  if (authored) return authored;
  const dictionary = words[locale] || words.en;
  const parts = tool.id.split('-');
  const toIndex = parts.indexOf('to');
  if (toIndex > 0) {
    const source = parts.slice(0, toIndex).map((part) => formats[part] || dictionary[part] || part).join(' ');
    const target = parts.slice(toIndex + 1).map((part) => formats[part] || dictionary[part] || part).join(' ');
    return `${source} ${dictionary.to} ${target}`;
  }
  return parts.map((part) => formats[part] || dictionary[part] || part).join(' ');
}
