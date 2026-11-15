import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  extractPdfPages,
  extractPdfText,
  looksScanned,
  normalizePdfText,
} from '../src/pdf.js';
import { buildTextPdf } from './fixtures/make-pdf.js';

const workDir = mkdtempSync(join(tmpdir(), 'dsh-pdf-test-'));

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

const SAMPLE = buildTextPdf([
  {
    lines: [
      'Convolutional neural networks for stroke rehabilitation',
      'Zhang San, John Smith',
      'Abstract: We evaluate a CNN pipeline on 1,204 EEG records.',
    ],
  },
  {
    lines: ['2 Methods', 'Signals were band-pass filtered between 1 and 45 Hz.', 'AUC reached 0.91 on the hold-out set.'],
  },
]);

describe('PDF 抽取', () => {
  it('按页抽取文本，页码从 1 开始', async () => {
    const pages = await extractPdfPages(SAMPLE);
    expect(pages).toHaveLength(2);
    expect(pages[0]?.page).toBe(1);
    expect(pages[0]?.text).toContain('Convolutional neural networks');
    expect(pages[1]?.page).toBe(2);
    expect(pages[1]?.text).toContain('0.91');
  });

  it('maxPages 只取前面若干页', async () => {
    const pages = await extractPdfPages(SAMPLE, { maxPages: 1 });
    expect(pages).toHaveLength(1);
    expect(pages[0]?.text).toContain('CNN pipeline');
  });

  it('minCharsPerPage 过滤空白页', async () => {
    const pages = await extractPdfPages(SAMPLE, { minCharsPerPage: 500 });
    expect(pages).toHaveLength(0);
  });

  it('支持从文件路径读取，并合并成全文本', async () => {
    const file = join(workDir, 'sample.pdf');
    writeFileSync(file, SAMPLE);
    const text = await extractPdfText(file);
    expect(text).toContain('band-pass filtered');
    expect(text).toContain('hold-out set');
  });

  it('不是 PDF 时抛错而不是静默返回空', async () => {
    await expect(extractPdfPages(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
  });

  it('扫描件判定：抽不出字时提示需要 OCR', async () => {
    const blank = await extractPdfPages(SAMPLE, { minCharsPerPage: 1000 });
    expect(looksScanned(blank, 2)).toBe(true);
    const normal = await extractPdfPages(SAMPLE);
    expect(looksScanned(normal, 2)).toBe(false);
  });
});

describe('normalizePdfText', () => {
  it('拼回被换行拆开的英文单词', () => {
    expect(normalizePdfText('rehabili-\ntation is slow')).toBe('rehabilitation is slow');
  });

  it('去掉软连字符与孤立页码', () => {
    expect(normalizePdfText('第一行\u00ad\n12\n第二行')).toBe('第一行 第二行');
  });

  it('折叠多余空白与全角空格', () => {
    expect(normalizePdfText('A    B\u3000\u3000C\n\n\nD')).toBe('A B C D');
  });

  it('空文本返回空串', () => {
    expect(normalizePdfText('   \n\n  ')).toBe('');
  });
});