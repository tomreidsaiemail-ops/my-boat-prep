import { FileDown, Files, Lock, RotateCcw, AlertTriangle } from "lucide-react";

export const ValidationBar = ({ show, testId }) =>
  show ? (
    <div role="alert" data-testid={testId} className="mbp-pop flex items-center justify-center gap-2 rounded-md bg-[var(--red)] px-3 py-2.5 text-sm font-bold text-white">
      <AlertTriangle className="h-4 w-4" /> Please enter vessel details first
    </div>
  ) : null;

export const ActionBar = ({ zone, warn, onReset, onExport, locked }) => (
  <div className="flex flex-col gap-2">
    <ValidationBar show={warn} testId={`${zone}-validation-bar`} />
    <div className="grid grid-cols-3 gap-2">
      <button type="button" data-testid={`${zone}-reset-all-btn`} onClick={onReset} className="btn-ghost">
        <RotateCcw className="h-4 w-4" /> Reset All...
      </button>
      <button type="button" data-testid={`${zone}-export-current-btn`} onClick={() => onExport(true)} className="btn-solid">
        <FileDown className="h-4 w-4" /> Export Current
      </button>
      <button type="button" data-testid={`${zone}-export-all-btn`} onClick={() => onExport(false)} className="btn-solid">
        {locked ? <Lock className="h-4 w-4" data-testid={`${zone}-export-all-lock`} /> : <Files className="h-4 w-4" />} Export All
      </button>
    </div>
  </div>
);
