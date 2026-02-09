const fs = require("fs");
const path = require("path");

const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const publicDir = path.join(__dirname, "..", "public");
const destPath = path.join(publicDir, "pdf.worker.min.mjs");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
fs.copyFileSync(workerPath, destPath);
console.log("Copied pdf.worker.min.mjs to public/");
