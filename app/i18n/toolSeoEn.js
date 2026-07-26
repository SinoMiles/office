// 每个工具的英文文案都是独立撰写的，不是机械拼词或模板套用。
// 这是把英文站从 thin content 拉回可索引质量的关键：标题、摘要、使用场景和 FAQ
// 各自命中不同的长尾查询，页面之间不再互为重复内容。
//
// 结构与中文侧 lib/toolsData.js 的 seo 对象保持一致：
//   { name, summary, useCases: string[3], faqs: [question, answer][] }

const TOOL_SEO_EN = {
  'word-to-pdf': {
    name: 'Word to PDF',
    summary: 'Convert DOC and DOCX files to PDF while keeping the original pagination, fonts, tables and headers intact. Conversion runs on our servers with LibreOffice, so the layout matches what you see in Word.',
    useCases: ['Send a contract that must not be re-edited', 'Freeze a report layout before printing', 'Submit coursework or tenders that require PDF'],
    faqs: [
      ['Will my formatting change?', 'The converter uses a full LibreOffice rendering pass, so pagination, fonts and tables are preserved. Rare custom fonts fall back to the closest available match.'],
      ['Is there a file size limit?', 'A single document can be up to 50MB. Larger files should be split before converting.'],
    ],
  },
  'excel-to-pdf': {
    name: 'Excel to PDF',
    summary: 'Turn XLS and XLSX workbooks into PDF with print areas, page breaks and column widths applied automatically, so long sheets stay readable instead of spilling off the page.',
    useCases: ['Circulate a financial summary that nobody should edit', 'Attach a price list to an email', 'Archive a monthly report in a fixed format'],
    faqs: [
      ['Which sheets are included?', 'All visible worksheets are exported in workbook order, each starting on a new page.'],
      ['Will wide tables be cut off?', 'Page scaling is applied automatically. For very wide sheets, set a print area in Excel first for the cleanest result.'],
    ],
  },
  'ppt-to-pdf': {
    name: 'PowerPoint to PDF',
    summary: 'Convert PPT and PPTX decks to PDF with vector shapes, charts and slide backgrounds preserved, producing one PDF page per slide.',
    useCases: ['Share a deck that must look identical everywhere', 'Send slides to someone without PowerPoint', 'Prepare handouts for printing'],
    faqs: [
      ['Are animations kept?', 'No. A PDF is static, so each slide is exported in its final state.'],
      ['Are speaker notes included?', 'Notes are not exported here. Use the PowerPoint Notes Extractor tool to pull them out separately.'],
    ],
  },
  'word-to-text': {
    name: 'Extract Text from Word',
    summary: 'Pull the body text, headings and table content out of a DOCX file and download it as clean UTF-8 plain text, with no styling, no markup and no embedded objects.',
    useCases: ['Migrate legacy Word content into a new system', 'Feed a document to an AI model for summarisation', 'Strip heavy formatting to get at the words'],
    faqs: [
      ['Do you support the older .doc format?', 'Only DOCX is supported directly. Save a .doc file as .docx in Word first, or run it through the Word to PDF converter.'],
      ['Can it read text inside images?', 'No. Text baked into an image needs OCR — use the OCR Data Extraction tool instead.'],
    ],
  },
  'word-to-jpg': {
    name: 'Word to JPG',
    summary: 'Render every page of a Word document as a JPG image at 150 DPI and download them together as a ZIP archive, ready for previews, thumbnails or social posts.',
    useCases: ['Preview a document where PDF is not supported', 'Post a page of a document to social media', 'Generate thumbnails for a document library'],
    faqs: [
      ['What resolution are the images?', 'Pages are rendered at 150 DPI, which is sharp on screen and good enough for light printing.'],
      ['How are multiple pages delivered?', 'Multi-page documents come back as a ZIP with one numbered image per page. Single-page documents return the image directly.'],
    ],
  },
  'word-images-extract': {
    name: 'Extract Images from Word',
    summary: 'Pull every embedded picture out of a DOCX file at its original resolution and download them as a ZIP, without screenshotting or re-compressing anything.',
    useCases: ['Recover original photos from a document someone sent you', 'Reuse diagrams from an old report', 'Collect assets before a redesign'],
    faqs: [
      ['Is image quality reduced?', 'No. Files are copied straight out of the document package, so you get the exact bytes that were embedded.'],
      ['What if the document has no images?', 'You will get a clear message rather than an empty archive.'],
    ],
  },
  'ppt-to-text': {
    name: 'Extract Text from PowerPoint',
    summary: 'Export the title and body text of every slide in a PPTX file as plain text, in slide order and clearly separated, so you can search, translate or summarise a deck.',
    useCases: ['Turn a deck into a written summary', 'Search across many presentations at once', 'Prepare slide content for translation'],
    faqs: [
      ['Are speaker notes included?', 'No. Notes live in a separate part of the file — use the PowerPoint Notes Extractor for those.'],
      ['Is slide order preserved?', 'Yes, slides are numbered and exported in presentation order.'],
    ],
  },
  'ppt-notes-extract': {
    name: 'Extract PowerPoint Speaker Notes',
    summary: 'Export the speaker notes attached to each slide in a PPTX file as a single plain text script, numbered by slide, without opening PowerPoint.',
    useCases: ['Turn presenter notes into a talk script', 'Reuse notes as the basis for an article', 'Review what a colleague planned to say'],
    faqs: [
      ['What if only some slides have notes?', 'Every slide with notes is exported in order; slides without notes are skipped.'],
      ['Can I get the slide text too?', 'Yes, run the same file through the PowerPoint Text Extractor.'],
    ],
  },
  'ppt-images-extract': {
    name: 'Extract Images from PowerPoint',
    summary: 'Download every picture embedded in a PPTX deck at original quality, packaged as a ZIP — much faster than right-clicking and saving each one.',
    useCases: ['Recover the original artwork from a deck', 'Reuse charts and photos in another document', 'Collect brand assets from an old presentation'],
    faqs: [
      ['Are the images re-compressed?', 'No. They are extracted byte-for-byte from the presentation package.'],
      ['Does this include background images?', 'Yes, anything stored in the media folder of the deck is included.'],
    ],
  },
  'ppt-to-jpg': {
    name: 'PowerPoint to JPG',
    summary: 'Render each slide of a PPT or PPTX deck as a JPG image and download the set as a ZIP, ideal for embedding slides where a PDF or deck viewer is not available.',
    useCases: ['Embed slides in a web page or blog post', 'Share a deck as images in a chat app', 'Build a visual index of a presentation'],
    faqs: [
      ['One image per slide?', 'Yes, each slide becomes one numbered JPG.'],
      ['Would PNG be sharper?', 'For text-heavy slides, yes. Use the PDF to PNG tool after converting the deck to PDF if you need lossless output.'],
    ],
  },
  'img-to-pdf': {
    name: 'Images to PDF',
    summary: 'Combine several JPG or PNG images into a single PDF in the order you upload them — useful for turning photos of paperwork into one shareable document.',
    useCases: ['Turn phone photos of receipts into one file', 'Bundle scanned pages into a single document', 'Submit image evidence where only PDF is accepted'],
    faqs: [
      ['Can I control the page order?', 'Pages follow the order in which the files are uploaded.'],
      ['Will the PDF contain searchable text?', 'No. The images are placed as-is; run OCR if you need selectable text.'],
    ],
  },
  'pdf-to-text': {
    name: 'Extract Text from PDF',
    summary: 'Read the text layer of a PDF and download it as UTF-8 plain text, keeping reading order across pages. Ideal for search, archiving or feeding a document to an AI model.',
    useCases: ['Get quotable text out of a report', 'Load PDF content into a knowledge base', 'Prepare clean input for AI summarisation'],
    faqs: [
      ['Does it work on scanned documents?', 'No. This reads the existing text layer. Scans have no text layer — use the OCR tool for those.'],
      ['Is my original file modified?', 'No. The PDF is only read, never written back.'],
    ],
  },
  'pdf-clean-metadata': {
    name: 'Remove PDF Metadata',
    summary: 'Strip the title, author, subject, keywords and producer fields from a PDF and download a clean copy, so a document you share does not quietly reveal who wrote it or on which machine.',
    useCases: ['Remove author details before sending a contract externally', 'Submit a paper or proposal anonymously', 'Reduce information leakage in published files'],
    faqs: [
      ['Does this change the page content?', 'No. Only document properties and metadata are cleared; every page stays exactly as it was.'],
      ['Can it remove names inside the text?', 'No. Redacting names in the body requires the AI Document Redaction tool.'],
    ],
  },
  'pdf-page-numbers': {
    name: 'Add Page Numbers to PDF',
    summary: 'Stamp continuous page numbers across an entire PDF, with a configurable starting number — the fast way to paginate tender documents, contract annexes and training material.',
    useCases: ['Number a tender submission consistently', 'Paginate contract appendices', 'Order handouts before printing'],
    faqs: [
      ['Can I choose the first number?', 'Yes. Entering 5 starts the sequence at page 5, which is useful for continuing from a previous document.'],
      ['Is the original overwritten?', 'No, you download a new file.'],
    ],
  },
  'excel-to-csv': {
    name: 'Excel to CSV',
    summary: 'Export the first worksheet of an XLS or XLSX workbook as a UTF-8 CSV file, ready for import into databases, accounting systems and analytics tools.',
    useCases: ['Upload data to a system that only accepts CSV', 'Import a spreadsheet into a database', 'Exchange structured data between tools'],
    faqs: [
      ['What happens to the other sheets?', 'Only the first worksheet is exported. Use Split Excel by Sheet first if you need each one separately.'],
      ['Will non-English characters break?', 'No, output is UTF-8 encoded.'],
    ],
  },
  'excel-to-json': {
    name: 'Excel to JSON',
    summary: 'Convert spreadsheet rows into a JSON array using the first row as field names — the quickest way to hand a business spreadsheet to a developer or an API.',
    useCases: ['Generate test data for an API', 'Pass an operations spreadsheet to engineering', 'Load spreadsheet records into an application'],
    faqs: [
      ['How are formulas handled?', 'The cached calculated values stored in the workbook are exported, not the formula text.'],
      ['Are blank cells kept?', 'Yes, empty values are preserved so the field structure stays consistent.'],
    ],
  },
  'csv-to-excel': {
    name: 'CSV to Excel',
    summary: 'Wrap a CSV file into a proper XLSX workbook so you can filter, format and build reports on top of it, instead of staring at raw comma-separated text.',
    useCases: ['Continue analysing an exported data dump', 'Fix a CSV that displays badly in a spreadsheet app', 'Turn system exports into a working workbook'],
    faqs: [
      ['Is UTF-8 supported?', 'Yes, including CJK characters.'],
      ['Will styling be added?', 'A clean editable worksheet is produced. Your data is never reformatted or rounded.'],
    ],
  },
  'csv-to-json': {
    name: 'CSV to JSON',
    summary: 'Read a CSV header row and its records and output a JSON array that scripts, APIs and front-end applications can consume directly.',
    useCases: ['Build API fixture data quickly', 'Migrate a CSV data source', 'Check how fields map to values'],
    faqs: [
      ['Must the first row be a header?', 'Yes, the first row becomes the JSON field names.'],
      ['Is my file sent anywhere else?', 'No. Processing happens on our own servers and the file is discarded after the response.'],
    ],
  },
  'json-to-excel': {
    name: 'JSON to Excel',
    summary: 'Flatten a JSON array of objects into spreadsheet rows and columns so non-technical colleagues can read and edit the data in Excel.',
    useCases: ['Turn an API response into a business report', 'Hand engineering data to an operations team', 'Make JSON records readable at a glance'],
    faqs: [
      ['Are nested objects supported?', 'Top-level fields convert directly. Deeply nested structures are best flattened first.'],
      ['Is any data altered?', 'No, field names and values are written through unchanged.'],
    ],
  },
  'json-to-csv': {
    name: 'JSON to CSV',
    summary: 'Convert a consistently shaped JSON array into UTF-8 CSV, ready for bulk import into CRMs, databases and other systems that expect flat files.',
    useCases: ['Import API data into a CRM', 'Produce a database import file', 'Create a lightweight data exchange file'],
    faqs: [
      ['What JSON shape is required?', 'The root should be an array of objects with consistent keys.'],
      ['How are nested values handled?', 'Complex objects should be flattened before conversion for predictable columns.'],
    ],
  },
  'excel-dedupe': {
    name: 'Remove Duplicate Rows in Excel',
    summary: 'Delete rows whose entire contents are identical, keeping the first occurrence — a fast first pass when cleaning mailing lists, order exports and customer records.',
    useCases: ['Clean a contact list after merging sources', 'Tidy an order export before analysis', 'Deduplicate event registrations'],
    faqs: [
      ['Is the header row affected?', 'No, the first row is always preserved.'],
      ['Can I deduplicate on specific columns?', 'Yes — use Remove Duplicates by Column for that.'],
    ],
  },
  'excel-clean': {
    name: 'Remove Blank Rows in Excel',
    summary: 'Strip out rows where every cell is empty and tighten the used range of the worksheet, which cuts file size and prevents import errors caused by phantom rows.',
    useCases: ['Prepare a sheet before a system import', 'Shrink a workbook that grew unexpectedly large', 'Tidy a manually maintained list'],
    faqs: [
      ['Are partially filled rows removed?', 'No. Only rows where every cell is empty are deleted.'],
      ['Is formatting preserved?', 'Data and field order are preserved; complex visual formatting may be simplified.'],
    ],
  },
  'excel-merge': {
    name: 'Merge Excel Files',
    summary: 'Stack several workbooks that share the same column structure into one sheet, keeping a single header row — the usual first step before analysing data collected from multiple people.',
    useCases: ['Combine monthly reports into one file', 'Merge submissions from several branches', 'Consolidate exports from different systems'],
    faqs: [
      ['Do the files need identical columns?', 'They should share the same structure. Mismatched columns produce a messy result.'],
      ['Is the header duplicated?', 'No, only the first file contributes the header row.'],
    ],
  },
  'excel-split-sheets': {
    name: 'Split Excel by Worksheet',
    summary: 'Turn every worksheet in a workbook into its own standalone XLSX file and download them together as a ZIP — useful when each sheet needs to go to a different person.',
    useCases: ['Send each department only its own tab', 'Break a large workbook into manageable files', 'Prepare per-region files from one master sheet'],
    faqs: [
      ['How are files named?', 'Each output file is named after its worksheet.'],
      ['What about a single-sheet workbook?', 'You still get a ZIP, containing that one file.'],
    ],
  },
  'excel-dedupe-columns': {
    name: 'Remove Duplicates by Column',
    summary: 'Identify duplicate records using only the columns you choose — for example phone number or email — instead of requiring the entire row to match.',
    useCases: ['Deduplicate customers by phone number', 'Collapse leads that share an email address', 'Clean records where only the key field matters'],
    faqs: [
      ['How do I specify columns?', 'Enter the column header names separated by commas, for example: email,phone.'],
      ['Which duplicate is kept?', 'The first occurrence in the sheet is retained.'],
    ],
  },
  'excel-formula-audit': {
    name: 'Excel Formula Audit',
    summary: 'Export every formula in a workbook along with its cell reference, expression and cached value as a JSON report, so you can review calculation logic without clicking through cells.',
    useCases: ['Review a financial model you inherited', 'Document how a report is calculated', 'Hunt for a broken calculation across many sheets'],
    faqs: [
      ['Does it evaluate the formulas?', 'No. It reports the formula text and the value the workbook already stored.'],
      ['Are all worksheets scanned?', 'Yes, every sheet in the workbook is covered.'],
    ],
  },
  'excel-workbook-summary': {
    name: 'Excel Workbook Overview',
    summary: 'Get a quick structural report of a workbook — sheet names, row and column counts and how many formulas each sheet contains — before you commit to opening a large file.',
    useCases: ['Size up an unfamiliar workbook', 'Check whether an export is complete', 'Document workbook structure for a handover'],
    faqs: [
      ['Is any cell data exposed?', 'No, only structural counts and sheet names are reported.'],
      ['What format is the report?', 'A JSON file you can read directly or feed into another tool.'],
    ],
  },
  'xls-to-xlsx': {
    name: 'XLS to XLSX',
    summary: 'Upgrade legacy Excel 97-2003 files to the modern XLSX format, lifting the old 65,536-row limit and making the file usable in current spreadsheet software.',
    useCases: ['Modernise archived spreadsheets', 'Fix compatibility warnings in Excel', 'Prepare old files for a data import'],
    faqs: [
      ['Is data lost in conversion?', 'Cell values and formulas carry over. Very old macros are not preserved.'],
      ['Does the file get bigger?', 'Usually smaller — XLSX is a compressed format.'],
    ],
  },
  'xlsx-to-xls': {
    name: 'XLSX to XLS',
    summary: 'Produce an Excel 97-2003 file from a modern workbook, for legacy systems and older software that still refuse to accept XLSX uploads.',
    useCases: ['Upload to a system that only accepts .xls', 'Share with someone running very old Office', 'Meet a fixed format requirement in a workflow'],
    faqs: [
      ['Are there limits to be aware of?', 'The XLS format caps at 65,536 rows and 256 columns; larger sheets will be truncated.'],
      ['Do formulas survive?', 'Standard formulas convert; features unique to XLSX may be simplified.'],
    ],
  },
  'merge-pdf': {
    name: 'Merge PDF',
    summary: 'Join several PDF files into one document in upload order, keeping every page exactly as it was — no re-rendering, no quality loss.',
    useCases: ['Combine a contract with its annexes', 'Bundle scanned pages into one file', 'Assemble a single submission from several documents'],
    faqs: [
      ['Can I control the order?', 'Pages follow the order in which files are uploaded.'],
      ['Is quality reduced?', 'No. Pages are copied without re-encoding.'],
    ],
  },
  'split-pdf': {
    name: 'Split PDF',
    summary: 'Extract a chosen page range into a new PDF using simple notation such as 1-3,5,8-10, without opening a PDF editor.',
    useCases: ['Pull one chapter out of a long report', 'Send only the pages that matter', 'Separate an appendix from the main document'],
    faqs: [
      ['What page syntax is supported?', 'Single pages, ranges and combinations: 1-3,5,8-10.'],
      ['Is the original changed?', 'No, a new file is generated for download.'],
    ],
  },
  watermark: {
    name: 'Add Watermark to PDF',
    summary: 'Stamp custom text diagonally across every page of a PDF to mark a document as confidential, draft or internal before you circulate it.',
    useCases: ['Mark a document as CONFIDENTIAL before sharing', 'Label a draft so it is not mistaken for final', 'Deter unauthorised redistribution'],
    faqs: [
      ['Can the watermark be removed?', 'It is drawn into the page content, so it cannot be toggled off by a reader.'],
      ['Does it cover the text underneath?', 'The watermark is rendered so the underlying content stays readable.'],
    ],
  },
  'pdf-to-jpg': {
    name: 'PDF to JPG',
    summary: 'Convert every page of a PDF into a JPG image at 150 DPI and download them as a ZIP — handy when you need pictures rather than a document.',
    useCases: ['Post a page of a PDF to social media', 'Insert PDF pages into a slide deck', 'Preview a document where PDF is not supported'],
    faqs: [
      ['What resolution is used?', '150 DPI, a good balance between sharpness and file size.'],
      ['Is there a page limit?', 'Up to 200 pages per request; split longer documents first.'],
    ],
  },
  'pdf-to-png': {
    name: 'PDF to PNG',
    summary: 'Render PDF pages as lossless PNG images, which keeps text edges and line art crisp — the better choice over JPG for documents, diagrams and screenshots.',
    useCases: ['Extract a diagram at full quality', 'Produce crisp images for documentation', 'Archive pages without compression artefacts'],
    faqs: [
      ['PNG or JPG — which should I pick?', 'PNG for text and line art, JPG for photographic pages and smaller files.'],
      ['Are transparent backgrounds preserved?', 'Pages are rendered on a white background for predictable printing.'],
    ],
  },
  encrypt: {
    name: 'Password Protect PDF',
    summary: 'Apply AES-256 encryption and set an open password on a PDF. The file and the password are processed in memory on our servers and never sent to a third-party service.',
    useCases: ['Protect a contract before emailing it', 'Secure financial reports and internal material', 'Add access control to an email attachment'],
    faqs: [
      ['Is my password stored?', 'No. It exists only for the duration of the request and is discarded immediately afterwards.'],
      ['Can the password be recovered?', 'No. AES-256 has no backdoor — keep your password somewhere safe.'],
    ],
  },
  'ai-summary': {
    name: 'AI Document Summariser',
    summary: 'Condense long reports, research papers and contracts into their core arguments, key figures and conclusions, then keep asking follow-up questions about the parts that matter.',
    useCases: ['Get the gist of a 100-page report in minutes', 'Brief a team on a document nobody has read', 'Decide whether a paper is worth reading in full'],
    faqs: [
      ['How long can the document be?', 'Long documents are handled in sections, so length is rarely the constraint.'],
      ['Can I ask follow-up questions?', 'Yes. The summary opens a conversation you can keep refining.'],
    ],
  },
  'ai-translate': {
    name: 'AI Document Translation',
    summary: 'Translate documents while preserving the original layout, producing natural professional wording rather than word-for-word output, with a bilingual view for checking.',
    useCases: ['Localise a proposal for an overseas client', 'Read a foreign-language contract with confidence', 'Prepare bilingual internal documentation'],
    faqs: [
      ['Is the layout preserved?', 'Yes, the structure of the source document is retained.'],
      ['Can I set the tone?', 'Yes, ask for formal, technical or conversational phrasing.'],
    ],
  },
  'ai-polish': {
    name: 'AI Writing Polish',
    summary: 'Fix grammar problems, tighten wordy sentences and shift the tone toward professional business writing, while keeping your original meaning intact.',
    useCases: ['Sharpen a proposal before sending it', 'Make internal writing sound more professional', 'Clean up a draft written in a hurry'],
    faqs: [
      ['Will it change my meaning?', 'No. Edits target clarity and tone, not substance.'],
      ['Can I choose a specific style?', 'Yes, specify formal, concise, persuasive or another register.'],
    ],
  },
  'ai-ocr': {
    name: 'AI OCR Data Extraction',
    summary: 'Read scanned invoices, receipts and forms and pull out the fields you actually need — amounts, dates, names, reference numbers — as structured data ready for a spreadsheet.',
    useCases: ['Turn a stack of invoices into an expense sheet', 'Digitise paper forms into structured records', 'Extract key fields from scanned contracts'],
    faqs: [
      ['Which languages are supported?', 'Chinese and English are handled well, including mixed-language documents.'],
      ['What about poor quality scans?', 'Accuracy depends on the scan. Higher resolution gives noticeably better results.'],
    ],
  },
  'ai-pdf-chat': {
    name: 'Chat with your PDF',
    summary: 'Ask questions about a PDF and get answers grounded in its contents, with the relevant section cited so you can verify rather than take the answer on trust.',
    useCases: ['Find a specific clause in a long contract', 'Query a technical manual instead of scrolling it', 'Check what a report says about one topic'],
    faqs: [
      ['Are answers based only on my document?', 'Yes, responses are grounded in the file and point back to where the information came from.'],
      ['Can I ask several questions?', 'Yes, the conversation continues for as long as you need.'],
    ],
  },
  'ai-contract-review': {
    name: 'AI Contract Review',
    summary: 'Surface risky clauses, one-sided liability, missing terms and unclear deadlines in a contract, ranked by severity with concrete suggested revisions.',
    useCases: ['Screen a supplier agreement before legal review', 'Spot unbalanced terms in a client contract', 'Check that standard protections are present'],
    faqs: [
      ['Does this replace a lawyer?', 'No. It is a first-pass screen that helps you ask better questions — it is not legal advice.'],
      ['What does it look for?', 'Liability, termination, payment terms, confidentiality, penalties and commonly omitted clauses.'],
    ],
  },
  'ai-document-compare': {
    name: 'AI Document Comparison',
    summary: 'Compare two versions of a document and get a plain-language account of what substantively changed — not a character-level diff, but what the changes actually mean.',
    useCases: ['See what the other side edited in a contract', 'Track changes between policy revisions', 'Verify a document was updated as agreed'],
    faqs: [
      ['How is this different from track changes?', 'It explains the significance of each change rather than only highlighting edited characters.'],
      ['Can it compare different formats?', 'Yes, for example a Word draft against a PDF final.'],
    ],
  },
  'ai-redact': {
    name: 'AI Document Redaction',
    summary: 'Detect names, phone numbers, ID numbers, addresses, bank details and email addresses in a document and get a structured list with safe replacement suggestions.',
    useCases: ['Anonymise records before sharing them', 'Prepare case material for publication', 'Reduce personal data before sending files externally'],
    faqs: [
      ['Is the sensitive data removed automatically?', 'You get a structured findings list and suggested replacements, so you stay in control of what is removed.'],
      ['What categories are detected?', 'Names, phone numbers, national ID numbers, addresses, bank cards and email addresses.'],
    ],
  },
  'ai-meeting-minutes': {
    name: 'AI Meeting Minutes',
    summary: 'Turn raw meeting notes or a transcript into formal minutes with topics, decisions, action items, owners and deadlines clearly separated.',
    useCases: ['Write up minutes straight after a call', 'Convert a transcript into a shareable summary', 'Make sure action items and owners are captured'],
    faqs: [
      ['What input works best?', 'Rough notes or a transcript both work; more detail produces better minutes.'],
      ['Are owners and deadlines extracted?', 'Yes, when the source material mentions them.'],
    ],
  },
  'ai-weekly-report': {
    name: 'AI Weekly Report Generator',
    summary: 'Turn scattered work notes into a structured weekly report covering what was completed, key results, risks and next week’s plan.',
    useCases: ['Write a weekly update in a couple of minutes', 'Turn task lists into readable prose', 'Keep reporting consistent week to week'],
    faqs: [
      ['What should I provide?', 'A list of what you did is enough; more context produces a sharper report.'],
      ['Can I set the format?', 'Yes, specify the sections your team expects.'],
    ],
  },
  'ai-annual-review': {
    name: 'AI Annual Review Generator',
    summary: 'Build a year-end performance narrative from your results and metrics, covering achievements, quantified impact, growth, setbacks and next year’s plan — with a matching slide outline.',
    useCases: ['Prepare a year-end self-assessment', 'Turn scattered achievements into a narrative', 'Draft a review presentation quickly'],
    faqs: [
      ['What input works best?', 'Concrete results and numbers. Metrics make the output far more persuasive.'],
      ['Do I get slides too?', 'You get a slide outline you can take into the PPT Outline Generator.'],
    ],
  },
  'ai-resume': {
    name: 'AI Résumé Optimiser',
    summary: 'Rework a résumé against a specific job description, strengthening role fit, quantifying achievements and covering the keywords screening systems look for.',
    useCases: ['Tailor one résumé to several roles', 'Rewrite duties as measurable achievements', 'Get past automated keyword screening'],
    faqs: [
      ['Should I include the job description?', 'Yes. Targeting a specific posting produces much better results.'],
      ['Will it invent experience?', 'No. It reframes what you provide rather than fabricating history.'],
    ],
  },
  'ai-excel-analysis': {
    name: 'AI Spreadsheet Analysis',
    summary: 'Have a spreadsheet checked for data quality problems, then surface trends, outliers and key metrics with suggested charts and a written interpretation.',
    useCases: ['Find the story in a sales export', 'Spot anomalies before presenting numbers', 'Decide which chart actually fits the data'],
    faqs: [
      ['How large a sheet can it handle?', 'Large sheets are processed in sections; very wide tables benefit from being narrowed first.'],
      ['Does it create the charts?', 'It recommends chart types and configurations, and can generate an Office file with the analysis.'],
    ],
  },
  'ai-ppt-outline': {
    name: 'AI Presentation Outline',
    summary: 'Plan a complete deck for a specific audience — slide by slide, with titles, core message and a visual suggestion for each — before you spend time on design.',
    useCases: ['Structure a pitch before designing slides', 'Plan a training session', 'Turn a report into a presentation'],
    faqs: [
      ['What should I supply?', 'A topic, your source material and who the audience is.'],
      ['Do I get an actual PPTX?', 'You get a structured outline, and can continue in the workspace to generate an Office file.'],
    ],
  },
  'ai-official-document': {
    name: 'AI Official Document Check',
    summary: 'Check formal and government-style documents for structural, tonal and formatting problems against standard conventions, and get a corrected version back.',
    useCases: ['Check a formal notice before it goes out', 'Verify official formatting conventions', 'Catch tone problems in public-facing statements'],
    faqs: [
      ['Which conventions are applied?', 'Standard Chinese official document structure, headings, tone and formatting rules.'],
      ['Do I get a corrected draft?', 'Yes, both a list of issues and a revised version.'],
    ],
  },
};

export function toolSeoEn(toolId) {
  return TOOL_SEO_EN[toolId] || null;
}

export function hasEnglishSeo(toolId) {
  return Boolean(TOOL_SEO_EN[toolId]);
}

export default TOOL_SEO_EN;
