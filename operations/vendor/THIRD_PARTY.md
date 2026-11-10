# Browser libraries

These bundles are served locally so staff login and PDF processing do not depend on third-party script CDNs at runtime.

- Supabase JS 2.49.8 — MIT — https://github.com/supabase/supabase-js
- PDF.js 3.11.174 — Apache-2.0 — https://github.com/mozilla/pdf.js
- jsPDF 3.0.3 — MIT — https://github.com/parallax/jsPDF

PDF.js is used for text extraction only, with `isEvalSupported: false`. No PDF scripts, attachments, or document actions are executed by the application. Image-only PDFs are rejected until an OCR workflow is added.
