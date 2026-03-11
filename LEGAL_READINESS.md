# Arithmo Legal Readiness (Practical)

## Implemented in code

- Terms and Privacy acceptance required at sign-up.
- Age confirmation required at sign-up.
- Consent timestamps and policy version stored in DB (`User.legalConsent`).
- Terms and Privacy pages include effective date and contact email.
- Account deletion removes user-linked records.
- API keys and secrets are environment-variable based.

## Must do before public launch

- Replace placeholder secrets with production values.
- Rotate any keys that were ever exposed in local files/screenshots.
- Update Terms/Privacy text to match your real company/entity details.
- Add your real legal contact email and jurisdiction language.
- Define minimum age and parental consent rules for your target regions.

## High-risk areas requiring legal counsel

- Privacy law obligations in your target markets (for example GDPR/UK GDPR/CCPA).
- Data transfer and storage region obligations.
- AI content liability language and sector-specific restrictions.
- Copyright/ownership terms for user uploads and generated outputs.
- Child safety and age-gating requirements.

## Important

No technical implementation can guarantee you are "completely legal" in all jurisdictions.  
For full legal safety, have a licensed lawyer review your final Terms, Privacy, and business workflow.
