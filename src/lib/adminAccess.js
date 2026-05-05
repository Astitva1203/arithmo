const DEFAULT_ADMIN_EMAILS = ['techyou2026@gmail.com', 'astitvapandey1203@gmail.com'];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function getAdminEmails() {
  const configured = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);

  return new Set(configured.length ? configured : DEFAULT_ADMIN_EMAILS);
}

export function isAdminEmail(email) {
  return getAdminEmails().has(normalizeEmail(email));
}
