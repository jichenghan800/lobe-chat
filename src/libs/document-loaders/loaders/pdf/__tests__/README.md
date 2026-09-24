# PDF regression fixtures

These synthetic, one-page PDFs were generated with ReportLab for this test.
They contain only a fictional Project Amber approval code and delivery time.
`reportlab.pdf` uses the default stream compression;
`reportlab-uncompressed.pdf` uses `pageCompression=0`.
Both reproduce the legacy parser failure when its input is a Node Buffer.
The test invokes the real loader in a child Node process to avoid Vitest VM realm differences.
