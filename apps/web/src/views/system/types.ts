export interface PreviewRow {
  rowNum: number;
  data: Record<string, string>;
  errors?: string[];
  status?: 'valid' | 'error' | 'skip';
}

export interface PreviewSheet {
  valid: PreviewRow[];
  errors: PreviewRow[];
}

export interface PreviewResult {
  customers: PreviewSheet;
  vehicles: PreviewSheet;
  storedValueCards: PreviewSheet;
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    skipRows: number;
  };
}
