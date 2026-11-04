import { FolderPlus, Layers, ScanText, ChevronsDownUp, ChevronsUpDown } from "lucide-react";

// Ship's Log tools: group a passage, fold a year, scan paper logs, open or close every folder.
export const ShipsLogTools = ({ hasFolders, anyOpen, onGroup, onYear, onScan, onAll }) => (
  <div className="flex flex-wrap gap-2" data-testid="ships-log-tools">
    <button type="button" className="btn-ghost h-10 min-h-0 gap-1.5 px-3 text-sm" onClick={onGroup} data-testid="log-group-btn"><FolderPlus className="h-4 w-4" /> Group a passage</button>
    <button type="button" className="btn-ghost h-10 min-h-0 gap-1.5 px-3 text-sm" onClick={onYear} data-testid="log-fold-year-btn"><Layers className="h-4 w-4" /> Fold a year</button>
    <button type="button" className="btn-ghost h-10 min-h-0 gap-1.5 px-3 text-sm" onClick={onScan} data-testid="log-paper-scan-btn"><ScanText className="h-4 w-4" /> Batch Magic Scan Paper Logs</button>
    {hasFolders && (
      <button type="button" className="btn-ghost h-10 min-h-0 gap-1.5 px-3 text-sm" onClick={() => onAll(!anyOpen)} data-testid="log-folders-all-btn">
        {anyOpen ? <><ChevronsDownUp className="h-4 w-4" /> Close all folders</> : <><ChevronsUpDown className="h-4 w-4" /> Open all folders</>}
      </button>
    )}
  </div>
);
