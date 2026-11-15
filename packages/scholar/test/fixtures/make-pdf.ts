/**
 * 测试用最小 PDF 生成器。
 *
 * 不引入任何 PDF 库：按 PDF 1.4 语法拼出「N 页、每页若干行 ASCII 文本」的文件，
 * 让 PDF 抽取测试有确定、可 diff 的输入。中文字体需要嵌入 CID 字体，
 * 这里刻意只用 ASCII —— 中文检索链路由 tokenize/store 的测试覆盖。
 */

export interface PdfPageSpec {
  /** 每行一句；超过 80 字符会被客户端截断换行。 */
  lines: string[];
}

export interface BuildPdfOptions {
  /** 标题，仅用于 /Info（pdfjs 不读也不影响抽取）。 */
  title?: string;
}

const PAGE_WIDTH = 595; // A4 pt
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const MARGIN_TOP = 780;
const LINE_HEIGHT = 16;
const FONT_SIZE = 11;

function escapePdfString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function contentStream(page: PdfPageSpec): string {
  const ops: string[] = ['BT', `/F1 ${FONT_SIZE} Tf`, `${MARGIN_X} ${MARGIN_TOP} Td`, `${LINE_HEIGHT} TL`];
  page.lines.forEach((line, index) => {
    if (index > 0) ops.push('T*');
    ops.push(`(${escapePdfString(line)}) Tj`);
  });
  ops.push('ET');
  return ops.join('\n');
}

/** 生成一个可被 pdf.js 正常解析的最小 PDF（ASCII）。 */
export function buildTextPdf(pages: PdfPageSpec[], options: BuildPdfOptions = {}): Uint8Array {
  if (pages.length === 0) throw new Error('至少要一页');

  const objects: string[] = []; // 下标 0 对应对象 1
  const pageObjIds: number[] = [];
  const fontObjId = 3 + pages.length * 2;

  const kids = pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`); // 1
  objects.push(
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] >>`,
  ); // 2

  pages.forEach((page, i) => {
    const pageObjId = 3 + i * 2;
    const contentObjId = pageObjId + 1;
    pageObjIds.push(pageObjId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${fontObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`,
    );
    const stream = contentStream(page);
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  });

  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);

  const chunks: string[] = ['%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n'];
  const offsets: number[] = [];
  let cursor = Buffer.byteLength(chunks[0], 'latin1');
  objects.forEach((body, i) => {
    offsets.push(cursor);
    const text = `${i + 1} 0 obj\n${body}\nendobj\n`;
    chunks.push(text);
    cursor += Buffer.byteLength(text, 'latin1');
  });

  const infoId = objects.length + 1;
  const info = `${infoId} 0 obj\n<< /Title (${escapePdfString(options.title ?? 'Fixture')}) /Producer (dsh-learning-tests) >>\nendobj\n`;
  offsets.push(cursor);
  chunks.push(info);
  cursor += Buffer.byteLength(info, 'latin1');

  const total = infoId + 1;
  const xrefStart = cursor;
  const pad = (n: number) => String(n).padStart(10, '0');
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${pad(offset)} 00000 n \n`;
  chunks.push(xref);
  chunks.push(`trailer\n<< /Size ${total} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  return new Uint8Array(Buffer.from(chunks.join(''), 'latin1'));
}