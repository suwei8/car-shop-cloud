import { FileService } from './file.service';

const sanitize = (v: string) => FileService.sanitizeFileName(v);

describe('FileService.sanitizeFileName', () => {
  it('passes through a normal filename unchanged', () => {
    expect(sanitize('normal.jpg')).toBe('normal.jpg');
  });

  it('strips path separators to defeat directory traversal', () => {
    // ../../../etc/passwd  →  'etcpasswd'
    expect(sanitize('../../../etc/passwd')).toBe('etcpasswd');
  });

  it('strips HTML-like / angle brackets and parentheses', () => {
    expect(sanitize('file<script>.jpg')).toBe('filescript.jpg');
    expect(sanitize('file name (1).jpg')).toBe('filename1.jpg');
  });

  it('preserves CJK characters', () => {
    expect(sanitize('测试文件.png')).toBe('测试文件.png');
  });

  it('falls back to "unnamed" for empty input', () => {
    expect(sanitize('')).toBe('unnamed');
    expect(sanitize('...')).toBe('unnamed');
  });

  it('strips leading dots (hidden-file trick)', () => {
    expect(sanitize('.hidden.jpg')).toBe('hidden.jpg');
    expect(sanitize('..double.jpg')).toBe('double.jpg');
  });

  it('truncates overly long names while preserving the extension', () => {
    const long = 'a'.repeat(300) + '.pdf';
    const result = sanitize(long);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('treats non-string input as unnamed', () => {
    expect(FileService.sanitizeFileName(undefined as unknown as string)).toBe('unnamed');
    expect(FileService.sanitizeFileName(null as unknown as string)).toBe('unnamed');
  });

  it('keeps underscores, hyphens, and digits', () => {
    expect(sanitize('report_2026-Q1.xlsx')).toBe('report_2026-Q1.xlsx');
  });
});
