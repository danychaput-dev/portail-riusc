'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ModalComposeCourriel from '@/app/components/ModalComposeCourriel'

interface CertificatEnAttente {
  id: string
  benevole_id: string
  nom_complet: string
  nom_formation: string
  certificat_url: string
  email: string
  signedUrl?: string
  dateInput?: string
  dateExpiration?: string
  statut?: 'idle' | 'saving' | 'saved' | 'error'
}

interface CertificatACompleter {
  id: string
  benevole_id: string
  nom_complet: string
  nom_formation: string
  email: string
}

interface DownloadedFile {
  storagePath: string
  signedUrl: string
  name: string
  file: File
}

interface MondayItem {
  monday_item_id: number
  nom: string
  email: string
  files: { name: string; url: string }[]
  downloadedFiles?: DownloadedFile[]
  mState: {
    status: 'idle' | 'saving' | 'saved' | 'error' | 'skipped'
    formation: string
    dateObtention: string
    dateExpiration: string
    error?: string
    uploadedFile?: File
    selectedStoragePath?: string
    selectedSignedUrl?: string
  }
}

const FORMATIONS = [
  "S'initier à la sécurité civile (MSP)",
  "Introduction à la sécurité civile",
  "Cours ICS/SCI 100",
  "Cours ICS/SCI 200",
  "Premiers soins / RCR",
  "Radio amateur",
  "Prévention incendie",
  "Formation RIUSC",
  "Autre",
]

const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)/i.test(url)
function initials(nom: string | null | undefined) {
  if (!nom) return '??'
  const p = nom.trim().split(' ')
  return ((p[0]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '')).toUpperCase()
}

function formationsMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (norm(a) === norm(b)) return true
  const initierKeys = ['sinitier', 'initierlasecuritecivile', 'securitecivile', 'msp']
  const aIsInitier = initierKeys.some(k => norm(a).includes(k))
  const bIsInitier = initierKeys.some(k => norm(b).includes(k))
  if (aIsInitier && bIsInitier) return true
  return false
}

function detectFormation(files: { name: string; url: string }[]): string {
  const text = files.map(f => f.name + ' ' + f.url).join(' ').toLowerCase()
  if (/initier|msp|s-initier|sinitier|securite.civile|s%c3%a9curit|ssc/.test(text)) return "S'initier à la sécurité civile (MSP)"
  if (/incendie/.test(text)) return 'Prévention incendie'
  if (/radio.amateur/.test(text)) return 'Radio amateur'
  if (/premiers.soins|rcr|secourisme/.test(text)) return 'Premiers soins / RCR'
  if (/ics.?100|sci.?100/.test(text)) return 'Cours ICS/SCI 100'
  if (/ics.?200|sci.?200/.test(text)) return 'Cours ICS/SCI 200'
  if (/riusc/.test(text)) return 'Formation RIUSC'
  return "S'initier à la sécurité civile (MSP)"
}

// 101 personnes avec certificats Monday sans entree dans formations_benevoles
const MONDAY_RAW: Omit<MondayItem, 'mState'>[] = [
  { monday_item_id: 18133661055, nom: 'Messier Stephane', email: 'S.MESSIER@VIDEOTRON.CA', files: [{ name: 'Cert incendie.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2527946319/Certificat_Messier_Stephane%20incendie.pdf' }, { name: 'Cert Securite civile.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2527946371/Certificat_Messier_Stephane%20Securite%20civile.pdf' }] },
  { monday_item_id: 18164827325, nom: 'Jalette Yannick', email: 'yannickk_jalette@icloud.com', files: [{ name: 'Certificat_Jalette_Yannick.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2510933257/Certificat_Jalette_Yannick_AKA74DD1C41AF2B5829AKA.pdf' }] },
  { monday_item_id: 18164961008, nom: 'Mucyo Eunice', email: 'mucyo211@hotmail.com', files: [{ name: 'Certificat_Mucyo_Eunice.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2581988715/Certificat_Mucyo_Eunice_AKA4B3312309668F34FAKA.pdf' }] },
  { monday_item_id: 18166778980, nom: 'Savard Marie-Pierre', email: 'savardmariepierre@gmail.com', files: [{ name: 'Certificat_Savard_Marie-pierre.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2567907752/1Certificat_Savard_Marie-pierre_AKA7B5CF5D531D3918CAKA%20(2).pdf' }] },
  { monday_item_id: 18167101047, nom: 'Renaud Daniel', email: 'drenaud1962@gmail.com', files: [{ name: 'Certificat_Renaud_Daniel.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2490152662/Certificat_Renaud_Daniel_AKA8A23497768A4BF0BAKA.pdf' }] },
  { monday_item_id: 18167435118, nom: 'Labrecque Jimmy', email: 'labrecquejim@hotmail.ca', files: [{ name: 'Initier a la s.c..jpg', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2485498368/Initier%20%C3%A0%20la%20s.c..jpg' }, { name: 'Radio amateur.jpg', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2485499074/Radio%20amateur%20Jimmy%20-%20Labreque.jpg' }] },
  { monday_item_id: 18170248370, nom: 'Tettaut Tommy', email: 'missu-one@hotmail.com', files: [{ name: 'Certificat.jpg', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2525901002/17619966341106248730716988037799.jpg' }] },
  { monday_item_id: 18171390111, nom: 'Gougeon Francois', email: 'francois.gougeon@live.ca', files: [{ name: 'certificat_MSP_Gougeon.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2494474918/certificat_MSP_S-Initier-a-la-securite-civile_F-Gougeon_2025-10-17.pdf' }] },
  { monday_item_id: 18180213680, nom: 'Jimenez Alvaro', email: 'varojimenez@gmail.com', files: [{ name: 'Certificat_Jimenez_Alvaro.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2507322521/Certificat_Jimenez_Alvaro_AKA264BAD1A6A741112AKA.pdf' }] },
  { monday_item_id: 18180356840, nom: 'Roy Remy', email: 'recherche@remyroy.com', files: [{ name: 'Certificat_Roy_Remy.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2503665768/Certificat_Roy_R%C3%A9my_AKAA47E9C2A1F730A01AKA%20-%20S%C3%A9curit%C3%A9%20Civil.pdf' }] },
  { monday_item_id: 18183563535, nom: 'Gauthier Martin', email: 'mart.police@gmail.com', files: [{ name: 'Certificat_Gauthier_Martin.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2525914735/Certificat_Gauthier_Martin_AKAF6DA5B4D04CF507DAKA.pdf' }] },
  { monday_item_id: 18183683615, nom: 'Bussieres Lizanne', email: 'lizannebussieres@yahoo.com', files: [{ name: 'Certificat_BUSSIERES_LIZANNE.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2488456351/Certificat_BUSSIERES_LIZANNE_AKA0429EC37ADEEB368AKA%20(1).pdf' }] },
  { monday_item_id: 18185703358, nom: 'Pugin Denis', email: 'denis.pugin@gmail.com', files: [{ name: 'Certificat_Pugin_Denis.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2549428704/Certificat_Pugin_Denis_AKAFF28336F1E2877EEAKA.pdf' }] },
  { monday_item_id: 18186465522, nom: 'Brulotte Jean-Louis', email: 'jlb064@hotmail.com', files: [{ name: 'SCQ.JL.Brulotte.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2529671528/SCQ.JL.Brulotte.pdf' }] },
  { monday_item_id: 18187097686, nom: 'Cadorette Julie', email: 'jucadorette@hotmail.com', files: [{ name: 'Certificat_Cadorette_Julie.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2493994106/Certificat_Cadorette_Julie_AKA725AC06208134E3EAKA%20(1).pdf' }] },
  { monday_item_id: 18187394154, nom: 'Anctil Cathy', email: 'cathy_anctil@msn.com', files: [{ name: 'Certificat_Anctil_Cathy.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2498364946/Certificat_Anctil_Cathy_AKAD526935FC7DE870EAKA.pdf' }] },
  { monday_item_id: 18189495492, nom: 'Gagne Alexandre', email: 'alex.papamedic@gmail.com', files: [{ name: 'Certificat_Gagne_Alexandre.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2494086156/Certificat_Gagn%C3%A9_Alexandre_AKAB5BF2AED7C2AEC2FAKA.pdf' }] },
  { monday_item_id: 18192176206, nom: 'Vigneault Luc', email: 'poney259@gmail.com', files: [{ name: 'Certificat_Vigneault_Luc.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2563579127/Certificat_Vigneault_Luc_AKA78308185BA8B638AAKA.pdf' }] },
  { monday_item_id: 18196747022, nom: 'Morneau Norbert', email: 'morneau.norbert@gmail.com', files: [{ name: 'Certificat_Morneau_Norbert.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2585478570/Certificat_Morneau_Norbert_AKA9E6AD3043D789DB5AKA.pdf' }] },
  { monday_item_id: 18200499925, nom: 'Robichaud Noemie', email: 'noemie.robichaud31@outlook.com', files: [{ name: 'Certificat_Robichaud_Noemie.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2532304996/Certificat_Robichaud_No%C3%A9mie_AKAA008111885B2D2AEAKA.pdf' }] },
  { monday_item_id: 18204062281, nom: 'Gagne Sylvain', email: 'sg2ic2rcha@hotmail.com', files: [{ name: 'Certificat_Gagne_Sylvain.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2491345609/Certificat_Gagne_Sylvain_AKAACA64CA4DB95AAE3AKA.pdf' }] },
  { monday_item_id: 18204142055, nom: 'Aumand Christophe', email: 'christophe.aumand@gmail.com', files: [{ name: 'Certificat_Aumand_Christophe.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2534647766/Certificat_Aumand_Christophe_AKA28FEF5BFC1789662AKA.pdf' }] },
  { monday_item_id: 18204463719, nom: 'Laplante Manon', email: 'mlaplante67@hotmail.com', files: [{ name: 'certificat_MSP.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2780183264/certificat_MSP.pdf' }] },
  { monday_item_id: 18207012227, nom: 'Abaji Marek', email: 'marek.abaji1@gmail.com', files: [{ name: 'Certificat_Abaji_Marek.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2498452415/Certificat_Abaji_Marek_AKAE4484777022B2483AKA.pdf' }] },
  { monday_item_id: 18214461054, nom: 'Simoneau-Roy Sacha', email: 'ssrinspection@gmail.com', files: [{ name: 'Certificat_Simoneau-Roy_Sacha.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2499908915/Certificat_Simoneau-Roy_Sacha_AKA72CF97202F056881AKA.pdf' }] },
  { monday_item_id: 18217885609, nom: 'Barbin Gentiane', email: 'gentianeb@hotmail.com', files: [{ name: 'Certificat_Barbin_Gentiane.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2508447204/Certificat_Barbin_Gentiane_AKA4F6A1BEA36C9DCF3AKA.pdf' }] },
  { monday_item_id: 18218227318, nom: 'Boivin Steve', email: 'steve.boivin@msp.gouv.qc.ca', files: [{ name: 'Certificat_Boivin_Steve.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2498574007/Certificat_Boivin_Steve_AKA28A8EB2E484D55B8AKA.pdf' }] },
  { monday_item_id: 18221323692, nom: 'Bondu Hugo', email: 'incendie@localiteradisson.com', files: [{ name: 'Certificat_Bondu_Hugo.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2499254797/Certificat_Bondu_Hugo_AKA5F450B6FC8C1F436AKA%20(1).pdf' }] },
  { monday_item_id: 18238844335, nom: 'Couture Simon', email: 'sim.couture@hotmail.ca', files: [{ name: 'Certificat_Couture_Simon.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2501017959/Certificat_Couture_Simon_AKA1C765DCD96146C81AKA.pdf' }] },
  { monday_item_id: 18243223190, nom: 'Bellili Khesiah', email: 'bellilikhesiah@gmail.com', files: [{ name: 'Certificat_Bellili_Khesiah.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2510303131/Certificat_Bellili_Khesiah_AKABD4F83230A5AF17BAKA.pdf' }] },
  { monday_item_id: 18243800622, nom: 'Garant Brigitte', email: 'bridgegarant@gmail.com', files: [{ name: 'Certificat_Garant_Brigitte.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2513385970/Certificat_Garant_Brigitte_AKA2941FDC756B42ADBAKA.pdf' }] },
  { monday_item_id: 18245488952, nom: 'Marchand Stephane', email: 'stephanemarchand00@gmail.com', files: [{ name: 'Certificat_Marchand_Stephane.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2508143437/Certificat_Marchand_Stephane_AKA434289E30E3975B8AKA.pdf' }] },
  { monday_item_id: 18246551699, nom: 'Duquette Annie', email: 'astrelle@hotmail.com', files: [{ name: 'Certificat_Duquette_Annie.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2503255480/Certificat_Duquette_Annie_AKA315F41955CB88CFAAKA%20introduction%20s%C3%A9curit%C3%A9%20civile.pdf' }] },
  { monday_item_id: 18248722154, nom: 'Gerard Melyssa', email: 'gerardmelyssa@gmail.com', files: [{ name: 'Certificat_Gerard_Melyssa.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2532097348/Certificat_Gerard_Melyssa_AKA686323DA80C27A95AKA.pdf' }] },
  { monday_item_id: 18249531452, nom: 'Massicotte Line', email: 'line.massicotte@me.com', files: [{ name: 'Certificat_Massicotte_Line.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2504324925/Certificat_Massicotte_Line_AKA3AFB8951FED5AD6AAKA.pdf' }] },
  { monday_item_id: 18249751620, nom: 'Desbiens Axel', email: 'axeldesbiens@gmail.com', files: [{ name: 'Certificat_Desbiens_Axel.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2519276141/Certificat_Desbiens_Axel_AKA025B4CC15852CC76AKA.pdf' }] },
  { monday_item_id: 18249978744, nom: 'Morin Michael', email: 'morin.m04@hotmail.com', files: [{ name: 'Certificat_Morin_Michael.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2532894019/Certificat_Morin_Michael_AKA2E5A3B43228FC4ABAKA.pdf' }] },
  { monday_item_id: 18252864586, nom: 'Daigle Marc', email: 'papi.daigle@gmail.com', files: [{ name: 'securitecivil.jpg', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2505123346/securitecivil.jpg' }] },
  { monday_item_id: 18253212743, nom: 'Racine Julie', email: 'frisinette101@gmail.com', files: [{ name: 'Certificat_Racine_Julie.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2505214167/Certificat_Racine_Julie_AKAF93ECAFBE6006FF4AKA.pdf' }] },
  { monday_item_id: 18255140677, nom: 'Lauziere Sylvie', email: 'sissipower@hotmail.com', files: [{ name: 'Certificat_Lauziere_Sylvie.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2566362265/Certificat_Lauzi%C3%A8re_Sylvie_AKA773CC85D10C99ACCAKA.pdf' }] },
  { monday_item_id: 18257433457, nom: 'Langlois Noel Mylene', email: 'mimi_noel_1996@hotmail.com', files: [{ name: 'Screenshot_Chrome.jpg', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2526069239/Screenshot_20250605_183118_Chrome.jpg' }] },
  { monday_item_id: 18257442277, nom: 'Pineau Couturier Alexandra', email: 'alexa.couturier@gmail.com', files: [{ name: 'Certificat_Pineau_Couturier_Alexandra.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2526048172/Certificat_Pineau%20Couturier_Alexandra_AKA2C7C4126649DD2DCAKA.pdf' }] },
  { monday_item_id: 18262752162, nom: 'Matton Marie-Claude', email: 'mc2matton@gmail.com', files: [{ name: 'certificat_MSP-SSC.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2508288461/certificat_MSP-SSC.pdf' }] },
  { monday_item_id: 18264838495, nom: 'Carrier Maxime', email: 'maxime.carrier.90@gmail.com', files: [{ name: 'Certificat_Carrier_Maxime.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2536151884/Certificat_Carrier_Maxime_AKA3A89B0E266288873AKA.pdf' }] },
  { monday_item_id: 18268854754, nom: 'Lefebvre Martin', email: 'martin233@hotmail.ca', files: [{ name: 'Martin_Lefebvre.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2510137953/Martin%20Lefebvre[300].pdf' }] },
  { monday_item_id: 18269588107, nom: 'Pronovost Camille', email: 'Camille.pronovost@gmail.com', files: [{ name: 'Certificat_Pronovost_Camille.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2550930160/Certificat_Pronovost_Camille_AKAE8F5035CD8638142AKA.pdf' }] },
  { monday_item_id: 18269588108, nom: 'Goulet Sylvain', email: 'Ve2syy@hotmail.com', files: [{ name: 'Certificat_Goulet_Sylvain.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2510428034/Certificat_Goulet_Sylvain_AKAAF9FA5E7973E48B3AKA-1.pdf' }] },
  { monday_item_id: 18269588117, nom: 'Desrosiers Carl', email: 'fuinaround@hotmail.com', files: [{ name: 'Certificat_Desrosiers_Carl.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2538936294/Certificat_Desrosiers_Carl_AKAA0ACECECC904784AAKA.pdf' }] },
  { monday_item_id: 18269588123, nom: 'Normand Francois', email: 'francois.normand@groupecontex.ca', files: [{ name: 'Certificat_Normand_Francois.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2512918159/R%C3%A9serve%20UTF-8certificat_Normand_Franc%CC%A7ois_AKA8E525465EABD71B2AKA%202.pdf' }] },
  { monday_item_id: 18269588125, nom: 'Carrier Nicolas-Joseph', email: 'nicolasjosephcarrier@gmail.com', files: [{ name: 'Certificat_Carrier_Nicolas-Joseph.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2512834529/Certificat_Carrier_Nicolas-Joseph%20_AKA484505775C7DB5DAAKA.pdf' }] },
  { monday_item_id: 18269588128, nom: 'Marcel Jean', email: 'Marceljean21@gmail.com', files: [{ name: 'certificat_MSP.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2566096442/certificat_MSP.pdf' }] },
  { monday_item_id: 18269588143, nom: 'Lefebvre Normand', email: 'normlefebvre@yahoo.com', files: [{ name: 'Certificat_Lefebvre_Normand.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2526041694/Certificat_Lefebvre_Normand_AKAA848D173E1F0AB1FAKA.pdf' }] },
  { monday_item_id: 18269588146, nom: 'Roy Elizabeth', email: 'zabette.roy@gmail.com', files: [{ name: 'Certificat_Roy_Elizabeth.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2542254097/Certificat_Roy_Elizabeth_AKA3EC8B45D60E089BDAKA.pdf' }] },
  { monday_item_id: 18269588150, nom: 'Leblanc Mathieu', email: 'math436leblanc@gmail.com', files: [{ name: 'Certificat_Leblanc_Mathieu.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2542243640/Certificat_Leblanc_Mathieu_AKA7B6773CFD1990AA8AKA.pdf' }] },
  { monday_item_id: 18269588153, nom: 'Gagnon Tamy', email: 'gagnontamy@gmail.com', files: [{ name: 'Certificat_Gagnon_Tamy.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2574826213/Certificat_Gagnon_Tamy_AKA81F756A9F3A20F9FAKA%20(1).pdf' }] },
  { monday_item_id: 18269588154, nom: 'Dessureault Caroline', email: 'caroline.dessureault@ssss.gouv.qc.ca', files: [{ name: 'Certificat_Dessureault_Caroline.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2560497000/Certificat_Dessureault_Caroline_AKAD7376A3BE3192F01AKA.pdf' }] },
  { monday_item_id: 18269588159, nom: 'V. Lascov Oleg', email: 'dg@saint-mathieu.com', files: [{ name: 'Certificat_Lascov_Oleg.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2773141478/Certificat_Lascov_Oleg%20V._AKAF8E6457376D225CBAKA.pdf' }] },
  { monday_item_id: 18269588161, nom: 'Boisjoly-Lavoie Amelie', email: 'amelieboisjoly@gmail.com', files: [{ name: 'Certificat_Boisjoly-Lavoie_Amelie.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2526796446/Certificat_Boisjoly-Lavoie_Am%C3%A9lie_AKA479ADEADC6F3D68AAKA.pdf' }] },
  { monday_item_id: 18269588168, nom: 'Sevigny Catherine', email: 'catherine5sevigny@gmail.com', files: [{ name: 'Certificat_Sevigny_Catherine.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2541775600/Certificat_S%C3%A9vigny_Catherine_AKA7A5CE070E8F5E46EAKA.pdf' }] },
  { monday_item_id: 18269588186, nom: 'Caron Andre', email: 'andrecaron1959@gmail.com', files: [{ name: 'Certificat_Caron_Andre.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2510362329/Certificat_Caron_Andr%C3%A9_AKA2F313F631F95AD39AKA-1.pdf' }] },
  { monday_item_id: 18269588193, nom: 'Viau-Souligny Christian', email: 'ssiprevention@hotmail.com', files: [{ name: 'Certificats.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2531199275/Certificats.pdf' }] },
  { monday_item_id: 18269588200, nom: 'Boileau William', email: 'william.boileau@gmail.com', files: [{ name: 'Initiation_securiteCivile_Certificat.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2515511126/Initiation_securiteCivile_Certificat.pdf' }] },
  { monday_item_id: 18269588203, nom: 'Fillion Michel', email: 'michel.fillion@videotron.ca', files: [{ name: 'Certificat_Fillion_Michel.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2525953287/Certificat_Fillion_Michel_AKA49CC22485792EF0EAKA.pdf' }] },
  { monday_item_id: 18269588210, nom: 'De Beaumont Jean-Pierre', email: 'jeanpierre_de_beaumont@hotmail.com', files: [{ name: 'Certificat_De_Beaumont.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2514016341/Certificat_De%20Beaumont_Jean-Pierre_AKAF8681BAF6AA65F8EAKA.pdf' }] },
  { monday_item_id: 18269588220, nom: 'Weber-Houde Louis', email: 'louis.weber-houde@tc.gc.ca', files: [{ name: 'Certificat_Weber_Louis.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2527876379/Certificat_Weber_Louis_AKA69C0C521F6CFAE34AKA.pdf' }] },
  { monday_item_id: 18269588221, nom: 'Roy Simon', email: 'simonroy1981@outlook.com', files: [{ name: 'Certificat_Roy_Simon.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2526137095/Certificat_Roy_Simon_AKA1E165782B01B8B2EAKA.pdf' }] },
  { monday_item_id: 18269588226, nom: 'Robert Michel', email: 'robertmichel@videotron.ca', files: [{ name: 'Introduction securite civile.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2605308895/M.U._%20Introduction%20%C3%A0%20la%20s%C3%A9curit%C3%A9%20civile.pdf' }] },
  { monday_item_id: 18269588231, nom: 'Walters Andre', email: 'waltersnoel73@gmail.com', files: [{ name: 'Certificat_Walters_Andre.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2583873670/Certificat_Walters_Andr%C3%A9_AKA455BBF0299109A6FAKA.pdf' }] },
  { monday_item_id: 18269588230, nom: 'Verdi Claire', email: 'verdi.claire@gmail.com', files: [{ name: 'Certificat_Verdi_Claire.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2558168721/Certificat_Verdi_Claire_AKA65029B9C06A09C66AKA.pdf' }] },
  { monday_item_id: 18269588234, nom: 'Dutil Louis-Benoit', email: 'louis.benoit.dutil@gmail.com', files: [{ name: 'certificat_Dutil_Louis_Benoit.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2510710765/certificat_Dutil_Louis%20Benoit_AKA645BFD93BF4DF7DCAKA%20(1).pdf' }] },
  { monday_item_id: 18269588236, nom: 'Kruse William', email: 'william.kruse@longueuil.quebec', files: [{ name: 'Certificat_Kruse_William.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2558164616/Certificat_Kruse_William_AKADAF8C1971724EE0CAKA.pdf' }] },
  { monday_item_id: 18269588239, nom: 'Boulanger Michele', email: 'micheleboulanger@yahoo.com', files: [{ name: 'Certificat_Boulanger_Michele.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2550222791/Certificat_Boulanger_Miche%CC%80le_AKA8B55D18433CD438AAKA%20copie.pdf' }] },
  { monday_item_id: 18269588256, nom: 'Jacques Jean-Robert', email: 'pleinair35@gmail.com', files: [{ name: 'Certificat_Jacques_Jean-Robert.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2510787239/Certificat_Jacques_Jean-Robert_AKA3A42C85EA9C4E40FAKA.pdf' }] },
  { monday_item_id: 18269588258, nom: 'Lapierre Annie', email: 'a8.lapierre@gmail.com', files: [{ name: 'Certificat_Lapierre_Annie.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2553921987/Certificat_Lapierre_Annie_AKA1845CE19183E1864AKA.pdf' }] },
  { monday_item_id: 18269588283, nom: 'Rivard Isabelle', email: 'i.rivard77@hotmail.com', files: [{ name: 'Certificat_Rivard_Isabelle.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2561045999/Certificat_Rivard_Isabelle_AKAED6D49DCD27DFA10AKA.pdf' }] },
  { monday_item_id: 18269588290, nom: 'Cadrin Stephane', email: 'stephcadrin@gmail.com', files: [{ name: 'Certificat_Cadrin_Stephane.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2510414740/Certificat_Cadrin_Stephane_AKAF6C3D3E6F51A3E75AKA.pdf' }] },
  { monday_item_id: 18269588297, nom: 'R. Bouchard Eric', email: 'Heyrique@live.ca', files: [{ name: 'Certificat_Bouchard_Eric.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2526765723/Certificat_Bouchard_Eric%20R_AKAF7C011982B97E1E7AKA%20(1).pdf' }] },
  { monday_item_id: 18269588300, nom: 'Huard Daniel', email: 'gaspeabi@gmail.com', files: [{ name: 'Certificat_Huard_Daniel.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2583912537/Certificat_Huard_Daniel_AKA8DE6264F77724B1AAKA%20(1).pdf' }] },
  { monday_item_id: 18269588301, nom: 'Campeau Stephane', email: 's.campeau@villelapeche.qc.ca', files: [{ name: 'Certificat_Campeau_Stephane.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2527311118/Certificat_Campeau_St%C3%A9phane_AKA965844F195D369BDAKA%20(1).pdf' }] },
  { monday_item_id: 18269588308, nom: 'Comeau Stephane', email: 'scomeau13@gmail.com', files: [{ name: 'Certificat_Comeau_Stephane.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2510983660/Certificat_Comeau_St%C3%A9phane_AKA415DB0875B4F05A1AKA.pdf' }] },
  { monday_item_id: 18269588348, nom: 'Gascom Florent', email: 'Florent.gascon@hotmail.com', files: [{ name: 'Certificat_Gascon_Florent.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2547106581/Certificat_Gascon_Florent_AKA335A68AACB7BF512AKA.pdf' }] },
  { monday_item_id: 18269588359, nom: 'Drapeau Steve', email: 'info@djskip.ca', files: [{ name: 'S-initier securite civile.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2545489777/S%27initier%20%C3%A0%20la%20s%C3%A9curit%C3%A9%20civile%20(MSP)%20(2015).pdf' }, { name: 'ICS 100.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2545489772/ICS%20100%20(2016).pdf' }, { name: 'Certificat Radioamateur.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2545489781/Certificat%20Radioamateur%20(2015).pdf' }] },
  { monday_item_id: 18269588375, nom: 'Ralph Steve', email: 'Srafaelli01@gmail.com', files: [{ name: 'Certificat_Ralph_Steve.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2513614350/Certificat_Ralph_Steve_AKABD395EF3C8CABEBBAKA.pdf' }] },
  { monday_item_id: 18269588385, nom: 'Halle Francois', email: 'francoishalle@sympatico.ca', files: [{ name: 'Certificat_Halle_Francois.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2510810453/Certificat_Hall%C3%A9_Francois_AKAF061B896166FD243AKA.pdf' }] },
  { monday_item_id: 18269786170, nom: 'Turcotte Serge', email: 'serge_turcotte@hotmail.com', files: [{ name: 'Certificat_Turcotte_Serge.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2584503538/Certificat_Turcotte_Serge_AKAADC3B741E5A53F18AKA.pdf' }] },
  { monday_item_id: 18270674226, nom: 'Danis Derek', email: 'derek.danis@gmail.com', files: [{ name: 'Certificat_Danis_Derek.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2510520295/Certificat_Danis_Derek_AKAD55D0C5D4BB1FF5CAKA.pdf' }] },
  { monday_item_id: 18272825780, nom: 'Taillon Mario', email: 'sauvetageplage@gmail.com', files: [{ name: 'certificat_MSP.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2510937622/certificat_MSP.pdf' }] },
  { monday_item_id: 18273253126, nom: 'Cloutier Jean-Francois', email: '1jeanfrancoiscloutier1@gmail.com', files: [{ name: 'Certificat_Cloutier_Jean-Francois.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2547990985/Certificat_Cloutier_Jean-Fran%C3%A7ois_AKAE89A42155E1E3F17AKA.pdf' }] },
  { monday_item_id: 18282880169, nom: 'Jacques Stephane', email: 'Stja1966@hotmail.com', files: [{ name: 'Certificat_Jacques_Stephane.jpg', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2526005807/Certificat_Jacques_St%C3%A9phane_AKA28D3B54DC0F4D43BAKA_251101_114227.jpg' }] },
  { monday_item_id: 18282993163, nom: 'Belanger Samuel', email: 'sam6_81@hotmail.com', files: [{ name: 'Certificat_Belanger_Samuel.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2513717658/Certificat_B%C3%A9langer_Samuel_AKA3C15E0E93727AD5BAKA.pdf' }] },
  { monday_item_id: 18289135215, nom: 'Lebreux Thomas', email: 'thomas.lebreux@hotmail.com', files: [{ name: 'Certificat_Lebreux_Thomas.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2515411888/Certificat_Lebreux_Thomas_AKAAE29A718EB188D37AKA.pdf' }] },
  { monday_item_id: 18296665275, nom: 'Sylvain Andreanne', email: 'asylvain321@gmail.com', files: [{ name: 'IMG_7693.jpeg', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2517637622/IMG_7693.jpeg' }] },
  { monday_item_id: 18305001206, nom: 'Robichaud Alex', email: 'alexrobichaud07@outlook.com', files: [{ name: 'Certificat_Robichaud_SécuritéCivil.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2550065409/Certificat_Robichaud_S%C3%A9curit%C3%A9Civil.pdf' }] },
  { monday_item_id: 18346924172, nom: 'Alec Blondin Stewart', email: 'alec.blondin.stewart@gmail.com', files: [{ name: 'Certificat_Blondin_Stewart_Alec.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2532282088/Certificat_Blondin%20Stewart_Alec_AKA1E63D5EB779AFA9CAKA.pdf' }] },
  { monday_item_id: 18359568010, nom: 'Appleby Dany', email: 'danyappleby@hotmail.com', files: [{ name: '44.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2535935390/44.pdf' }] },
  { monday_item_id: 18166372848, nom: 'Bergeron Valerie', email: 'valerie.bergeron@hotmail.com', files: [{ name: 'Certificat_Bergeron_Valerie.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2569688347/Certificat_Bergeron_Vale%CC%81rie_AKA47B467BB08EAC4E7AKA.pdf' }] },
  { monday_item_id: 18182368856, nom: 'Bellemare Eric', email: 'eric.bellemare001@gmail.com', files: [{ name: 'Certificat_Bellemare_Eric.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2512993670/Certificat_Bellemare_Eric_AKAE1061EB1AED635EEAKA.pdf' }] },
  { monday_item_id: 18297682762, nom: 'Quintyn Jerome', email: 'jerome.quintyn@hotmail.com', files: [{ name: 'certificat_MSP.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2518014275/certificat_MSP.pdf' }] },
  { monday_item_id: 10555019352, nom: 'Lajoie Rosaire', email: 'lajoie.rosaire@videotron.ca', files: [{ name: 'Certificat_Lajoie_Rosaire.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2575673362/Certificat_Lajoie_Rosaire_AKA39EA974102A1C0CFAKA.pdf' }] },
  { monday_item_id: 10619546036, nom: 'Michaud Harold', email: 'michaudharold@hotmail.com', files: [{ name: 'IMG_7408.jpeg', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2573216520/IMG_7408.jpeg' }] },
  { monday_item_id: 10621543147, nom: 'Lang Emanuel', email: 'ejskdfx@gmail.com', files: [{ name: 'Certificat_Lang_Emanuel.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2573607911/Certificat_Lang_Emanuel_AKA33A17834366375F8AKA.pdf' }] },
  { monday_item_id: 10625881637, nom: 'Allard Jean-Phillipe', email: 'jp.allard@ambulancecam.com', files: [{ name: 'certificat_MSP_JP_Allard.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2575013343/certificat_MSP%20JP%20Allard.pdf' }] },
  { monday_item_id: 10683282674, nom: 'dupuis christian', email: 'les4dupuis@telus.net', files: [{ name: 'Certificat_Dupuis_Christian.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2592010970/Certificat_Dupuis_Christian_s%C3%A9curit%C3%A9%20civile.pdf' }] },
  { monday_item_id: 10683280752, nom: 'Chouinard Robyn', email: 'quebecrobyn@gmail.com', files: [{ name: 'certificat_MSP.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2681971609/certificat_MSP.pdf' }] },
  { monday_item_id: 10731619235, nom: 'Girard Isabelle', email: 'izabellejrard@gmail.com', files: [{ name: 'Certificat_Girard_Isabelle.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2606829802/Certificat_Girard_Isabelle_AKAD628FB281C06565BAKA.pdf' }] },
  { monday_item_id: 10824374606, nom: 'Lamontagne Victor', email: 'vic.lamontagne@gmail.com', files: [{ name: 'certificat_MSP_VictorLamontagne.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2699467160/certificat_MSP_VictorLamontagne.pdf' }] },
  { monday_item_id: 10867808176, nom: 'Mekentichi Djamil', email: 'Djamil.Mekentichi@uqar.ca', files: [{ name: 'S-initier securite civile.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2645247361/S%27initier%20%C3%A0%20la%20s%C3%A9curit%C3%A9%20civile.pdf' }] },
  { monday_item_id: 10878226263, nom: 'Labrecque Josiane', email: 'josiane.labrecque@msp.gouv.qc.ca', files: [{ name: 'Certificat_Labrecque_Josiane.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2700701580/Certificat_Labrecque_Josiane_AKA94BE21A9361AA7C1AKA.pdf' }, { name: 'certificat_Axc-EvaQ.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2714454700/certificat_Axc-%C3%89vaQ.pdf' }] },
  { monday_item_id: 10959274876, nom: 'Coursault Valerie', email: 'valcourso@gmail.com', files: [{ name: 'Certificat_Coursault_Valerie.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2670850636/Certificat_Coursault_Val%C3%A9rie_AKA24EC7200D93E497EAKA-3.pdf' }] },
  { monday_item_id: 10961371682, nom: 'Simard Alexandre', email: 'alexandre.andre.simard@gmail.com', files: [{ name: 'Alex_Simard_wall1.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2671461911/Alex_Simard_106687505_wall.pdf' }] },
  { monday_item_id: 10988108771, nom: 'Grenier Katryn', email: 'katryngrenier@hotmail.fr', files: [{ name: 'Certificat_Grenier_Katryn.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2736532449/Certificat_Grenier_Katryn_AKA5149E4A10FE12E39AKA.pdf' }] },
  { monday_item_id: 11007068948, nom: 'Frechette Maxime', email: 'frechette.maxime@gmail.com', files: [{ name: 'Certificat_Frechette_Maxime.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2683785765/Certificat_Fr%C3%A9chette_Maxime_AKAD7381CA4A0F4A4A4AKA.pdf' }] },
  { monday_item_id: 11032843996, nom: 'Francoeur Eric', email: 'efanco71@gmail.com', files: [{ name: 'Certificat_Francoeur_Eric.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2694163425/Certificat_Francoeur_Eric_AKAF45B399E3322A7F9AKA.pdf' }] },
  { monday_item_id: 11033155009, nom: 'Brochu Karl', email: 'broka@hotmail.ca', files: [{ name: 'Certificat_Brochu_Karl.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2690965381/Certificat_Brochu_Karl_AKA5E206613BDC1E2EFAKA.pdf' }] },
  { monday_item_id: 11080476857, nom: 'Lajoie Bernard', email: 'blajoie7704@gmail.com', files: [{ name: 'Certificat_Lajoie_Bernard.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2707959403/Certificat_Lajoie_Bernard_AKA6D30B0BBF174F77EAKA.pdf' }] },
  { monday_item_id: 11080659897, nom: 'Giguere Nathalie', email: 'n.giguere@laval.ca', files: [{ name: '2026 SC.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2705617612/2026%20SC.pdf' }] },
  { monday_item_id: 11088778781, nom: 'Lussier Claude', email: 'artemundo1@telus.net', files: [{ name: 'certificat_MSP.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2724482505/certificat_MSP.pdf' }] },
  { monday_item_id: 11090563187, nom: 'Stamand Francis', email: 'fsta1@live.ca', files: [{ name: 'image0.png', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2823149125/image0.png' }] },
  { monday_item_id: 11116326155, nom: 'Dube Joel', email: 'joeldube@me.com', files: [{ name: 'certificat_Dube_Joel.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2714446591/certificat_Dube%CC%81_Joe%CC%88l_AKAC74E9E6A089494C1AKA.pdf' }] },
  { monday_item_id: 11127324283, nom: 'Charette Jeanne', email: 'jeanne.charette02@gmail.com', files: [{ name: 'Certificat_Charette_Jeanne.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2729175363/Certificat_Charette_Jeanne_AKAD22172DEF11911C1AKA.pdf' }] },
  { monday_item_id: 11128417754, nom: 'Goyer Jean-Pierre', email: 'jean.pierre.goyer@ssss.gouv.qc.ca', files: [{ name: 'Certificat_Goyer_Jean-Pierre.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2736500715/Certificat_Goyer_Jean-Pierre_AKA9B6AD457CCCEF0FEAKA.pdf' }] },
  { monday_item_id: 11137829985, nom: 'Lavoie Raymond', email: 'lavoie_raymond@hotmail.com', files: [{ name: 'Certificat_Lavoie_Raymond.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2725968578/Certificat_Lavoie_Raymond_AKAE3F67F2BB9559F0BAKA.pdf' }] },
  { monday_item_id: 11153881858, nom: 'POUFFA MBOUWE Kemene', email: 'kemenembouwe@gmail.com', files: [{ name: 'Certificat_POUFFA_MBOUWE_KEMENE.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2740215030/Certificat_POUFFA%20MBOUWE_KEMENE_AKA3F8F1C79A1DA359AAKA.pdf' }] },
  { monday_item_id: 11203145204, nom: 'Kimball Anessa', email: 'anessa.kimball@gmail.com', files: [{ name: 'Certificat_Kimball_Anessa.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2764192294/Certificat_Kimball_Anessa_AKABF1EAC52E85F642CAKA.pdf' }] },
  { monday_item_id: 11238692626, nom: 'Boivin-Chabot Sara', email: 'saraboivin@gmail.com', files: [{ name: 'Certificat_Boivin-Chabot_Sara.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2793131837/Certificat_Boivin-Chabot_Sara_AKA7DC5CEAFFDE0A91CAKA.pdf' }] },
  { monday_item_id: 11241821266, nom: 'Gosselin Jean', email: 'gosselinjean4@gmail.com', files: [{ name: 'Certificat_Gosselin_Jean.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2750243997/Certificat_Gosselin_Jean_AKA08C61A82826C3F55AKA.pdf' }] },
  { monday_item_id: 11311804224, nom: 'Laurendeau Pierre-Gabriel', email: 'pierregabriel@telus.net', files: [{ name: 'Certificat_Laurendeau_Pierre-Gabriel.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2769960495/Certificat_Laurendeau_Pierre-Gabriel_AKA1C9FECF71A557758AKA.pdf' }] },
  { monday_item_id: 11319317402, nom: 'Belanger Steven', email: 'stebel1961@gmail.com', files: [{ name: 'Certificat_Belanger_Steven.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2782587147/Certificat_Belanger_Steven_AKA2676C0C370303E7CAKA.pdf' }] },
  { monday_item_id: 11328423727, nom: "L'Heureux Voyer Marc-Antoine", email: 'marcus4337@icloud.com', files: [{ name: "Certificat_L-Heureux_Voyer_Marc-Antoine.pdf", url: "https://aqbrs.monday.com/protected_static/27459850/resources/2776889709/Certificat_L'Heureux%20Voyer_Marc-Antoine_AKA0E3800E067679B0DAKA.pdf" }] },
  { monday_item_id: 11329395091, nom: 'Savard Yanick', email: 'yanicksavard9@gmail.com', files: [{ name: 'Certificat_Savard_Yanick.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2786609104/Certificat_Savard_Yanick_AKA7917BE2A8854163DAKA.pdf' }] },
  { monday_item_id: 11334227428, nom: 'Lamarre-Tellier Alexandre', email: 'alexx.lamatell@gmail.com', files: [{ name: 'Initiation a la securite civile.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2776581345/Initiation%20a%20la%20s%C3%A9curit%C3%A9%20civile.pdf' }] },
  { monday_item_id: 11337089467, nom: 'arsenault tommy', email: 'tommy.lego@hotmail.com', files: [{ name: 'Certificat_Arsenault_Tommy.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2777314369/Certificat_Arsenault_Tommy_AKA04587D8BA1ABE155AKA.pdf' }] },
  { monday_item_id: 11348447285, nom: 'Serafino Philippe', email: 'philippeserafinophotos@videotron.ca', files: [{ name: 'certificat_MSP.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2780425514/certificat_MSP.pdf' }] },
  { monday_item_id: 11348653635, nom: 'Rivard Michael', email: 'michael.rivard05@gmail.com', files: [{ name: 'Certificat_Rivard_Michael.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2780463337/Certificat_Rivard_Micha%C3%ABl_AKA1F77DEA69C0249A0AKA.pdf' }] },
  { monday_item_id: 11348814548, nom: 'NDIAYE Mamadou Lanki', email: 'mamadoulankindiaye@gmail.com', files: [{ name: 'Certificat_NDIAYE_Mamadou_Lanki.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2800266475/Certificat_NDIAYE_Mamadou%20Lanki_AKAFDBF9A8768672B66AKA.pdf' }] },
  { monday_item_id: 11352891323, nom: 'Turcotte David', email: 'david.turcotte@outlook.com', files: [{ name: 'Certificat_Turcotte_David.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2784740706/Certificat_Turcotte_David_AKA3700F907FE0859CBAKA.pdf' }] },
  { monday_item_id: 11354167274, nom: 'Aupin Alexandre', email: 'a_aupin@hotmail.com', files: [{ name: 'Screenshot_Adobe_Acrobat.jpg', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2792630725/Screenshot_20260227_193935_Adobe%20Acrobat.jpg' }] },
  { monday_item_id: 11354507556, nom: 'Ethier Marie Eve', email: 'marieeve.ethier@hotmail.com', files: [{ name: 'Certificat - Securite Civile.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2822028404/Certificat%20-%20S%C3%A9curit%C3%A9%20Civile.pdf' }] },
  { monday_item_id: 11361490049, nom: 'Daneau Danielle', email: 'guiness93@hotmail.com', files: [{ name: 'Certificat de formation.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2828930286/Certificat%20de%20formation%20(1).pdf' }] },
  { monday_item_id: 11365798389, nom: 'Bechard Liette', email: 'liette.bechard@gmail.com', files: [{ name: 'Certificat formation RIUSC.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2799920203/Certificat%20formation%20RIUSC%20260225.pdf' }] },
  { monday_item_id: 11368019155, nom: 'Cauchon Caroline', email: 'carolinecauchon160@gmail.com', files: [{ name: 'Certificat_Cauchon_Caroline.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2799381188/Certificat_Cauchon_Caroline_AKA685B989D374FBDD2AKA%202.pdf' }] },
  { monday_item_id: 11368202148, nom: 'Dion Maxime', email: 'maximedion01@gmail.com', files: [{ name: 'Certificat_Dion_Maxime.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2786499117/Certificat_Dion_Maxime_AKAA5BB1F1F157C4879AKA.pdf' }] },
  { monday_item_id: 11369151914, nom: 'Verdier Mathilde', email: 'missfire23@hotmail.fr', files: [{ name: 'Certificat_Verdier_Mathilde.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2789424279/Certificat_Verdier_Mathilde_AKA474460B8658D7262AKA.pdf' }] },
  { monday_item_id: 11377840308, nom: 'Lecours Line', email: 'mamaninde@yahoo.ca', files: [{ name: 'Certificat_Lecours_Line.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2817984586/Certificat_Lecours_Line_AKA0A032A87FE3B5A68AKA.pdf' }] },
  { monday_item_id: 11391716724, nom: 'Giroux Sylvie', email: 'syv_001@hotmail.com', files: [{ name: 'IMG_4789.jpeg', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2792833052/IMG_4789.jpeg' }] },
  { monday_item_id: 11395075676, nom: 'Beaule Jean-Francois', email: 'beaule.jeff@gmail.com', files: [{ name: 'Certificat_Beaule_Jean-Francois.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2793634513/Certificat_Beaul%C3%A9_Jean-Fran%C3%A7ois.pdf' }] },
  { monday_item_id: 11408371406, nom: 'Desroches Natacha', email: 'riv_sud@hotmail.com', files: [{ name: 'Certificat_Desroches_Natacha.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2797363453/Certificat_Desroches_Natacha_AKADEB90583EE513349AKA.pdf' }] },
  { monday_item_id: 11450310562, nom: 'Beaudette Frederic', email: 'f.beaudette@hotmail.com', files: [{ name: 'Certificat Initiation securite civil.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2818964517/Certificat%20Initiation%20se%CC%81curite%CC%81%20civil.pdf' }] },
  { monday_item_id: 11467400624, nom: 'Henley Francis', email: 'francis.henley@gmail.com', files: [{ name: 'Certificat de formation.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2823042266/Certificat%20de%20formation.pdf' }] },
  { monday_item_id: 11476912036, nom: 'Winninger Victor', email: 'victor.winninger@gmail.com', files: [{ name: 'Certificat de formation.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2821309769/Certificat%20de%20formation.pdf' }] },
  { monday_item_id: 11480698428, nom: 'Dallaire Francois', email: 'frand999@hotmail.com', files: [{ name: 'certificat_Dallaire_Francois.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2820155144/certificat_Dallaire_Francois_AKA358D11B25D9591F8AKA.pdf' }] },
  { monday_item_id: 18374572090, nom: 'Bisson Francois', email: 'fbisson7@gmail.com', files: [{ name: 'Certificat_Bisson_Francois.pdf', url: 'https://aqbrs.monday.com/protected_static/27459850/resources/2547179357/Certificat_Bisson_Fran%C3%A7ois_AKA200CF334AEFA97E9AKA.pdf' }] },
]

export default function AdminCertificatsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [certificats, setCertificats] = useState<CertificatEnAttente[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterNom, setFilterNom] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'portail' | 'monday' | 'a_completer'>('portail')
  const [certifsACompleter, setCertifsACompleter] = useState<CertificatACompleter[]>([])
  const [filterACompleter, setFilterACompleter] = useState('')
  const [mondayItems, setMondayItems] = useState<MondayItem[]>([])
  const [mondaySelectedId, setMondaySelectedId] = useState<number | null>(null)
  const [mondayViewFileIdx, setMondayViewFileIdx] = useState(0)
  const [mondayFilter, setMondayFilter] = useState('')
  const [adminBenevoleId, setAdminBenevoleId] = useState<string>('')
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number; active: boolean }>({ done: 0, total: 0, active: false })
  const [composeDestinataire, setComposeDestinataire] = useState<{ benevole_id: string; email: string; prenom: string; nom: string } | null>(null)

  const downloadFirst50 = async () => {
    const toDownload = mondayItems.filter(i => i.mState.status === 'idle' && !i.downloadedFiles).slice(0, 50)
    if (!toDownload.length) return
    setDownloadProgress({ done: 0, total: toDownload.length, active: true })
    let done = 0
    for (const item of toDownload) {
      const downloaded: DownloadedFile[] = []
      for (let idx = 0; idx < item.files.length; idx++) {
        const f = item.files[idx]
        try {
          const proxyUrl = `/api/monday-proxy?url=${encodeURIComponent(f.url)}`
          const res = await fetch(proxyUrl)
          if (!res.ok) continue
          const contentType = res.headers.get('content-type') || ''
          // Rejeter si le proxy retourne du HTML (page d'erreur Monday ou redirect)
          if (contentType.includes('text/html')) continue
          const blob = await res.blob()
          // Forcer le bon type selon l'extension si le blob type est générique
          const ext = f.name.split('.').pop()?.toLowerCase() || 'pdf'
          const mimeMap: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }
          const resolvedType = (blob.type && !blob.type.includes('octet-stream')) ? blob.type : (mimeMap[ext] || 'application/pdf')
          const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)
          const storagePath = `monday_temp/${item.monday_item_id}_${idx}_${safeName}`
          const file = new File([blob], safeName, { type: resolvedType })
          const { error: upErr } = await supabase.storage.from('certificats').upload(storagePath, file, { upsert: true, contentType: resolvedType })
          if (upErr) continue
          const { data: signed } = await supabase.storage.from('certificats').createSignedUrl(storagePath, 3600 * 24)
          if (!signed?.signedUrl) continue
          downloaded.push({ storagePath, signedUrl: signed.signedUrl, name: f.name, file })
        } catch {}
      }
      if (downloaded.length > 0) {
        setMondayItems(prev => prev.map(i => {
          if (i.monday_item_id !== item.monday_item_id) return i
          const autoSelect = downloaded.length === 1 ? {
            uploadedFile: downloaded[0].file,
            selectedStoragePath: downloaded[0].storagePath,
            selectedSignedUrl: downloaded[0].signedUrl,
          } : {}
          return { ...i, downloadedFiles: downloaded, mState: { ...i.mState, ...autoSelect } }
        }))
      }
      done++
      setDownloadProgress(p => ({ ...p, done }))
    }
    setDownloadProgress(p => ({ ...p, active: false }))
  }

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: reserviste } = await supabase.from('reservistes').select('benevole_id, role').eq('user_id', user.id).single()
      if (!reserviste || reserviste.role !== 'admin') { router.push('/'); return }
      setAdminBenevoleId(reserviste.benevole_id)

      // ═══ PHASE 1 : 3 requêtes indépendantes en parallèle ═══
      const mondayIds = MONDAY_RAW.map(i => i.monday_item_id)
      const [mondayResult, portailResult, aCompleterResult] = await Promise.allSettled([
        // Monday: quels items sont déjà traités?
        supabase.from('formations_benevoles').select('monday_item_id').in('monday_item_id', mondayIds),
        // Portail: certificats en attente d'approbation (avec fichier)
        supabase.from('formations_benevoles')
          .select('id, benevole_id, nom_complet, nom_formation, certificat_url')
          .eq('resultat', 'En attente')
          .not('certificat_url', 'is', null)
          .is('date_reussite', null)
          .is('monday_item_id', null)
          .order('nom_complet'),
        // À compléter: certificats déclarés sans fichier
        supabase.from('formations_benevoles')
          .select('id, benevole_id, nom_complet, nom_formation')
          .eq('resultat', 'En attente')
          .is('certificat_url', null)
          .is('date_reussite', null)
          .is('monday_item_id', null)
          .order('nom_complet'),
      ])

      const existingMonday = mondayResult.status === 'fulfilled' ? mondayResult.value?.data || [] : []
      const portailData = portailResult.status === 'fulfilled' ? portailResult.value?.data || [] : []
      const aCompleterData = aCompleterResult.status === 'fulfilled' ? aCompleterResult.value?.data || [] : []

      // ═══ PHASE 2 : Monday — résoudre emails + formations existantes en parallèle ═══
      const alreadyDone = new Set(existingMonday.map((r: any) => r.monday_item_id))
      const remaining = MONDAY_RAW.filter(item => !alreadyDone.has(item.monday_item_id))
      const emails = remaining.map(i => i.email.toLowerCase())

      // Collecter tous les benevole_ids nécessaires pour portail + à compléter
      const allPortailBIds = [...new Set(portailData.map((d: any) => d.benevole_id))]
      const allACompleterBIds = [...new Set(aCompleterData.map((c: any) => c.benevole_id))]
      const allBIdsNeeded = [...new Set([...allPortailBIds, ...allACompleterBIds])]

      const [emailsResult, reservistesInfoResult] = await Promise.allSettled([
        // Résoudre emails Monday → benevole_id
        emails.length > 0
          ? supabase.from('reservistes').select('benevole_id, email').in('email', emails)
          : Promise.resolve({ data: [] }),
        // Noms + emails pour portail ET à compléter (une seule requête bulk)
        allBIdsNeeded.length > 0
          ? supabase.from('reservistes').select('benevole_id, email, prenom, nom').in('benevole_id', allBIdsNeeded)
          : Promise.resolve({ data: [] }),
      ])

      const reservistesFound = emailsResult.status === 'fulfilled' ? (emailsResult.value as any)?.data || [] : []
      const emailToBenevoleId = new Map(reservistesFound.map((r: any) => [r.email.toLowerCase(), r.benevole_id]))

      // Map globale benevole_id → info (réutilisée pour portail + à compléter)
      const reservistesInfo = reservistesInfoResult.status === 'fulfilled' ? (reservistesInfoResult.value as any)?.data || [] : []
      const infoMap = new Map<string, { email: string; prenom: string; nom: string }>()
      for (const r of reservistesInfo) infoMap.set(r.benevole_id, { email: r.email || '', prenom: r.prenom || '', nom: r.nom || '' })

      // ═══ PHASE 3 : Formations existantes pour déduplication (Monday + Portail) en parallèle ═══
      const mondayBenevoleIds = [...new Set([...emailToBenevoleId.values()])]
      const allDeduplicationBIds = [...new Set([...mondayBenevoleIds, ...allPortailBIds])]

      const { data: allExistingFormations } = allDeduplicationBIds.length > 0
        ? await supabase.from('formations_benevoles').select('benevole_id, nom_formation, resultat').in('benevole_id', allDeduplicationBIds)
        : { data: [] }

      // Map benevole_id → set de toutes les formations
      const formationsByBenevole = new Map<string, Set<string>>()
      const approuveesByBenevole = new Map<string, Set<string>>()
      for (const f of allExistingFormations || []) {
        if (!formationsByBenevole.has(f.benevole_id)) formationsByBenevole.set(f.benevole_id, new Set())
        formationsByBenevole.get(f.benevole_id)!.add(f.nom_formation.toLowerCase().trim())
        if (f.resultat === 'Réussi') {
          if (!approuveesByBenevole.has(f.benevole_id)) approuveesByBenevole.set(f.benevole_id, new Set())
          approuveesByBenevole.get(f.benevole_id)!.add(f.nom_formation.toLowerCase().trim())
        }
      }

      // ═══ Monday : filtrer et afficher ═══
      const finalItems = remaining.filter(item => {
        const benevoleId = emailToBenevoleId.get(item.email.toLowerCase())
        if (!benevoleId) return true
        const detectedFormation = detectFormation(item.files)
        const existing = formationsByBenevole.get(benevoleId)
        if (!existing) return true
        return ![...existing].some(f => formationsMatch(f, detectedFormation))
      })

      setMondayItems(
        finalItems.map(item => ({ ...item, mState: { status: 'idle', formation: detectFormation(item.files), dateObtention: '', dateExpiration: '' } }))
      )

      // ═══ Portail : enrichir avec noms + signed URLs (batch, pas N+1) ═══
      if (portailData.length > 0) {
        const dataFiltered = portailData.filter((item: any) => {
          const existing = approuveesByBenevole.get(item.benevole_id)
          if (!existing) return true
          return ![...existing].some(f => formationsMatch(f, item.nom_formation))
        })

        // Générer les signed URLs en batch (max 5 en parallèle pour éviter rate limit)
        const storagePaths = dataFiltered
          .filter((item: any) => item.certificat_url?.startsWith('storage:'))
          .map((item: any) => ({ id: item.id, path: item.certificat_url.replace('storage:', '') }))

        const signedUrlMap = new Map<string, string>()
        // Batch de 10 signed URLs à la fois
        for (let i = 0; i < storagePaths.length; i += 10) {
          const batch = storagePaths.slice(i, i + 10)
          const results = await Promise.allSettled(
            batch.map(({ path }) => supabase.storage.from('certificats').createSignedUrl(path, 3600))
          )
          results.forEach((res, idx) => {
            if (res.status === 'fulfilled' && res.value?.data?.signedUrl) {
              signedUrlMap.set(batch[idx].id, res.value.data.signedUrl)
            }
          })
        }

        const enriched: CertificatEnAttente[] = dataFiltered.map((item: any) => {
          const info = infoMap.get(item.benevole_id)
          const nomComplet = item.nom_complet || (info ? `${info.prenom} ${info.nom}`.trim() : '') || 'Inconnu'
          return {
            ...item,
            nom_complet: nomComplet,
            email: info?.email || '',
            signedUrl: signedUrlMap.get(item.id) || '',
            dateInput: '',
            dateExpiration: '',
            statut: 'idle' as const,
          }
        })
        setCertificats(enriched)
      }

      // ═══ À compléter : enrichir avec noms (déjà chargés dans infoMap) ═══
      if (aCompleterData.length > 0) {
        setCertifsACompleter(aCompleterData.map((c: any) => ({
          ...c,
          nom_complet: c.nom_complet || (infoMap.get(c.benevole_id) ? `${infoMap.get(c.benevole_id)!.prenom} ${infoMap.get(c.benevole_id)!.nom}`.trim() : '') || 'Inconnu',
          email: infoMap.get(c.benevole_id)?.email || '',
        })))
      }

      setLoading(false)
    }
    loadData()
  }, [])

  const handleDateChange = (id: string, value: string) => setCertificats(prev => prev.map(c => c.id === id ? { ...c, dateInput: value } : c))
  const handleDateExpirationChange = (id: string, value: string) => setCertificats(prev => prev.map(c => c.id === id ? { ...c, dateExpiration: value } : c))
  const handleApprouver = async (id: string) => {
    const cert = certificats.find(c => c.id === id)
    if (!cert?.dateInput) return
    setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'saving' } : c))
    try {
      const res = await fetch('/api/admin/approuver-formation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          date_reussite: cert.dateInput,
          date_expiration: cert.dateExpiration || null,
          admin_benevole_id: adminBenevoleId,
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'saved' } : c))
      setSavedCount(n => n + 1)
      window.dispatchEvent(new CustomEvent('certificats-badge-update', { detail: { delta: -1 } }))
    } catch {
      setCertificats(prev => prev.map(c => c.id === id ? { ...c, statut: 'error' } : c))
    }
  }

  const updMonday = (id: number, field: keyof MondayItem['mState'], val: string) =>
    setMondayItems(prev => prev.map(i => i.monday_item_id === id ? { ...i, mState: { ...i.mState, [field]: val } } : i))
  const handleApprouverMonday = async (item: MondayItem) => {
    if (!item.mState.dateObtention) return
    setMondayItems(prev => prev.map(i => i.monday_item_id === item.monday_item_id
      ? { ...i, mState: { ...i.mState, status: 'saving' } } : i))
    try {
      // 1. Trouver le benevole_id par email
      const { data: res } = await supabase.from('reservistes').select('benevole_id').ilike('email', item.email).single()
      if (!res?.benevole_id) throw new Error(`Réserviste introuvable pour ${item.email}`)
      const benevoleId = res.benevole_id

      let certificatUrl = item.files[0]?.url || ''

      // 2. Utiliser le fichier déjà téléchargé (pre-downloaded) OU upload manuel
      if (item.mState.selectedStoragePath) {
        // Déjà dans Storage via downloadFirst50 — déplacer vers dossier final
        const src = item.mState.selectedStoragePath
        const ext = src.split('.').pop()?.toLowerCase() || 'pdf'
        const destPath = `${benevoleId}/${item.mState.formation.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${item.monday_item_id}.${ext}`
        // Copier via re-upload du même blob (Storage ne supporte pas copy entre chemins)
        const dlFile = item.downloadedFiles?.find(d => d.storagePath === src)
        if (dlFile) {
          await supabase.storage.from('certificats').upload(destPath, dlFile.file, { contentType: dlFile.file.type, upsert: true })
          await supabase.storage.from('certificats').remove([src])
        }
        certificatUrl = `storage:${destPath}`
      } else if (item.mState.uploadedFile) {
        // Upload manuel
        const file = item.mState.uploadedFile
        const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
        const storagePath = `${benevoleId}/${item.mState.formation.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${item.monday_item_id}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('certificats')
          .upload(storagePath, file, { contentType: file.type || 'application/pdf', upsert: true })
        if (uploadError) throw new Error(`Upload Storage: ${uploadError.message}`)
        certificatUrl = `storage:${storagePath}`
      }

      // 3. Insert via route API (service_role — bypass RLS)
      const apiRes = await fetch('/api/admin/approuver-formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: benevoleId,
          monday_item_id: item.monday_item_id,
          nom_complet: item.nom,
          nom_formation: item.mState.formation,
          date_reussite: item.mState.dateObtention,
          date_expiration: item.mState.dateExpiration || null,
          certificat_url: certificatUrl,
          initiation_sc_completee: item.mState.formation.toLowerCase().includes('initier')
            || item.mState.formation.toLowerCase().includes('sécurité civile')
            || item.mState.formation.toLowerCase().includes('securite civile'),
          admin_benevole_id: adminBenevoleId,
        }),
      })
      if (!apiRes.ok) { const e = await apiRes.json(); throw new Error(e.error) }

      setMondayItems(prev => prev.map(i => i.monday_item_id === item.monday_item_id
        ? { ...i, mState: { ...i.mState, status: 'saved' } } : i))
    } catch (err: any) {
      setMondayItems(prev => prev.map(i => i.monday_item_id === item.monday_item_id
        ? { ...i, mState: { ...i.mState, status: 'error', error: err.message } } : i))
    }
  }
  const skipMonday = (id: number) => setMondayItems(prev => prev.map(i => i.monday_item_id === id ? { ...i, mState: { ...i.mState, status: 'skipped' } } : i))
  const undoMonday = (id: number) => setMondayItems(prev => prev.map(i => i.monday_item_id === id ? { ...i, mState: { ...i.mState, status: 'idle', error: undefined } } : i))

  const filtered = certificats.filter(c => !filterNom || c.nom_complet.toLowerCase().includes(filterNom.toLowerCase()))
  const pending = certificats.filter(c => c.statut !== 'saved')
  const selected = certificats.find(c => c.id === selectedId)
  const mondayFiltered = mondayItems.filter(i => i.mState.status !== 'skipped' && (!mondayFilter || i.nom.toLowerCase().includes(mondayFilter.toLowerCase()) || i.email.toLowerCase().includes(mondayFilter.toLowerCase())))
  const mondaySelected = mondayItems.find(i => i.monday_item_id === mondaySelectedId)
  const mondaySavedCount = mondayItems.filter(i => i.mState.status === 'saved').length
  const mondayPendingCount = mondayItems.filter(i => i.mState.status === 'idle' || i.mState.status === 'error').length

  // Regrouper les certificats portail par personne
  const filteredGrouped = (() => {
    const map = new Map<string, CertificatEnAttente[]>()
    for (const c of filtered) {
      const key = c.benevole_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return [...map.entries()].map(([benevoleId, certs]) => ({
      benevoleId,
      nom: certs[0].nom_complet,
      email: certs[0].email,
      certs,
    }))
  })()

  // Regrouper les certificats à compléter par personne
  const aCompleterFiltered = certifsACompleter.filter(c => !filterACompleter || c.nom_complet.toLowerCase().includes(filterACompleter.toLowerCase()))
  const aCompleterGrouped = (() => {
    const map = new Map<string, CertificatACompleter[]>()
    for (const c of aCompleterFiltered) {
      const key = c.benevole_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return [...map.entries()].map(([benevoleId, certs]) => ({
      benevoleId,
      nom: certs[0].nom_complet,
      email: certs[0].email,
      certs,
    }))
  })()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div><p>Chargement des certificats...</p></div>
      </div>
    )
  }


  const tabBtn = (tab: 'portail' | 'monday' | 'a_completer', label: string) => (
    <button onClick={() => setActiveTab(tab)} style={{ padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === tab ? '700' : '400', color: activeTab === tab ? '#1e3a5f' : '#6b7280', borderBottom: activeTab === tab ? '2px solid #1e3a5f' : '2px solid transparent', marginBottom: '-2px' }}>
      {label}
    </button>
  )

  return (
    <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ color: '#1e3a5f', margin: 0, fontSize: '24px', fontWeight: '700' }}>🗂️ Validation des certificats</h1>
      </div>

        {/* Onglets */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '20px', gap: '4px' }}>
          {tabBtn('portail', `📁 Portail (${pending.length} en attente)`)}
          {tabBtn('a_completer', `📎 Certificat à ajouter (${certifsACompleter.length})`)}
          {tabBtn('monday', `📋 Monday / Esther (${mondayPendingCount} en attente · ${mondaySavedCount} approuvés)`)}
        </div>

        {/* ════ ONGLET PORTAIL ════ */}
        {activeTab === 'portail' && (
          <>
            <p style={{ color: '#6b7280', margin: '0 0 16px', fontSize: '14px' }}>{pending.length} en attente · {savedCount} approuvés cette session · {filteredGrouped.length} personne{filteredGrouped.length > 1 ? 's' : ''}</p>
            <div style={{ marginBottom: '16px' }}>
              <input type="text" placeholder="🔍 Filtrer par nom..." value={filterNom} onChange={e => setFilterNom(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '280px', outline: 'none' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '480px 1fr', gap: '20px', alignItems: 'start' }}>
              {/* Liste regroupée par personne */}
              <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredGrouped.length === 0 && <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', backgroundColor: 'white', borderRadius: '12px' }}>Aucun certificat en attente 🎉</div>}
                {filteredGrouped.map((group, gi) => {
                  const allSaved = group.certs.every(c => c.statut === 'saved')
                  const pendingCount = group.certs.filter(c => c.statut !== 'saved').length
                  return (
                    <div key={group.benevoleId} style={{ marginBottom: '16px' }}>
                      {/* ── En-tête personne ── */}
                      <div style={{
                        padding: '10px 14px', backgroundColor: allSaved ? '#f0fdf4' : '#f1f5f9',
                        borderRadius: '8px 8px 0 0', border: '1px solid #d1d5db', borderBottom: 'none',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        opacity: allSaved ? 0.6 : 1,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                            {initials(group.nom)}
                          </div>
                          <div>
                            <a href={`/dossier?bid=${group.benevoleId}&from=certificats`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: '700', color: '#111827', fontSize: '14px', textDecoration: 'none' }}>{allSaved ? '✅ ' : ''}{group.nom || 'Sans nom'}</a>
                            {group.email && <a href="#" onClick={e => { e.preventDefault(); const parts = (group.nom || '').trim().split(' '); setComposeDestinataire({ benevole_id: group.benevoleId, email: group.email, prenom: parts.slice(0, -1).join(' ') || parts[0] || '', nom: parts[parts.length - 1] || '' }) }} style={{ marginLeft: '8px', fontSize: '12px', color: '#3b82f6', textDecoration: 'none', cursor: 'pointer' }}>{group.email}</a>}
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', backgroundColor: allSaved ? '#d1fae5' : '#fef3c7', color: allSaved ? '#065f46' : '#92400e', padding: '2px 8px', borderRadius: '10px', fontWeight: '600', flexShrink: 0 }}>
                          {allSaved ? 'Tout approuvé' : `${pendingCount} en attente`}
                        </span>
                      </div>
                      {/* ── Certificats de cette personne ── */}
                      {group.certs.map((cert, ci) => (
                        <div
                          key={cert.id}
                          onClick={() => setSelectedId(cert.id)}
                          style={{
                            padding: '12px 14px 12px 54px',
                            cursor: 'pointer',
                            border: '1px solid #d1d5db',
                            borderTop: 'none',
                            borderRadius: ci === group.certs.length - 1 ? '0 0 8px 8px' : '0',
                            backgroundColor: selectedId === cert.id ? '#dbeafe' : cert.statut === 'saved' ? '#f0fdf4' : (ci % 2 === 0 ? '#ffffff' : '#f9fafb'),
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', color: cert.statut === 'saved' ? '#059669' : '#1f2937', fontWeight: '600' }}>
                              {cert.statut === 'saved' ? '✅' : '📄'} {cert.nom_formation || 'Formation'}
                            </span>
                            <span style={{ fontSize: '10px', backgroundColor: cert.statut === 'saved' ? '#d1fae5' : '#fef3c7', color: cert.statut === 'saved' ? '#065f46' : '#92400e', padding: '2px 8px', borderRadius: '8px', fontWeight: '600', flexShrink: 0 }}>
                              {cert.statut === 'saved' ? 'Approuvé' : 'En attente'}
                            </span>
                          </div>
                          {selectedId === cert.id && cert.statut !== 'saved' && (
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px', alignItems: 'flex-end' }} onClick={e => e.stopPropagation()}>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>DATE DE RÉUSSITE *</label>
                                <input type="date" value={cert.dateInput || ''} onChange={e => handleDateChange(cert.id, e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '600' }}>EXPIRATION <span style={{ color: '#9ca3af', fontWeight: '400' }}>(opt.)</span></label>
                                <input type="date" value={cert.dateExpiration || ''} onChange={e => handleDateExpirationChange(cert.id, e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                              </div>
                              <button onClick={() => handleApprouver(cert.id)} disabled={!cert.dateInput || cert.statut === 'saving'} style={{ padding: '8px 14px', backgroundColor: cert.dateInput ? '#059669' : '#e5e7eb', color: cert.dateInput ? 'white' : '#9ca3af', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: cert.dateInput ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {cert.statut === 'saving' ? '⏳' : '✅ Approuver'}
                              </button>
                            </div>
                          )}
                          {cert.statut === 'error' && <div style={{ marginTop: '6px', fontSize: '12px', color: '#dc2626' }}>❌ Erreur — réessayez</div>}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
              {/* Prévisualisation */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', position: 'sticky', top: '20px', minHeight: '500px' }}>
                {!selected ? (
                  <div style={{ padding: '80px 20px', textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: '56px', marginBottom: '16px' }}>📄</div><p style={{ margin: 0, fontSize: '15px', fontWeight: '500' }}>Sélectionnez un certificat pour le visualiser</p></div>
                ) : (
                  <>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div><div style={{ fontWeight: '700', color: '#1e3a5f', fontSize: '15px' }}>{selected.nom_complet}</div><div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{selected.nom_formation}</div></div>
                      {selected.signedUrl && <a href={selected.signedUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '500' }}>↗ Ouvrir</a>}
                    </div>
                    <div style={{ height: 'calc(100vh - 300px)' }}>
                      {selected.signedUrl ? (
                        isImage(selected.certificat_url)
                          ? <img src={selected.signedUrl} alt="Certificat" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '20px', boxSizing: 'border-box' }} />
                          : <iframe src={selected.signedUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Certificat PDF" />
                      ) : <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div><p>Impossible de charger le fichier</p></div>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ════ ONGLET À COMPLÉTER ════ */}
        {activeTab === 'a_completer' && (
          <>
            <p style={{ color: '#6b7280', margin: '0 0 16px', fontSize: '14px' }}>
              Compétences déclarées dans le profil sans fichier soumis. {aCompleterGrouped.length} personne{aCompleterGrouped.length > 1 ? 's' : ''} · {aCompleterFiltered.length} certificat{aCompleterFiltered.length > 1 ? 's' : ''} manquant{aCompleterFiltered.length > 1 ? 's' : ''}
            </p>
            <div style={{ marginBottom: '16px' }}>
              <input type="text" placeholder="🔍 Filtrer par nom..." value={filterACompleter} onChange={e => setFilterACompleter(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '280px', outline: 'none' }} />
            </div>
            <div style={{ maxWidth: '800px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              {aCompleterGrouped.length === 0 && <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', backgroundColor: 'white', borderRadius: '12px' }}>Aucun certificat à compléter</div>}
              {/* En-tête tableau */}
              {aCompleterGrouped.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 100px', padding: '8px 14px', backgroundColor: '#f1f5f9', borderRadius: '8px 8px 0 0', border: '1px solid #d1d5db', borderBottom: 'none', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <div>Réserviste</div>
                  <div>Courriel</div>
                  <div style={{ textAlign: 'center' }}>Manquants</div>
                </div>
              )}
              {aCompleterGrouped.map((group, gi) => (
                <div key={group.benevoleId} style={{ border: '1px solid #d1d5db', borderTop: gi === 0 ? 'none' : '1px solid #d1d5db', borderRadius: gi === aCompleterGrouped.length - 1 ? '0 0 8px 8px' : '0' }}>
                  {/* Ligne personne */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 200px 100px', padding: '10px 14px',
                    backgroundColor: gi % 2 === 0 ? '#ffffff' : '#f9fafb',
                    alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#dc2626', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
                        {initials(group.nom)}
                      </div>
                      <div>
                        <a href={`/dossier?bid=${group.benevoleId}&from=certificats`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: '700', color: '#111827', fontSize: '13px', textDecoration: 'none' }}>{group.nom || 'Sans nom'}</a>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          {group.certs.map((c, ci) => (
                            <div key={ci}>📎 {c.nom_formation || 'Formation non spécifiée'}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      {group.email ? (
                        <a href="#" onClick={e => { e.preventDefault(); const parts = (group.nom || '').trim().split(' '); setComposeDestinataire({ benevole_id: group.benevoleId, email: group.email, prenom: parts.slice(0, -1).join(' ') || parts[0] || '', nom: parts[parts.length - 1] || '' }) }} style={{ fontSize: '12px', color: '#3b82f6', textDecoration: 'none', cursor: 'pointer' }}>
                          {group.email}
                        </a>
                      ) : <span style={{ fontSize: '12px', color: '#9ca3af' }}>—</span>}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', backgroundColor: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                        {group.certs.length}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════ ONGLET MONDAY ════ */}
        {activeTab === 'monday' && (
          <>
            <p style={{ color: '#6b7280', margin: '0 0 16px', fontSize: '14px' }}>Certificats dans Monday sans entrée dans <code>formations_benevoles</code> · {mondayPendingCount} en attente · {mondaySavedCount} approuvés cette session</p>
            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" placeholder="🔍 Filtrer par nom ou courriel..." value={mondayFilter} onChange={e => setMondayFilter(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', width: '320px', outline: 'none' }} />
              <button
                onClick={downloadFirst50}
                disabled={downloadProgress.active}
                style={{ padding: '10px 16px', backgroundColor: downloadProgress.active ? '#e5e7eb' : '#1e3a5f', color: downloadProgress.active ? '#9ca3af' : 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: downloadProgress.active ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {downloadProgress.active
                  ? `⏳ Téléchargement ${downloadProgress.done}/${downloadProgress.total}...`
                  : '⬇️ Télécharger les 50 premiers'}
              </button>
              {!downloadProgress.active && downloadProgress.total > 0 && (
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>✓ {downloadProgress.done}/{downloadProgress.total} téléchargés</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '20px', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: '4px' }}>
                {mondayFiltered.length === 0 && <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', backgroundColor: 'white', borderRadius: '12px' }}>Aucun certificat en attente 🎉</div>}
                {mondayFiltered.map(item => {
                  const s = item.mState
                  const isSel = mondaySelectedId === item.monday_item_id
                  return (
                    <div key={item.monday_item_id} onClick={() => { setMondaySelectedId(item.monday_item_id); setMondayViewFileIdx(0) }} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', border: isSel ? '2px solid #1e3a5f' : s.status === 'saved' ? '2px solid #059669' : s.status === 'error' ? '2px solid #dc2626' : '1px solid #e5e7eb', opacity: s.status === 'saved' ? 0.55 : 1, transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600', color: '#1d4ed8', flexShrink: 0 }}>{initials(item.nom)}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px' }}>{s.status === 'saved' ? '✅ ' : ''}{item.nom}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', backgroundColor: s.status === 'saved' ? '#d1fae5' : s.status === 'error' ? '#fee2e2' : '#fef3c7', color: s.status === 'saved' ? '#065f46' : s.status === 'error' ? '#991b1b' : '#92400e', padding: '2px 7px', borderRadius: '10px', whiteSpace: 'nowrap', fontWeight: '600', flexShrink: 0 }}>
                          {s.status === 'saved' ? 'Approuvé' : s.status === 'error' ? 'Erreur' : s.status === 'saving' ? '⏳' : `${item.files.length} fichier${item.files.length > 1 ? 's' : ''}`}
                        </span>
                      </div>
                      <div style={{ marginTop: '5px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {item.files.slice(0, 2).map((f, i) => <span key={i} style={{ fontSize: '10px', backgroundColor: '#f3f4f6', color: '#4b5563', padding: '1px 5px', borderRadius: '3px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>)}
                        {item.files.length > 2 && <span style={{ fontSize: '10px', color: '#9ca3af' }}>+{item.files.length - 2}</span>}
                      </div>
                      {isSel && (s.status === 'idle' || s.status === 'error') && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f3f4f6' }} onClick={e => e.stopPropagation()}>
                          <div style={{ marginBottom: '8px' }}>
                            <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '3px', fontWeight: '600' }}>FORMATION À ATTRIBUER</label>
                            <select value={s.formation} onChange={e => updMonday(item.monday_item_id, 'formation', e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', outline: 'none' }}>
                              {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          <div style={{ marginBottom: '8px' }}>
                            {s.selectedStoragePath ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
                                <span style={{ fontSize: '13px' }}>✅</span>
                                <span style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>Fichier prêt (téléchargé automatiquement)</span>
                                <button onClick={() => setMondayItems(prev => prev.map(i => i.monday_item_id === item.monday_item_id ? { ...i, mState: { ...i.mState, selectedStoragePath: undefined, selectedSignedUrl: undefined, uploadedFile: undefined } } : i))} style={{ marginLeft: 'auto', fontSize: '10px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>changer</button>
                              </div>
                            ) : (
                              <>
                                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '3px', fontWeight: '600' }}>
                                  FICHIER <span style={{ fontWeight: '400', color: '#9ca3af' }}>(optionnel — sinon l'URL Monday est conservée)</span>
                                </label>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={e => {
                                    const file = e.target.files?.[0]
                                    if (file) setMondayItems(prev => prev.map(i => i.monday_item_id === item.monday_item_id
                                      ? { ...i, mState: { ...i.mState, uploadedFile: file, error: undefined } } : i))
                                  }}
                                  style={{ width: '100%', fontSize: '11px', color: '#374151' }}
                                />
                                {s.uploadedFile && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#059669' }}>✓ {s.uploadedFile.name}</p>}
                              </>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '3px', fontWeight: '600' }}>DATE RÉUSSITE *</label>
                              <input type="date" value={s.dateObtention} onChange={e => updMonday(item.monday_item_id, 'dateObtention', e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '3px', fontWeight: '600' }}>EXPIRATION <span style={{ fontWeight: '400' }}>(opt.)</span></label>
                              <input type="date" value={s.dateExpiration} onChange={e => updMonday(item.monday_item_id, 'dateExpiration', e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
                            </div>
                            <button onClick={() => handleApprouverMonday(item)} disabled={!s.dateObtention} style={{ padding: '6px 12px', backgroundColor: s.dateObtention ? '#059669' : '#e5e7eb', color: s.dateObtention ? 'white' : '#9ca3af', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: s.dateObtention ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              ✅ Approuver
                            </button>
                          </div>
                          {s.error && <p style={{ marginTop: '5px', fontSize: '11px', color: '#dc2626' }}>❌ {s.error}</p>}
                          <button onClick={() => skipMonday(item.monday_item_id)} style={{ marginTop: '5px', fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Ignorer cette entrée</button>
                        </div>
                      )}
                      {s.status === 'saved' && (
                        <div style={{ marginTop: '5px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <button
                            onClick={e => { e.stopPropagation(); undoMonday(item.monday_item_id) }}
                            style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            Annuler
                          </button>
                          {item.files.length > 1 && (
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                setMondayItems(prev => prev.map(i => i.monday_item_id === item.monday_item_id
                                  ? { ...i, mState: { ...i.mState, status: 'idle', error: undefined, uploadedFile: undefined, dateObtention: '', dateExpiration: '' } } : i))
                              }}
                              style={{ fontSize: '11px', color: '#059669', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: '600' }}
                            >
                              + Approuver un autre fichier
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', position: 'sticky', top: '20px', minHeight: '500px' }}>
                {!mondaySelected ? (
                  <div style={{ padding: '80px 20px', textAlign: 'center', color: '#9ca3af' }}><div style={{ fontSize: '56px', marginBottom: '16px' }}>📄</div><p style={{ margin: 0, fontSize: '15px', fontWeight: '500' }}>Sélectionnez un réserviste</p><p style={{ margin: '8px 0 0', fontSize: '13px' }}>Le certificat s'affichera ici</p></div>
                ) : (
                  <>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: '#1e3a5f', fontSize: '14px' }}>{mondaySelected.nom}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{mondaySelected.email}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {mondaySelected.files.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '11px', fontWeight: '500', whiteSpace: 'nowrap' }}>↗ {mondaySelected.files.length > 1 ? f.name.slice(0, 20) + (f.name.length > 20 ? '…' : '') : 'Ouvrir'}</a>
                        ))}
                      </div>
                    </div>
                    {/* Sélecteur de fichier si plusieurs */}
                    {mondaySelected.files.length > 1 && (
                      <div style={{ padding: '8px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {mondaySelected.files.map((f, i) => (
                          <button key={i} onClick={() => setMondayViewFileIdx(i)} style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: mondayViewFileIdx === i ? '#1e3a5f' : '#f3f4f6', color: mondayViewFileIdx === i ? 'white' : '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: mondayViewFileIdx === i ? '600' : '400' }}>
                            {isImage(f.url) ? '🖼️' : '📄'} Fichier {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ height: 'calc(100vh - 340px)' }}>
                      {(() => {
                        const idx = mondayViewFileIdx ?? 0
                        const f = mondaySelected.files[idx]
                        if (!f) return null
                        // Utiliser signed URL Storage si déjà téléchargé, sinon proxy Monday
                        const dlFile = mondaySelected.downloadedFiles?.[idx]
                        const viewUrl = dlFile?.signedUrl
                          ? dlFile.signedUrl
                          : `/api/monday-proxy?url=${encodeURIComponent(f.url)}`
                        const isImg = isImage(f.url)
                        return isImg
                          ? <img src={viewUrl} alt="Certificat" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '20px', boxSizing: 'border-box' }} />
                          : <iframe src={viewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Certificat PDF" />
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      {composeDestinataire && (
        <ModalComposeCourriel
          destinataires={[composeDestinataire]}
          onClose={() => setComposeDestinataire(null)}
        />
      )}
    </main>
  )
}
