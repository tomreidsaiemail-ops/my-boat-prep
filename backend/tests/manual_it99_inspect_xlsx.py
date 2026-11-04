# Iteration 99: inspect downloaded Excel exports (one / zip / master) saved by the Playwright run into /tmp/dl99
import glob, io, zipfile, sys
from openpyxl import load_workbook

D = sys.argv[1] if len(sys.argv) > 1 else "/tmp/dl99"


def dump(wb, only=None):
    for ws in wb.worksheets:
        if only and ws.title not in only:
            print("  tab:", ws.title, ws.max_row - 1, "rows")
            continue
        print("  tab:", ws.title)
        for r in ws.iter_rows(values_only=True):
            print("    ", r)


for f in sorted(glob.glob(f"{D}/*")):
    print("==", f)
    if f.endswith(".zip"):
        z = zipfile.ZipFile(f)
        for n in z.namelist():
            print(" file:", n)
            wb = load_workbook(io.BytesIO(z.read(n)))
            dump(wb, only={"Ship's Log", "Leaving Dock"})
    else:
        dump(load_workbook(f), only={"Ship's Log", "Leaving Dock"})
