/** Max PDF file size in MB. Single source of truth for frontend and API (e.g. align with Vercel body limits). */
export const MAX_PDF_FILE_SIZE_MB = 50;

export const MAX_PDF_FILE_SIZE_BYTES = MAX_PDF_FILE_SIZE_MB * 1024 * 1024;
