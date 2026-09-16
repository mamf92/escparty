# Security Policy

## Supported versions

ESCParty is deployed continuously from `main`. Only the version currently live
at https://mamf92.github.io/escparty/ (and its Vercel mirror) is supported —
there are no maintained older releases.

## Reporting a vulnerability

If you find a security issue in ESCParty — including problems with the
Firestore data model, multiplayer room access, quiz-answer leakage, or
exposed credentials — please **do not open a public GitHub issue**.

Report it privately instead, using either:

- GitHub's [private vulnerability reporting](https://github.com/mamf92/escparty/security/advisories/new)
  (Security tab → "Report a vulnerability"), or
- Email: mamfischer92@gmail.com

Please include steps to reproduce and, where possible, the potential impact.
We aim to acknowledge reports within 5 days.

## Scope notes

- The Firebase client config in `src/firebase.ts` (API key, project ID, etc.)
  is not a secret by design — Firebase access is enforced by Firestore
  security rules (and optionally App Check), not by hiding these values.
  Reports that only flag the config as "exposed," without a corresponding
  way to read/write data the rules should have blocked, are out of scope.
- ESCParty rooms have no authentication and no PII beyond a chosen display
  name. Reports about the lack of rate limiting or captcha on a party-quiz
  app should include a realistic abuse scenario (e.g. write amplification
  against Firestore quota, not "anyone can join a room with the code").
