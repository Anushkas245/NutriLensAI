import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  History,
  Trash2,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  ScanLine,
  FileText,
} from 'lucide-react';
import { SCANS_API } from '../lib/api';
import { getVerdictStyle, getNovaStyle } from '../components/ScoreBadge';
import AssessmentReport from '../components/AssessmentReport';

export default function ScanHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeScanId = searchParams.get('scanId');

  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const list = await SCANS_API.history();
      setScans(Array.isArray(list) ? list : []);
    } catch {
      setScans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (!activeScanId) {
      setSelectedReport(null);
      return;
    }
    let active = true;
    setReportLoading(true);
    SCANS_API.get(activeScanId)
      .then((res) => {
        if (active) setSelectedReport(res);
      })
      .catch(() => {
        if (active) setSelectedReport(null);
      })
      .finally(() => {
        if (active) setReportLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeScanId]);

  const handleDeleteOne = async (scanId) => {
    try {
      await SCANS_API.remove(scanId);
      setScans((prev) => prev.filter((s) => s.scanId !== scanId));
      if (String(scanId) === activeScanId) {
        setSearchParams({});
      }
    } catch {
      // ignore
    }
  };

  const handleClearConfirmed = async () => {
    setClearing(true);
    try {
      await SCANS_API.clearHistory();
      setScans([]);
      setSelectedReport(null);
      setSearchParams({});
      setConfirmClear(false);
    } catch {
      // ignore
    } finally {
      setClearing(false);
    }
  };

  if (activeScanId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#E3ECE4] pb-4">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#2E5238] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Scan History
          </button>
          <Link
            to="/scanner"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E5238] px-4 py-2 text-xs font-bold text-white"
          >
            <ScanLine className="h-3.5 w-3.5" />
            New Scan
          </Link>
        </div>

        {reportLoading ? (
          <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-[#5E7266]">
            <RefreshCw className="h-5 w-5 animate-spin text-[#426E4D]" />
            Reopening saved scan report...
          </div>
        ) : !selectedReport?.assessment ? (
          <div className="rounded-2xl border border-[#EFCBC4] bg-[#FDF3F1] p-6 text-sm text-[#96382C]">
            Could not load this scan report.
          </div>
        ) : (
          <AssessmentReport
            productName={selectedReport.productName}
            brand={selectedReport.brand}
            category={selectedReport.category}
            servingSizeText={selectedReport.servingSizeText}
            servingSizeG={selectedReport.servingSizeG}
            allergensText={selectedReport.corrected?.allergens}
            assessment={selectedReport.assessment}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[#E3ECE4] pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-[#143326] sm:text-3xl">Scan History</h1>
          <p className="mt-1 text-sm text-[#5E7266]">
            Reopen previous food label scan reports or manage your recorded history.
          </p>
        </div>

        {scans.length > 0 && !confirmClear && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#EEC6BE] bg-white px-4 py-2 text-xs font-bold text-[#96382C] hover:bg-[#FDF2F0]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear History
          </button>
        )}
      </div>

      {confirmClear && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#EAB8B0] bg-[#FDF2F0] p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5 text-xs text-[#8E2F23]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Confirm clear history:</strong> Permanently remove all {scans.length} scan record(s)? This cannot be undone.
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="rounded-lg border border-[#D4E2D5] bg-white px-3 py-1.5 text-xs font-bold text-[#1D4130]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={clearing}
              onClick={handleClearConfirmed}
              className="rounded-lg bg-[#A93A2C] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#8E2F23] disabled:opacity-60"
            >
              {clearing ? 'Clearing...' : 'Yes, Clear All'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-[#5E7266]">
          <RefreshCw className="h-5 w-5 animate-spin text-[#426E4D]" />
          Loading scan history...
        </div>
      ) : scans.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#CFE0D0] bg-white p-10 text-center">
          <History className="mx-auto h-10 w-10 text-[#5A8B66]" />
          <h2 className="mt-3 text-lg font-extrabold text-[#143326]">No scan history yet</h2>
          <p className="mt-1 text-sm text-[#5E7266]">
            Scan a packaged food label to extract ingredients, decode additives, and save the full report here.
          </p>
          <Link
            to="/scanner"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2E5238] px-5 py-2.5 text-sm font-bold text-white"
          >
            <ScanLine className="h-4 w-4" />
            Open Label Scanner
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E3ECE4] bg-white">
          <div className="divide-y divide-[#EEF3EE]">
            {scans.map((scan) => {
              const vStyle = getVerdictStyle(scan.verdict);
              return (
                <div
                  key={scan.scanId}
                  className="flex flex-col justify-between gap-4 p-4 transition hover:bg-[#FAFDF9] sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-[#143326]">{scan.productName}</h3>
                      {scan.category && (
                        <span className="rounded-full bg-[#EFF5EF] px-2.5 py-0.5 text-[11px] font-semibold text-[#356844]">
                          {scan.category}
                        </span>
                      )}
                      {scan.novaGroup && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getNovaStyle(scan.novaGroup)}`}>
                          NOVA {scan.novaGroup}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#6A7D72]">
                      {scan.brand ? `${scan.brand} • ` : ''}
                      Scanned on {new Date(scan.createdAt).toLocaleString()}
                      {scan.verdict ? ` • ${scan.verdict}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className={`rounded-full px-3 py-1 text-xs font-extrabold tabular-nums ${vStyle.pill}`}>
                      {scan.healthScore != null ? `Score ${scan.healthScore}` : 'Incomplete'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearchParams({ scanId: String(scan.scanId) })}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9DBC9] bg-white px-3 py-1.5 text-xs font-bold text-[#1D4130] hover:bg-[#F2F8F2]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Reopen Report
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOne(scan.scanId)}
                      title="Delete scan"
                      className="rounded-lg p-1.5 text-[#7B8E82] hover:bg-[#FDF2F0] hover:text-[#96382C]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
