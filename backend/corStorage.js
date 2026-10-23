// COR (Certificate of Registration) photo storage — uses Cloudinary.
// Students can send a PHOTO (JPEG/PNG from the app) or a PDF of their registration form.
//
// Why Cloudinary: Render's free server deletes saved files on every restart,
// so photos can't be kept there. Cloudinary keeps them online; our database
// only saves the photo's ID (cor_public_id), never the image itself.
//
// Privacy:
//   * Photos are uploaded as "authenticated" — they can't be opened with a plain link.
//   * Admins get a temporary signed link that stops working after 10 minutes.
//   * The photo is deleted as soon as the registration is approved or rejected.
//
// Setup (Render → Environment, and backend/.env for local):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// Package: npm install cloudinary   (inside the backend folder)

const crypto = require('crypto');

const FOLDER = 'qless-cor';
const VIEW_LINK_SECONDS = 10 * 60;            // admin's view link works for 10 minutes
const MAX_BASE64_LENGTH = 3 * 1024 * 1024;    // about 2 MB file (photos from the app are ~150–300 KB)
// PDFs get "-pdf-" in their Cloudinary ID, so we know the file type later without a new database column.
const PDF_MARK = '-pdf-';

// Loads and configures the Cloudinary library only when it's first needed,
// so the server still starts (with a clear error) if it isn't set up yet.
let client = null;
function getCloudinary() {
    if (client) return client;
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new Error('Cloudinary is not set up (missing CLOUDINARY_* environment variables).');
    }
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET,
        secure: true,
    });
    client = cloudinary;
    return client;
}

// Removes a "data:...;base64," start, if the app added one.
const stripPrefix = (base64) => base64.replace(/^data:[\w/+.-]+;base64,/, '');

// What kind of file it is, from its first bytes (not from the name, which can be faked).
//   JPEG starts with "/9j/", PNG with "iVBOR", PDF with "JVBERi0" (= "%PDF-").
function fileKind(data) {
    if (data.startsWith('JVBERi0')) return 'pdf';
    if (data.startsWith('/9j/') || data.startsWith('iVBOR')) return 'image';
    return null;
}

// Checks the file the app sent: a base64 photo (JPEG/PNG) or PDF, not too big.
// Returns an error message, or null if it's fine.
function checkCorImage(base64) {
    if (!base64 || typeof base64 !== 'string') return 'Please upload a photo or PDF of your Registration Form.';
    const data = stripPrefix(base64);
    if (data.length > MAX_BASE64_LENGTH) {
        return fileKind(data) === 'pdf'
            ? 'The PDF is too large (2 MB max). Please take a photo of your registration form instead.'
            : 'The photo is too large. Please take the photo again.';
    }
    if (!/^[A-Za-z0-9+/=\r\n]+$/.test(data) || !fileKind(data)) {
        return 'The file could not be read. Please upload a photo or a PDF of your registration form.';
    }
    return null;
}

const isPdf = (publicId) => String(publicId || '').includes(PDF_MARK);

// Uploads the photo and returns its Cloudinary ID (saved in the database).
// If it fails, the error is marked (err.corUpload) so the route can show a clear message.
async function uploadCor(base64, studentNumber) {
    try {
        return await uploadToCloudinary(base64, studentNumber);
    } catch (err) {
        console.error('COR upload failed:', err.message);
        err.corUpload = true;
        throw err;
    }
}

async function uploadToCloudinary(base64, studentNumber) {
    const cloudinary = getCloudinary();
    const data = stripPrefix(base64);
    const pdf = fileKind(data) === 'pdf';
    const mime = pdf ? 'application/pdf' : data.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
    const result = await cloudinary.uploader.upload(`data:${mime};base64,${data}`, {
        folder: FOLDER,
        type: 'authenticated',                                   // private: needs a signed link
        public_id: `${studentNumber}${pdf ? PDF_MARK : '-'}${crypto.randomUUID()}`, // unguessable name
        resource_type: 'image',                                  // Cloudinary keeps PDFs as "image" too (so it can show page 1)
        overwrite: false,
    });
    return result.public_id;
}

// Temporary links (10 minutes) so a signed-in admin can view the file.
// Returns { url, pdf_url }:
//   url      a JPG picture (for a PDF: its first page), shown in the admin pop-up
//   pdf_url  the original PDF (null for photos), opened with "Open PDF"
function corViewUrl(publicId) {
    const cloudinary = getCloudinary();
    const link = (format) => cloudinary.utils.private_download_url(publicId, format, {
        type: 'authenticated',
        resource_type: 'image',
        expires_at: Math.floor(Date.now() / 1000) + VIEW_LINK_SECONDS,
    });
    return { url: link('jpg'), pdf_url: isPdf(publicId) ? link('pdf') : null };
}

// Deletes the photo. Never throws: a failed delete must not block an approval.
async function deleteCor(publicId) {
    if (!publicId) return;
    try {
        await getCloudinary().uploader.destroy(publicId, { type: 'authenticated', resource_type: 'image', invalidate: true });
    } catch (err) {
        console.error('COR delete failed:', publicId, err.message);
    }
}

module.exports = { checkCorImage, uploadCor, corViewUrl, deleteCor };
