import { Download } from 'lucide-react';
import { exportToCSV } from '../../utils/csvExport';
export default function ExportCsvButton({ filename, rows, label = 'Export CSV' }) {
  return (
    <button className="btn-outline" disabled={!rows || rows.length === 0} onClick={() => exportToCSV(filename, rows)}>
      <Download className="h-4 w-4" strokeWidth={1.75} />{label}
    </button>
  );
}
