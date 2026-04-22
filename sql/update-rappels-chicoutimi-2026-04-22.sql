-- ====================================================================
-- Maj rappels_camps Cohorte 9 Chicoutimi depuis CSV Twilio 2026-04-22
-- Session: CAMP_CHICOUTIMI_AVR26
-- 72 rappels envoyes 2026-04-21 07:45 (pattern 'Bon matin')
-- 60 numeros ont repondu apres le rappel du matin
-- Guard AND reponse IS NULL: n'ecrase pas les reponses deja enregistrees
-- ====================================================================

BEGIN;

-- +12633813350 [OUI]: Oui 
UPDATE rappels_camps SET
  reponse = 'Oui ',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:55:31-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+12633813350'
  AND reponse IS NULL;

-- +14183217234 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:48:08-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14183217234'
  AND reponse IS NULL;

-- +14183506805 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:47:10-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14183506805'
  AND reponse IS NULL;

-- +14183760442 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:51:35-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14183760442'
  AND reponse IS NULL;

-- +14183766481 [NON]: Non 
UPDATE rappels_camps SET
  reponse = 'Non ',
  reponse_confirmee = FALSE,
  reponse_at = '2026-04-21T08:23:18-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14183766481'
  AND reponse IS NULL;

-- +14183769857 [NON]: Non
UPDATE rappels_camps SET
  reponse = 'Non',
  reponse_confirmee = FALSE,
  reponse_at = '2026-04-21T20:11:19-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14183769857'
  AND reponse IS NULL;

-- +14184876766 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:47:56-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14184876766'
  AND reponse IS NULL;

-- +14185401937 [NON]: NON
UPDATE rappels_camps SET
  reponse = 'NON',
  reponse_confirmee = FALSE,
  reponse_at = '2026-04-21T09:21:58-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14185401937'
  AND reponse IS NULL;

-- +14185440349 [AMBIGU]: Impossible d'y être Non  (Envoyé avec énergie) | Oui (Envoyé avec énergie)
UPDATE rappels_camps SET
  reponse = 'Impossible d''y être Non 
(Envoyé avec énergie) | Oui
(Envoyé avec énergie)',
  reponse_confirmee = NULL,
  reponse_at = '2026-04-21T08:42:11-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14185440349'
  AND reponse IS NULL;

-- +14185501994 [NON]: Non
UPDATE rappels_camps SET
  reponse = 'Non',
  reponse_confirmee = FALSE,
  reponse_at = '2026-04-21T07:50:37-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14185501994'
  AND reponse IS NULL;

-- +14185506491 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:18:12-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14185506491'
  AND reponse IS NULL;

-- +14185570038 [NON]: Non
UPDATE rappels_camps SET
  reponse = 'Non',
  reponse_confirmee = FALSE,
  reponse_at = '2026-04-21T10:24:42-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14185570038'
  AND reponse IS NULL;

-- +14185873927 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T18:56:58-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14185873927'
  AND reponse IS NULL;

-- +14185901475 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:08:29-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14185901475'
  AND reponse IS NULL;

-- +14185907989 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:49:58-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14185907989'
  AND reponse IS NULL;

-- +14186189855 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T19:48:53-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14186189855'
  AND reponse IS NULL;

-- +14186371448 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:48:54-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14186371448'
  AND reponse IS NULL;

-- +14186691343 [OUI]: Oui 
UPDATE rappels_camps SET
  reponse = 'Oui ',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:49:03-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14186691343'
  AND reponse IS NULL;

-- +14186906358 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:49:40-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14186906358'
  AND reponse IS NULL;

-- +14186906779 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:48:10-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14186906779'
  AND reponse IS NULL;

-- +14187187306 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:00:48-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14187187306'
  AND reponse IS NULL;

-- +14187205472 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T09:17:08-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14187205472'
  AND reponse IS NULL;

-- +14188125280 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:37:08-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14188125280'
  AND reponse IS NULL;

-- +14188126284 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:49:14-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14188126284'
  AND reponse IS NULL;

-- +14188159138 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:08:48-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14188159138'
  AND reponse IS NULL;

-- +14188171099 [OUI]: Oui 
UPDATE rappels_camps SET
  reponse = 'Oui ',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:48:16-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14188171099'
  AND reponse IS NULL;

-- +14188172586 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:49:06-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14188172586'
  AND reponse IS NULL;

-- +14188178318 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T10:03:12-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14188178318'
  AND reponse IS NULL;

-- +14188179915 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:50:49-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14188179915'
  AND reponse IS NULL;

-- +14188181988 [OUI]: Oui 
UPDATE rappels_camps SET
  reponse = 'Oui ',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:55:19-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14188181988'
  AND reponse IS NULL;

-- +14188184503 [OUI]: Oui | Merci ☺️  | Oui
UPDATE rappels_camps SET
  reponse = 'Oui | Merci ☺️  | Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T18:55:38-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14188184503'
  AND reponse IS NULL;

-- +14189289547 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:56:16-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14189289547'
  AND reponse IS NULL;

-- +14189298285 [NON]: Non
UPDATE rappels_camps SET
  reponse = 'Non',
  reponse_confirmee = FALSE,
  reponse_at = '2026-04-21T08:15:29-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14189298285'
  AND reponse IS NULL;

-- +14189449888 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:49:06-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14189449888'
  AND reponse IS NULL;

-- +14189555152 [OUI]: Oui 
UPDATE rappels_camps SET
  reponse = 'Oui ',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:53:07-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14189555152'
  AND reponse IS NULL;

-- +14505163204 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T17:36:01-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+14505163204'
  AND reponse IS NULL;

-- +15142079086 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T09:51:06-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15142079086'
  AND reponse IS NULL;

-- +15142322009 [NON]: Non , désolé 
UPDATE rappels_camps SET
  reponse = 'Non , désolé ',
  reponse_confirmee = FALSE,
  reponse_at = '2026-04-21T14:48:54-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15142322009'
  AND reponse IS NULL;

-- +15143485456 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T18:49:36-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15143485456'
  AND reponse IS NULL;

-- +15145949007 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:51:12-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15145949007'
  AND reponse IS NULL;

-- +15147788711 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:14:40-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15147788711'
  AND reponse IS NULL;

-- +15812341531 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T17:00:42-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15812341531'
  AND reponse IS NULL;

-- +15812350219 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T11:19:10-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15812350219'
  AND reponse IS NULL;

-- +15812351187 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:04:28-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15812351187'
  AND reponse IS NULL;

-- +15812352311 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:52:52-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15812352311'
  AND reponse IS NULL;

-- +15812359251 [OUI]: OUI 
UPDATE rappels_camps SET
  reponse = 'OUI ',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:10:04-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15812359251'
  AND reponse IS NULL;

-- +15814452086 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:59:38-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15814452086'
  AND reponse IS NULL;

-- +15814473550 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T09:32:41-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15814473550'
  AND reponse IS NULL;

-- +15814476319 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:56:41-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15814476319'
  AND reponse IS NULL;

-- +15814760434 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:04:26-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15814760434'
  AND reponse IS NULL;

-- +15815746144 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:48:17-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15815746144'
  AND reponse IS NULL;

-- +15816686842 [OUI]: Oui 
UPDATE rappels_camps SET
  reponse = 'Oui ',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:46:25-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15816686842'
  AND reponse IS NULL;

-- +15817280879 [NON]: Non
UPDATE rappels_camps SET
  reponse = 'Non',
  reponse_confirmee = FALSE,
  reponse_at = '2026-04-21T12:22:18-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15817280879'
  AND reponse IS NULL;

-- +15818820710 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:59:42-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15818820710'
  AND reponse IS NULL;

-- +15818824792 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T18:55:35-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15818824792'
  AND reponse IS NULL;

-- +15819740118 [OUI]: Oui 
UPDATE rappels_camps SET
  reponse = 'Oui ',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T07:46:35-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15819740118'
  AND reponse IS NULL;

-- +15819995321 [OUI]: Oui
UPDATE rappels_camps SET
  reponse = 'Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T09:33:53-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+15819995321'
  AND reponse IS NULL;

-- +16138750665 [OUI]: OUI
UPDATE rappels_camps SET
  reponse = 'OUI',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:07:10-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+16138750665'
  AND reponse IS NULL;

-- +18195768466 [OUI]: OUI. | Oui
UPDATE rappels_camps SET
  reponse = 'OUI. | Oui',
  reponse_confirmee = TRUE,
  reponse_at = '2026-04-21T08:10:38-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+18195768466'
  AND reponse IS NULL;

-- +18199964678 [NON]: Non
UPDATE rappels_camps SET
  reponse = 'Non',
  reponse_confirmee = FALSE,
  reponse_at = '2026-04-21T18:54:43-04:00'::timestamptz
WHERE session_id = 'CAMP_CHICOUTIMI_AVR26'
  AND telephone = '+18199964678'
  AND reponse IS NULL;

-- Verification avant COMMIT:
SELECT COUNT(*) FILTER (WHERE reponse_confirmee=true) AS oui,
       COUNT(*) FILTER (WHERE reponse_confirmee=false) AS non,
       COUNT(*) FILTER (WHERE reponse IS NOT NULL AND reponse_confirmee IS NULL) AS ambigu,
       COUNT(*) FILTER (WHERE reponse IS NULL) AS sans_reponse
FROM rappels_camps WHERE session_id = 'CAMP_CHICOUTIMI_AVR26';

COMMIT;