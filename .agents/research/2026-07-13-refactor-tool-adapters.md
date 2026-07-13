# Tool Processing Adapter Refactor

**Date:** 2026-07-13
**Target:** OfficeWeb document tool processing routes
**Strategy:** Incremental migration after a committed behavior baseline

## Blast Radius

| Risk level | Files | Description |
|---|---:|---|
| Direct | 4 | PDF, document, conversion, and image API routes |
| Immediate | 7 | Shared, SheetJS, OpenXML, text, pdf-lib, LibreOffice, image renderer adapters |
| UI | 1 | Existing tool action dispatch remains unchanged |
| Total | 12 | No database, account, billing, or AionCore changes |

## Steps

| Step | Change | Verification |
|---|---|---|
| 1 | Commit new tool behavior as rollback baseline | Unit tests, lint, real CSV/PPT requests |
| 2 | Extract shared subprocess and ZIP lifecycle | Static checks |
| 3 | Extract SheetJS, OpenXML, and text adapters | Same action identifiers and response filenames |
| 4 | Extract LibreOffice, Poppler, pdf-lib, and qpdf adapters | Real API smoke tests |
| 5 | Reduce routes to validation, dispatch, and HTTP response | Tests and lint |

## Rollback

Revert the adapter refactor commit while keeping baseline commit `ad87c98`. No data migration or external service state is involved.
