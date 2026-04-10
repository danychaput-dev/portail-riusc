-- Migration Monday -> Supabase: Chicoutimi (Cohorte 9)
-- ON CONFLICT skip les doublons

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11334227428', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'alexx.lamatell@gmail.com', '16138750665', 'Alexandre Lamarre-Tellier', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('18269588181', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'kiara.constructionrenol@hotmail.com', '14183211861', 'Kiara Lavoie', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('18249978744', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'morin.m04@hotmail.com', '14505163204', 'Michael Morin', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('18269588190', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'emman913@msn.com', '14188125280', 'Emmanuel Ross Morel', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11360887845', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'etienne.rellier@gmail.com', '14183760442', 'Etienne Rellier', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11382870643', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'steeve-t@hotmail.com', '14186189855', 'Steeve Thibeault', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11392292705', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'elizabethchouinard2003@gmail.com', '14383907843', 'Elizabeth Chouinard', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11441442497', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'laforestjeremy75@gmail.com', '15817280879', 'Jérémy Laforest', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11443422434', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'georges.grenon22@gmail.com', '15815609577', 'Georges Grenon', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11480698428', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'frand999@hotmail.com', '14185907989', 'François Dallaire', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('18200499925', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'noemie.robichaud31@outlook.com', '14188172586', 'Noémie Robichaud', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11490085398', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'alaincroteau8991@gmail.com', '15813989670', 'Alain Croteau', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('18305001206', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'alexrobichaud07@outlook.com', '14188179915', 'Alex Robichaud', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11497120708', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'yanboulianne@gmail.com', '14188182350', 'Yan Boulianne', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('10878226263', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'josiane.labrecque@msp.gouv.qc.ca', '14189289547', 'Josiane Labrecque', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11511750237', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'amelietrep2016@gmail.com', '14188159138', 'Amélie Trépanier', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11377840308', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'mamaninde@yahoo.ca', '15142079086', 'Line Lecours', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11546425968', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'chantale.tremblay@msp.gouv.qc.ca', '15148806089', 'chantale Tremblay', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('18363253988', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'war-charles@hotmail.ca', '14186186037', 'Charles Deschênes-Potvin', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11619200180', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'menard360@gmail.com', '14185506491', 'Eric Ménard', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11620183442', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'denis3006@live.ca', '14188128473', 'Denis Gagnon', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11621815034', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'isabelle0680@hotmail.com', '14187194501', 'Isabelle Lamarche', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11634585575', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'jeanfgregoire74@gmail.com', '14189449888', 'Jean-Francois Gre', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11634742693', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'dave.emond33@hotmail.com', '14185501994', 'Dave Emond', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11634901568', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'me@nicolasfortin.ca', '15814760434', 'Nicolas Fortin', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('18219399596', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'audrey.robertson@hotmail.com', '14184876766', 'Audrey Robertson', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11637175515', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'ludovic-paradis@hotmail.com', '15818820710', 'Ludovic Paradis', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11637211082', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'mathieu.dg7@gmail.com', '14185401937', 'Mathieu Duval', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11637908969', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'gaetanlaflamme06@hotmail.com', '14185440349', 'Gaetan Laflamme', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11638247400', 'CAMP_CHICOUTIMI_AVR26', 'confirme', '2533332@etu.cchic.ca', '14189449063', 'Alyson Lefebvre', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11638403258', 'CAMP_CHICOUTIMI_AVR26', 'incertain', 'vittautclemence@gmail.com', '14189449063', 'Clémence Vittaut', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11641295078', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'dufouryves@me.com', '15142322009', 'Yves Dufour', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11642368371', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'francoisboivin@gmail.com', '14188178318', 'Boivin François', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11645020639', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'izoo76@hotmail.com', '14185901475', 'Isabelle Tremblay', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11645921558', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'carlbergeron2010@gmail.com', '14183766481', 'Carl Bergeron', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

INSERT INTO inscriptions_camps (benevole_id, session_id, presence, courriel, telephone, prenom_nom, camp_nom, camp_dates, camp_lieu)
VALUES ('11651909807', 'CAMP_CHICOUTIMI_AVR26', 'confirme', 'annemarie3360@hotmail.com', '14185570038', 'Anne-Marie Tremblay', 'Cohorte 9 - Camp de qualification - Chicoutimi', '25-26 avril 2026', 'Hôtel Chicoutimi')
ON CONFLICT (benevole_id, session_id) DO NOTHING;

