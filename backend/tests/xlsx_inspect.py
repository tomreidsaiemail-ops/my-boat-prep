# Helper: dump sheets/headers/sample rows of downloaded Excel exports (xlsx or zip of xlsx) for Excel export testing.
import io
import sys
import zipfile

import openpyxl


def dump(wb_bytes, label, rows=6):
    wb = openpyxl.load_workbook(io.BytesIO(wb_bytes))
    print(f"=== {label}: tabs={wb.sheetnames}")
    for ws in wb.worksheets:
        print(f"--- [{ws.title}] dims={ws.dimensions} rows={ws.max_row}")
        for r in ws.iter_rows(min_row=1, max_row=min(ws.max_row, rows)):
            print("   ", [(c.value, c.number_format) if c.value is not None and c.data_type in ("d", "n") else c.value for c in r])


for path in sys.argv[2:]:
    n = int(sys.argv[1])
    if path.endswith(".zip"):
        z = zipfile.ZipFile(path)
        print("ZIP", path, z.namelist())
        for name in z.namelist():
            dump(z.read(name), name, n)
    else:
        dump(open(path, "rb").read(), path, n)
