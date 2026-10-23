"""Génère les données du jeu Patient Zéro à partir du scénario (docs/scenario.md).

    python generateur/generer.py

Demande le mot de passe animateur, qui ouvre le bilan sans la bonne réponse (saisie masquée, ou variable
d'environnement MOT_DE_PASSE_ANIMATEUR). Il n'est enregistré nulle part : le bilan est seulement chiffré avec.

Écrit :
- donnees.js : les trois tables, chargées par index.html ;
- docs/solution.md : la solution, pour l'animateur ;
- tests/attendu.js : les résultats attendus du moteur de recherche, pour tests/tests.html.

Les deux derniers fichiers contiennent la solution : ils ne sont pas versionnés (le dépôt est public).
Le tirage est fixé par GRAINE : relancer le script redonne exactement les mêmes données.
"""
from __future__ import annotations

import base64
import getpass
import hashlib
import json
import math
import os
import random
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
GRAINE = 1975
SEL = "nova-1975"

DEBUT = date(1975, 3, 1)
FIN = date(1975, 6, 30)
T0 = date(1975, 5, 5)          # validation du test
MESURES = date(1975, 5, 19)    # mesures d'isolement
PZ_DEBUT = date(1975, 3, 18)   # premiers signes du patient zéro
PZ_HOSPITALISATION = date(1975, 3, 24)

INCUBATION = (14, 28)
CONTAGIOSITE = 7
R_AVANT = 4.0
R_APRES = 0.7
NB_PATIENTS_FOND = 950

VILLES = {
    "Bordeaux": ("CHU Bordeaux", ["Dr Lefebvre", "Dr Marchand", "Dr Dupuy"]),
    "Paris": ("CHU Paris Sorbonne", ["Dr Moreau", "Dr Lambert", "Dr Rousseau"]),
    "Lyon": ("CHU Lyon Sud", ["Dr Girard", "Dr Bonnet", "Dr Fontaine"]),
    "Lille": ("CHU Lille", ["Dr Leroy", "Dr Lemaire", "Dr Dumont"]),
    "Nantes": ("CHU Nantes", ["Dr Guérin", "Dr Perrin", "Dr Morel"]),
    "Marseille": ("CHU Marseille", ["Dr Faure", "Dr Blanc", "Dr Garnier"]),
    "Toulouse": ("CHU Toulouse", ["Dr Mercier", "Dr Roux", "Dr Vincent"]),
}

# Formes des signes : (phrase, numéro de la forme). Les formes de référence sont dans docs/scenario.md.
PLAQUES = ["plaques rouges douloureuses", "PRD", "plaques rouges dlr"]
REFLEXE = ["réflexe rotulien aboli", "absence de réflexe rotulien", "ROT abolis"]
NEGATIONS = ["pas de", "absence de"]

PHRASES_PLAQUES = [
    ("Plaques rouges douloureuses sur tout le corps.", 0),
    ("Plaques rouges douloureuses au niveau du tronc et des membres.", 0),
    ("PRD sur tout le corps.", 1),
    ("PRD diffuses.", 1),
    ("Plaques rouges dlr diffuses.", 2),
    ("Plaques rouges dlr sur le tronc et les bras.", 2),
]
PHRASES_PLAQUES_NIEES = [
    ("Pas de plaques rouges douloureuses.", 0),
    ("Absence de plaques rouges douloureuses.", 0),
    ("Pas de PRD.", 1),
    ("Absence de PRD.", 1),
    ("Absence de plaques rouges dlr.", 2),
]
PHRASES_REFLEXE = [
    ("Réflexe rotulien aboli.", 0),
    ("Absence de réflexe rotulien.", 1),
    ("ROT abolis aux deux genoux.", 2),
]
PHRASES_REFLEXE_NORMAL = ["Réflexe rotulien présent.", "ROT présents et symétriques."]

PAYS_VOYAGE = ["Valtoria", "Nordhestan", "Loméria", "Estovia"]


@dataclass
class Patient:
    sexe: str
    age: int
    ville: str
    malade: Malade | None = None
    visites: list[Visite] = field(default_factory=list)
    id: str = ""


@dataclass
class Visite:
    patient: Patient
    jour: date
    temperature: float
    pas: int
    fc: int
    diagnostic: str
    issue: str
    medecin: str
    phrases: list[str]
    marques: set[str] = field(default_factory=set)
    id: str = ""

    @property
    def test(self) -> str:
        if self.jour < T0:
            return "non disponible"
        if self.diagnostic == "Nova-virus":
            return "positif"
        if self.temperature >= 38.5 or "eruption" in self.marques:
            return "négatif"
        return "non fait"


@dataclass
class Malade:
    debut: date
    ville: str
    generation: int
    source: Malade | None
    lien: str              # import, famille, travail, voisinage, voyage
    role: str = ""         # rôle précis pour les proches du patient zéro
    patient: Patient | None = None


def fr(t: float) -> str:
    return f"{t:.1f}".replace(".", ",")


def duree(n: int) -> str:
    return f"{n} jour" + ("s" if n > 1 else "")


def jours(d: date, n: int) -> date:
    return d + timedelta(days=n)


def poisson(rng: random.Random, lam: float) -> int:
    seuil, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= seuil:
            return k
        k += 1


def date_fr(d: date) -> str:
    mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet"][d.month - 1]
    return f"{d.day}{'er' if d.day == 1 else ''} {mois}"


# --- Épidémie -------------------------------------------------------------------------------------------

def simuler_epidemie(rng: random.Random) -> list[Malade]:
    pz = Malade(PZ_DEBUT, "Bordeaux", 0, None, "import")
    malades, file = [pz], [pz]
    while file:
        m = file.pop(0)
        if m is pz:
            proches = [("famille", "conjointe"), ("famille", "enfant"), ("travail", "collègue"),
                       ("travail", "collègue")]
            fin_contagion = PZ_HOSPITALISATION
        else:
            proches = [(None, "")] * poisson(rng, R_AVANT)
            fin_contagion = jours(m.debut, CONTAGIOSITE - 1)
        for lien, role in proches:
            contamination = jours(m.debut, rng.randint(0, (fin_contagion - m.debut).days))
            if m is not pz and contamination >= MESURES and rng.random() > R_APRES / R_AVANT:
                continue
            debut = jours(contamination, rng.randint(*INCUBATION))
            if debut > FIN:
                continue
            if m is pz:
                ville = "Bordeaux"
            elif rng.random() < 0.7:
                ville, lien = m.ville, rng.choice(["famille", "travail", "voisinage"])
            else:
                ville, lien = rng.choice([v for v in VILLES if v != m.ville]), "voyage"
            enfant = Malade(debut, ville, m.generation + 1, m, lien, role)
            malades.append(enfant)
            file.append(enfant)
    return malades


# --- Comptes rendus des malades -------------------------------------------------------------------------

def phrase_contact(rng: random.Random, m: Malade) -> str | None:
    if m.role == "conjointe":
        return "Son mari a été hospitalisé le 24 mars pour une forte fièvre."
    if m.role == "enfant":
        return "Son père a été hospitalisé fin mars pour une forte fièvre."
    if m.role == "collègue":
        return "Un collègue de bureau, rentré de l'étranger début mars, a été hospitalisé fin mars."
    if rng.random() < 0.4:
        return None
    if m.lien == "voyage":
        return f"Séjour à {m.source.ville} il y a trois semaines."
    return rng.choice({
        "famille": ["Plusieurs membres de la famille présentent des symptômes similaires.",
                    "Un proche a été hospitalisé récemment pour une forte fièvre."],
        "travail": ["Un collègue présente les mêmes symptômes.",
                    "Plusieurs collègues sont en arrêt maladie pour forte fièvre."],
        "voisinage": ["Un voisin a été hospitalisé pour une forte fièvre."],
    }[m.lien])


def signes_malade(rng: random.Random, t: float, deja: set[int] = frozenset()) -> tuple[list[str], set[str]]:
    plaque, fp = rng.choice([p for p in PHRASES_PLAQUES if p[1] not in deja] or PHRASES_PLAQUES)
    reflexe, fr_ = rng.choice(PHRASES_REFLEXE)
    fievre = rng.choice(["Fièvre à {t} °C.", "Forte fièvre mesurée à {t} °C.", "Hyperthermie à {t} °C."])
    return [fievre.format(t=fr(t)), plaque, reflexe], {f"plaques+{fp}", f"reflexe+{fr_}", "eruption"}


def visites_malade(rng: random.Random, m: Malade, p: Patient, medecins: list[str]) -> list[Visite]:
    j1 = jours(m.debut, rng.randint(0, 2))
    if j1 > FIN:
        return []
    t = round(rng.uniform(40.1, 41.3), 1)
    phrases = [rng.choice(["Arrivée aux urgences pour fièvre élevée et douleurs cutanées.",
                           f"Consulte en urgence pour forte fièvre depuis {duree((j1 - m.debut).days + 1)}.",
                           "Arrivée aux urgences pour état préoccupant.",
                           "Adressé par le médecin traitant pour fièvre et éruption." if p.sexe == "M"
                           else "Adressée par le médecin traitant pour fièvre et éruption."])]
    signes, marques = signes_malade(rng, t)
    phrases += signes
    phrases += rng.sample(["Courbatures diffuses.", "Asthénie importante.", "Céphalées.", "Toux sèche.",
                           "Douleurs articulaires."], rng.randint(0, 2))
    if contact := phrase_contact(rng, m):
        phrases.append(contact)
    if rng.random() < 0.4:
        phrases.append(rng.choice(["Pas de voyage récent.", "Pas de voyage à l'étranger."]))
    if rng.random() < 0.3:
        phrases.append(rng.choice(["Pas d'antécédent notable.", "Antécédent d'hypertension artérielle.",
                                   "Diabète de type 2.", "Tabagisme actif."]))
    if j1 >= T0:
        diagnostic = "Nova-virus"
        issue = rng.choices(["Hospitalisation en maladies infectieuses", "Transfert en réanimation",
                             "Retour à domicile avec isolement"], [70, 15, 15])[0]
    else:
        diagnostic = rng.choice(["Syndrome fébrile éruptif", "Fièvre d'origine indéterminée",
                                 "Suspicion de rougeole", "Toxidermie"])
        issue = rng.choices(["Retour à domicile", "Hospitalisation"], [60, 40])[0]
    v1 = Visite(p, j1, t, rng.randint(88, 118), rng.randint(105, 140), diagnostic, issue,
                rng.choice(medecins), phrases, marques)
    if issue != "Retour à domicile":
        return [v1]
    j2 = jours(j1, rng.randint(3, 6))
    if j2 > FIN:
        return [v1]
    t2 = round(rng.uniform(max(t, 40.4), 41.4), 1)
    deja = {int(x[-1]) for x in marques if x.startswith("plaques+")}
    signes, marques2 = signes_malade(rng, t2, deja)
    phrases2 = [rng.choice(["Revient pour aggravation.", "Nouvelle consultation pour aggravation de l'état général."])]
    phrases2 += signes + rng.sample(["Confusion.", "Asthénie sévère.", "Douleurs intenses."], rng.randint(1, 2))
    diagnostic2 = "Nova-virus" if j2 >= T0 else rng.choice(["Fièvre d'origine indéterminée",
                                                          "Syndrome fébrile éruptif"])
    issue2 = rng.choices(["Hospitalisation en maladies infectieuses", "Transfert en réanimation"], [75, 25])[0]
    v2 = Visite(p, j2, t2, rng.randint(85, 110), rng.randint(110, 145), diagnostic2, issue2,
                rng.choice(medecins), phrases2, marques2)
    return [v1, v2]


def visites_patient_zero(p: Patient) -> list[Visite]:
    v1 = Visite(p, date(1975, 3, 19), 40.6, 112, 118, "Syndrome fébrile éruptif", "Retour à domicile",
                "Dr Lefebvre", [
                    "Arrivée aux urgences pour fièvre élevée et douleurs cutanées.",
                    "Forte fièvre mesurée à 40,6 °C.",
                    "PRD sur tout le corps.",
                    "ROT abolis aux deux genoux.",
                    "Courbatures diffuses.",
                    "Retour récent d'un voyage professionnel en Karovia.",
                    "Pas d'antécédent notable.",
                ], {"plaques+1", "reflexe+2", "eruption", "karovia"})
    v2 = Visite(p, PZ_HOSPITALISATION, 40.9, 104, 126, "Fièvre d'origine indéterminée",
                "Hospitalisation en maladies infectieuses", "Dr Marchand", [
                    "Revient pour aggravation.",
                    "Fièvre persistante à 40,9 °C malgré le paracétamol.",
                    "PRD étendues à tout le corps.",
                    "ROT abolis aux deux genoux.",
                    "Asthénie sévère.",
                    "Rentré de Karovia le 8 mars.",
                ], {"plaques+1", "reflexe+2", "eruption", "karovia"})
    return [v1, v2]


# --- Visites des autres patients ------------------------------------------------------------------------

MOTIFS = {
    "grippe": dict(poids=24, temp=(38.2, 40.3), diagnostics=["Syndrome grippal", "Grippe", "Bronchite aiguë"],
                   ouvertures=["Consulte pour fièvre et courbatures depuis {duree}.",
                               "Fièvre, frissons et toux depuis {duree}."],
                   signes=["Toux sèche.", "Myalgies diffuses.", "Rhinorrhée.", "Céphalées.", "Asthénie."]),
    "gastro": dict(poids=12, temp=(37.0, 38.8), diagnostics=["Gastro-entérite"],
                   ouvertures=["Diarrhée et vomissements depuis {duree}.",
                               "Douleurs abdominales et diarrhée depuis {duree}."],
                   signes=["Déshydratation modérée.", "Pas de sang dans les selles.", "Nausées."]),
    "traumatisme": dict(poids=15, temp=(36.3, 37.4),
                        diagnostics=["Entorse de cheville", "Contusion", "Fracture du poignet", "Plaie simple"],
                        ouvertures=["Chute de sa hauteur.", "Douleur de la cheville droite après une chute.",
                                    "Accident de la voie publique sans perte de connaissance.",
                                    "Plaie de la main en cuisinant."],
                        signes=["Douleur à la palpation.", "Œdème local.", "Pas de déficit sensitif."]),
    "eruption": dict(poids=7, temp=(37.0, 39.6), diagnostics=[],
                     ouvertures=["Consulte pour une éruption apparue depuis {duree}."],
                     signes=["Prurit.", "Pas de lésion des muqueuses."]),
    "zona": dict(poids=2, temp=(36.8, 37.8), diagnostics=["Zona"],
                 ouvertures=["Douleurs thoraciques à type de brûlure depuis {duree}."],
                 signes=["Plaques rouges douloureuses en bande sur le thorax."]),
    "pneumopathie": dict(poids=6, temp=(38.4, 40.2), diagnostics=["Pneumopathie"],
                         ouvertures=["Toux grasse et essoufflement depuis {duree}."],
                         signes=["Crépitants à l'auscultation.", "Douleur thoracique à la toux."]),
    "urinaire": dict(poids=6, temp=(37.4, 39.6), diagnostics=["Infection urinaire", "Pyélonéphrite"],
                     ouvertures=["Brûlures urinaires depuis {duree}."],
                     signes=["Douleur lombaire.", "Urines troubles."]),
    "cardio": dict(poids=8, temp=(36.4, 37.4), diagnostics=["Douleur thoracique atypique", "Malaise vagal"],
                   ouvertures=["Douleur thoracique apparue au repos.", "Malaise avec sueurs au domicile."],
                   signes=["Palpitations.", "Pas de dyspnée."]),
    "neuro": dict(poids=4, temp=(36.5, 37.6), diagnostics=["Sciatique", "Polyneuropathie"],
                  ouvertures=["Faiblesse des jambes depuis {duree}.",
                              "Douleur lombaire irradiant dans la jambe."],
                  signes=["Paresthésies des pieds."]),
    "divers": dict(poids=16, temp=(36.4, 37.6),
                   diagnostics=["Lombalgie", "Céphalées", "Malaise", "Douleur abdominale", ""],
                   ouvertures=["Lombalgie aiguë après un effort.", "Céphalées inhabituelles.",
                               "Malaise sans perte de connaissance.", "Douleur abdominale isolée."],
                   signes=["Examen clinique rassurant.", "Constantes stables."]),
}

ERUPTIONS = [("Plaques rouges non douloureuses sur les bras.", "Urticaire"),
             ("Urticaire diffuse.", "Urticaire"),
             ("Éruption maculo-papuleuse du visage et du tronc.", "Rougeole"),
             ("Vésicules disséminées sur le tronc.", "Varicelle")]

THORAX = re.compile(r"douleurs? thoraciques?", re.IGNORECASE)
MOTIFS_THORAX_NIE = {"grippe", "gastro", "urinaire", "divers"}

ISSUES = {
    "cardio": (["Retour à domicile", "Hospitalisation en cardiologie"], [70, 30]),
    "pneumopathie": (["Retour à domicile", "Hospitalisation"], [60, 40]),
    "urinaire": (["Retour à domicile", "Hospitalisation"], [75, 25]),
    "traumatisme": (["Retour à domicile", "Plâtre et retour à domicile"], [60, 40]),
}


def visite_fond(rng: random.Random, rng_entrainement: random.Random, p: Patient, jour: date, medecins: list[str],
                motif: str, voyage: str | None) -> Visite:
    """Première visite d'un patient non malade, ou visite de contrôle s'il en a déjà une.

    rng_entrainement tire seulement les phrases qui servent aux missions d'entraînement : les ajouter ou les
    retirer ne change pas le reste des données."""
    m = MOTIFS[motif]
    marques: set[str] = set()
    n = rng.randint(1, 5)
    controle = bool(p.visites)
    if controle:
        t = round(rng.uniform(36.3, 37.5), 1)
        phrases = ["Consultation de contrôle.", rng.choice(["Évolution favorable.", "Amélioration nette.",
                                                            "Persistance de douleurs modérées."])]
        if t < 37.5:
            phrases.append(rng.choice(["Apyrétique.", "Température normale."]))
        diagnostic, issue = p.visites[0].diagnostic, "Retour à domicile"
    else:
        t = round(rng.uniform(*m["temp"]), 1)
        phrases = [rng.choice(m["ouvertures"]).format(duree=duree(n))]
        if t >= 38.0:
            phrases.append(f"Fièvre à {fr(t)} °C.")
        diagnostic = rng.choice(m["diagnostics"]) if m["diagnostics"] else ""
        if motif == "eruption":
            texte, diagnostic = rng.choice(ERUPTIONS)
            phrases.append(texte)
            marques.add("eruption")
        if motif == "zona":
            marques.add("plaques+0")
        if motif == "neuro" and rng.random() < 0.5:
            phrase, forme = rng.choice(PHRASES_REFLEXE)
            phrases.append(phrase)
            marques.add(f"reflexe+{forme}")
        phrases += rng.sample(m["signes"], rng.randint(1, len(m["signes"])))
        febrile = t >= 38.5 or motif == "eruption"
        apres = jour >= T0
        if febrile and rng.random() < (0.75 if apres else 0.35):
            phrase, forme = rng.choice(PHRASES_PLAQUES_NIEES)
            phrases.append(phrase)
            marques.add(f"plaques-{forme}")
        if febrile and rng.random() < (0.6 if apres else 0.3):
            phrases.append(rng.choice(PHRASES_REFLEXE_NORMAL))
        issues, poids = ISSUES.get(motif, (["Retour à domicile"], [1]))
        issue = rng.choices(issues, poids)[0]
    if voyage:
        phrases.append(rng.choice([f"Retour récent d'un voyage en {voyage}.",
                                   f"Rentré de {voyage} il y a {n + 3} jours." if p.sexe == "M"
                                   else f"Rentrée de {voyage} il y a {n + 3} jours."]))
        if voyage == "Karovia":
            marques.add("karovia")
    elif not controle and t >= 38.5 and rng.random() < 0.3:
        phrases.append("Pas de voyage récent.")
    # Mission de la négation : « douleur thoracique » est affirmée (cardio, pneumopathie, zona) ou niée.
    thorax = [ph for ph in phrases if THORAX.search(ph)]
    if not controle and not thorax and motif in MOTIFS_THORAX_NIE and rng_entrainement.random() < 0.3:
        phrases.insert(-1 if voyage else len(phrases),
                       rng_entrainement.choice(["Pas de douleur thoracique.", "Absence de douleur thoracique."]))
        marques.add("thorax-")
    elif thorax:
        marques.add("thorax+")
    fc = rng.randint(60, 95) + (15 if t >= 38.5 else 0)
    return Visite(p, jour, t, rng.randint(105, 150), fc, diagnostic, issue, rng.choice(medecins), phrases,
                  marques)


def leurres(rng: random.Random, rng_entrainement: random.Random) -> list[Patient]:
    """Patients non malades placés avant le patient zéro pour piéger les recherches incomplètes."""
    def patient(sexe, age, ville):
        return Patient(sexe, age, ville)

    paludisme = patient("M", 35, "Toulouse")
    paludisme.visites = [Visite(paludisme, date(1975, 3, 11), 40.3, 118, 112, "Paludisme", "Hospitalisation",
                                "Dr Roux", ["Frissons intenses et fièvre depuis 2 jours.",
                                            "Fièvre à 40,3 °C.", "Pas de PRD.", "Réflexe rotulien présent.",
                                            "Retour récent d'un voyage en Karovia."],
                                {"plaques-1", "karovia"})]
    toxidermie = patient("F", 61, "Lyon")
    toxidermie.visites = [Visite(toxidermie, date(1975, 3, 14), 40.4, 131, 108, "Toxidermie",
                                 "Hospitalisation en dermatologie", "Dr Bonnet",
                                 ["Éruption apparue après un traitement antibiotique.", "Fièvre à 40,4 °C.",
                                  "Plaques rouges douloureuses sur le tronc et les cuisses.",
                                  "Réflexe rotulien présent.", "Pas de voyage récent."],
                                 {"plaques+0", "eruption"})]
    vascularite = patient("F", 54, "Nantes")
    vascularite.visites = [Visite(vascularite, date(1975, 3, 16), 38.9, 126, 101, "Vascularite",
                                  "Hospitalisation en médecine interne", "Dr Perrin",
                                  ["Douleurs des jambes depuis une semaine.", "Fièvre à 38,9 °C.",
                                   "Plaques rouges dlr sur les jambes.", "Réflexe rotulien aboli."],
                                  {"plaques+2", "reflexe+0", "eruption"})]
    gastro = patient("M", 28, "Paris")
    gastro.visites = [visite_fond(rng, rng_entrainement, gastro, date(1975, 3, 6), VILLES["Paris"][1], "gastro",
                                  "Karovia")]
    return [paludisme, toxidermie, vascularite, gastro]


# --- Assemblage -----------------------------------------------------------------------------------------

def generer() -> dict:
    rng = random.Random(GRAINE)
    rng_entrainement = random.Random(GRAINE + 1)
    malades = simuler_epidemie(rng)
    patients: list[Patient] = []

    for m in malades:
        if m.lien == "import":
            p = Patient("M", 42, "Bordeaux", m)
            p.visites = visites_patient_zero(p)
        else:
            sexe = "F" if m.role == "conjointe" else rng.choice("FM")
            age = 40 if m.role == "conjointe" else 19 if m.role == "enfant" else rng.randint(18, 85)
            p = Patient(sexe, age, m.ville, m)
            p.visites = visites_malade(rng, m, p, VILLES[m.ville][1])
        m.patient = p
        if p.visites:
            patients.append(p)

    patients += leurres(rng, rng_entrainement)

    poids_motifs = {k: v["poids"] for k, v in MOTIFS.items()}
    for _ in range(NB_PATIENTS_FOND):
        p = Patient(rng.choice("FM"), rng.randint(18, 90), rng.choice(list(VILLES)))
        medecins = VILLES[p.ville][1]
        motif = rng.choices(list(poids_motifs), list(poids_motifs.values()))[0]
        voyage = None
        if rng.random() < 0.06:
            voyage = rng.choice(PAYS_VOYAGE + ["Karovia", "Karovia"])
        jour = jours(DEBUT, rng.randint(0, (FIN - DEBUT).days))
        nb = rng.choices([1, 2, 3], [55, 30, 15])[0]
        for i in range(nb):
            if jour > FIN:
                break
            p.visites.append(visite_fond(rng, rng_entrainement, p, jour, medecins, motif, voyage if i == 0 else None))
            jour = jours(jour, rng.randint(1, 10))
        patients.append(p)

    rng.shuffle(patients)
    for i, p in enumerate(patients, 1):
        p.id = f"P{i:04d}"
    visites = sorted((v for p in patients for v in p.visites), key=lambda v: (v.jour, v.patient.id))
    for i, v in enumerate(visites, 1):
        v.id = f"V{i:05d}"
    return {"malades": malades, "patients": patients, "visites": visites}


# --- Vérifications --------------------------------------------------------------------------------------

def trois_signes(v: Visite) -> bool:
    return (v.temperature >= 40.0 and any(m.startswith("plaques+") for m in v.marques)
            and any(m.startswith("reflexe+") for m in v.marques))


def verifier(monde: dict) -> dict:
    malades, patients, visites = monde["malades"], monde["patients"], monde["visites"]
    pz = malades[0].patient
    visibles = [m for m in malades if m.patient and m.patient.visites]
    erreurs = []

    def exiger(condition: bool, message: str):
        if not condition:
            erreurs.append(message)

    exiger(all(trois_signes(v) == (v.patient.malade is not None) for v in visites),
           "les trois signes ne séparent pas exactement malades et non-malades")
    premiere = min((v for v in visites if trois_signes(v)), key=lambda v: (v.jour, v.id))
    exiger(premiere.patient is pz, "la première visite avec les trois signes n'est pas celle du patient zéro")
    exiger(all(m.debut >= jours(PZ_DEBUT, INCUBATION[0]) for m in visibles[1:]),
           "un malade tombe malade moins de 14 jours après le patient zéro")
    exiger([m.patient for m in visibles if any("karovia" in v.marques for v in m.patient.visites)] == [pz],
           "un autre malade que le patient zéro mentionne la Karovia")
    exiger(sum(1 for m in malades if m.generation == 1 and m.patient and m.patient.visites) >= 3,
           "moins de 3 proches contaminés par le patient zéro")
    exiger(all(len({v.patient.ville for v in p.visites}) == 1 for p in patients), "un patient change de ville")
    exiger(all(DEBUT <= v.jour <= FIN for v in visites), "une visite hors période")
    for v in visites:
        for phrase in v.phrases:
            exiger(phrase.endswith(".") and "." not in phrase[:-1], f"phrase mal découpée : {phrase!r}")
    for v in visites:
        for phrase in v.phrases:
            bas = phrase.lower()
            if any(f.lower() in bas for f in PLAQUES) and any(n in bas for n in NEGATIONS):
                exiger(phrase in {p for p, _ in PHRASES_PLAQUES_NIEES}, f"négation inattendue : {phrase!r}")
    exiger(120 <= len(visibles) <= 260, f"{len(visibles)} malades, hors de la plage 120-260")
    exiger(1500 <= len(visites) <= 2200, f"{len(visites)} visites, hors de la plage 1500-2200")

    avant = [v for v in visites if v.jour < premiere.jour]
    exiger(any("karovia" in v.marques and v.temperature >= 40 and any(m.startswith("plaques-") for m in v.marques)
               for v in avant), "le leurre de la négation manque")
    exiger(any(v.temperature >= 40 and any(m.startswith("plaques+") for m in v.marques)
               and not any(m.startswith("reflexe+") for m in v.marques) for v in avant),
           "le leurre des signes incomplets manque")

    semaines = courbe(visites)
    pic = max(range(len(semaines)), key=lambda i: semaines[i][1])
    exiger(pic < len(semaines) - 2, "la vague ne redescend pas avant la fin des données")
    exiger(semaines[[d for d, _ in semaines].index(lundi(T0))][1] >= 5, "trop peu de cas détectés la semaine de T0")

    if erreurs:
        sys.exit("Scénario non respecté :\n- " + "\n- ".join(erreurs))
    return {"pz": pz, "premiere": premiere, "visibles": visibles, "semaines": semaines}


def lundi(d: date) -> date:
    return d - timedelta(days=d.weekday())


def courbe(visites: list[Visite]) -> list[tuple[date, int]]:
    """Cas détectés par semaine : première visite avec un test positif de chaque patient."""
    vus, compte = set(), Counter()
    for v in visites:
        if v.test == "positif" and v.patient.id not in vus:
            vus.add(v.patient.id)
            compte[lundi(v.jour)] += 1
    semaines, d = [], lundi(DEBUT)
    while d <= FIN:
        semaines.append((d, compte[d]))
        d = jours(d, 7)
    return semaines


# --- Sorties --------------------------------------------------------------------------------------------

def empreinte(texte: str) -> str:
    return hashlib.sha256(texte.encode("utf-8")).hexdigest()


def masquer(donnees: bytes, cle: str) -> bytes:
    flux = b"".join(hashlib.sha256(f"{cle}:{i}".encode()).digest() for i in range(len(donnees) // 32 + 1))
    return bytes(a ^ b for a, b in zip(donnees, flux))


def chiffrer(texte: str, cle: str) -> str:
    """Masque le bilan par un flux SHA-256 dérivé d'une clé : il ne s'affiche qu'avec la bonne réponse ou le mot
    de passe animateur. js/enquete.js fait l'opération inverse."""
    return base64.b64encode(masquer(texte.encode("utf-8"), cle)).decode()


def dechiffrer(code: str, cle: str) -> str:
    return masquer(base64.b64decode(code), cle).decode("utf-8")


ITERATIONS_ANIMATEUR = 200_000


def cle_animateur(mot_de_passe: str) -> str:
    """Clé du bilan pour l'animateur. PBKDF2 ralentit les essais au hasard sur le fichier publié."""
    derivee = hashlib.pbkdf2_hmac("sha256", mot_de_passe.encode("utf-8"), f"animateur:{SEL}".encode(),
                                  ITERATIONS_ANIMATEUR)
    return "animateur:" + derivee.hex()


def lire_mot_de_passe() -> str:
    if mdp := os.environ.get("MOT_DE_PASSE_ANIMATEUR"):
        return mdp
    if not sys.stdin.isatty():
        sys.exit("Mot de passe animateur manquant : lancez le script dans un terminal, "
                 "ou définissez la variable MOT_DE_PASSE_ANIMATEUR.")
    mdp = getpass.getpass("Mot de passe animateur (ouvre le bilan sans la bonne réponse) : ")
    if len(mdp) < 6:
        sys.exit("Mot de passe trop court : 6 caractères au moins.")
    if getpass.getpass("Confirmez le mot de passe : ") != mdp:
        sys.exit("Les deux saisies diffèrent.")
    return mdp


LEXIQUE = """## Ce que vous avez fait

- **Filtrer une table.** Chaque filtre sur la table Visites retire des lignes. L'entonnoir montre combien il en reste à chaque étape.
- **Relier des tables.** Une visite appartient à un patient et a un compte rendu. On compte les patients à partir des visites retenues.
- **Mesurer sa sélection.** La sensibilité dit quelle part des malades la sélection garde, la spécificité quelle part des non-malades elle écarte. On les pousse toutes deux vers 100 % avant de chercher le patient zéro.
- **Chercher dans du texte libre.** Un signe s'écrit de plusieurs façons (« PRD », « plaques rouges dlr », « ROT abolis ») : il faut prévoir les synonymes et les abréviations.
- **Écarter les négations.** « Pas de PRD » contient « PRD ». Chercher dans la même phrase permet d'écarter les signes niés sans perdre les autres.
- **Croiser les critères.** Un seul signe ne suffit pas : un paludisme donne une forte fièvre, une toxidermie des plaques douloureuses.
- **Remonter le temps.** Le test date du 5 mai, mais le virus circulait depuis mars. L'incubation de 2 à 4 semaines relie chaque malade à celui qui l'a contaminé."""


def bilan_complet(monde: dict, verif: dict) -> str:
    return bilan(monde, verif) + "\n\n" + LEXIQUE


def bilan(monde: dict, verif: dict) -> str:
    pz, premiere = verif["pz"], verif["premiere"]
    proches = [m.patient for m in monde["malades"] if m.generation == 1 and m.patient and m.patient.visites]
    debuts = sorted(m.debut for m in monde["malades"] if m.generation == 1 and m.patient and m.patient.visites)
    avant_t0 = sum(1 for m in verif["visibles"] if m.debut < T0)
    lignes = [
        f"## Le patient zéro est {pz.id}",
        "",
        f"Un homme de {pz.age} ans qui vit à Bordeaux.",
        "",
        "- **Vers le 2 mars 1975**, il séjourne en Karovia pour son travail et y attrape le Nova-virus.",
        "- **Le 8 mars**, il rentre à Bordeaux. Il ne ressent rien : c'est l'incubation, qui dure 2 à 4 semaines.",
        f"- **Le 18 mars**, les premiers signes apparaissent. **Le 19 mars**, il consulte aux urgences du CHU "
        f"Bordeaux (visite {premiere.id}) : 40,6 °C, PRD, ROT abolis, retour de Karovia. Le test n'existe pas "
        "encore : le médecin conclut à un syndrome fébrile éruptif et le renvoie chez lui.",
        "- **Le 24 mars**, il revient, plus grave, et il est hospitalisé.",
        f"- Entre-temps, il a contaminé {len(proches)} proches ({', '.join(p.id for p in proches)}). Ils tombent "
        f"malades entre le {date_fr(debuts[0])} et le {date_fr(debuts[-1])}, 2 à 4 semaines plus tard.",
        f"- **Le 5 mai**, quand le test arrive, {avant_t0} personnes ont déjà été malades sans diagnostic. "
        f"Au 30 juin, on compte {len(verif['visibles'])} malades.",
        "",
        "## Pourquoi c'est lui",
        "",
        "- C'est la première visite qui réunit les trois signes du Nova-virus.",
        "- C'est le seul malade qui revient de Karovia.",
        "- Tous les autres malades sont tombés malades au moins deux semaines après lui.",
    ]
    return "\n".join(lignes)


def missions_attendues(visites: list[Visite]) -> list[tuple[str, int]]:
    """Réponses des missions d'entraînement (js/enquete.js), recalculées ici sans le moteur de recherche."""
    texte = lambda v: " ".join(v.phrases).lower()
    lille_avril = [v for v in visites if v.patient.ville == "Lille" and date(1975, 4, 1) <= v.jour <= date(1975, 4, 30)]
    return [
        ("Visites au CHU Lille en avril 1975", len(lille_avril)),
        ("Patients différents parmi ces visites", len({v.patient.id for v in lille_avril})),
        ("Visites dont le compte rendu contient « chute »", sum(1 for v in visites if re.search(r"\bchute\b", texte(v)))),
        ("Avec « courbatures » ou « myalgies »",
         sum(1 for v in visites if re.search(r"\b(courbatures?|myalgies?)\b", texte(v)))),
        ("« Douleur thoracique » sans négation dans la même phrase", sum(1 for v in visites if "thorax+" in v.marques)),
    ]


def table(colonnes: list[str], lignes: list[list]) -> dict:
    return {"colonnes": colonnes, "lignes": lignes}


def ecrire(monde: dict, verif: dict, mot_de_passe: str) -> None:
    patients, visites, pz = monde["patients"], monde["visites"], verif["pz"]
    malades_ids = sorted(m.patient.id for m in verif["visibles"])
    donnees = {
        "meta": {"debut": DEBUT.isoformat(), "fin": FIN.isoformat(), "t0": T0.isoformat(), "graine": GRAINE},
        "patients": table(["id_patient", "sexe", "age", "ville"],
                          [[p.id, p.sexe, p.age, p.ville] for p in sorted(patients, key=lambda p: p.id)]),
        "visites": table(["id_visite", "id_patient", "date", "hopital", "temperature", "pas", "fc", "test_nova",
                          "diagnostic", "issue"],
                         [[v.id, v.patient.id, v.jour.isoformat(), VILLES[v.patient.ville][0], v.temperature,
                           v.pas, v.fc, v.test, v.diagnostic, v.issue] for v in visites]),
        "cr": table(["id_visite", "medecin", "anamnese"], [[v.id, v.medecin, " ".join(v.phrases)] for v in visites]),
        "verification": {
            "sel": SEL,
            "zero": empreinte(f"zero:{SEL}:{pz.id}"),
            "malades": sorted(empreinte(f"malade:{SEL}:{i}") for i in malades_ids),
            "bilan": chiffrer(bilan_complet(monde, verif), f"bilan:{SEL}:{pz.id}"),
            "bilan_animateur": chiffrer(bilan_complet(monde, verif), cle_animateur(mot_de_passe)),
            "iterations_animateur": ITERATIONS_ANIMATEUR,
        },
    }
    assert dechiffrer(donnees["verification"]["bilan_animateur"], cle_animateur(mot_de_passe)) == bilan_complet(monde, verif)
    texte = "window.DONNEES = " + json.dumps(donnees, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (RACINE / "donnees.js").write_text(texte, encoding="utf-8")

    def ids(condition) -> list[str]:
        return [v.id for v in visites if condition(v)]

    attendu = {
        "temperature_40": ids(lambda v: v.temperature >= 40.0),
        "plaques_forme0": ids(lambda v: {"plaques+0", "plaques-0"} & v.marques),
        "plaques_toutes_formes": ids(lambda v: any(m.startswith("plaques") for m in v.marques)),
        "plaques_affirmees": ids(lambda v: any(m.startswith("plaques+") for m in v.marques)),
        "reflexe_aboli": ids(lambda v: any(m.startswith("reflexe+") for m in v.marques)),
        "karovia": ids(lambda v: "karovia" in v.marques),
        "trois_signes": ids(trois_signes),
        "patient_zero": pz.id,
        "malades": malades_ids,
    }
    attendu["missions"] = missions_attendues(visites)
    # Vecteur de test du chiffrement par mot de passe : vérifie que le navigateur déchiffre comme Python, sans
    # écrire le vrai mot de passe nulle part.
    attendu["vecteur_animateur"] = {"mot_de_passe": "vecteur de test",
                                    "code": chiffrer("## Le patient zéro est P0000", cle_animateur("vecteur de test"))}
    (RACINE / "tests" / "attendu.js").write_text(
        "window.ATTENDU = " + json.dumps(attendu, ensure_ascii=False) + ";\n", encoding="utf-8")

    leurres_avant = [v for v in visites if v.jour < verif["premiere"].jour and v.patient.malade is None
                     and ("karovia" in v.marques or (v.temperature >= 40 and any(m.startswith("plaques+")
                                                                                 for m in v.marques))
                          or {"plaques+2", "reflexe+0"} <= v.marques)]
    solution = [
        "# Solution du jeu Patient Zéro",
        "",
        f"Généré par `generateur/generer.py` (graine {GRAINE}). Ne pas versionner : le dépôt est public.",
        "",
        "Le bilan du jeu s'ouvre avec la bonne réponse, ou avec le mot de passe animateur saisi au lancement du "
        "générateur (il n'est enregistré nulle part).",
        "",
        bilan(monde, verif),
        "",
        "## Leurres placés avant le patient zéro",
        "",
        "| Visite | Patient | Date | Hôpital | T°C | Diagnostic | Ce qui piège |",
        "|---|---|---|---|---|---|---|",
    ]
    for v in leurres_avant:
        piege = ("Karovia et « Pas de PRD » : négation" if "plaques-1" in v.marques
                 else "plaques et fièvre, réflexe présent" if "plaques+0" in v.marques
                 else "plaques et réflexe, fièvre < 40 °C" if "reflexe+0" in v.marques
                 else "voyage en Karovia sans les signes")
        solution.append(f"| {v.id} | {v.patient.id} | {v.jour:%d/%m} | {VILLES[v.patient.ville][0]} | "
                        f"{fr(v.temperature)} | {v.diagnostic} | {piege} |")
    solution += [
        "",
        "## Réponses des missions d'entraînement",
        "",
        "Les missions apprennent les outils sur des sujets sans rapport avec le virus.",
        "",
        *(f"{i}. {libelle} : {n}" for i, (libelle, n) in enumerate(attendu["missions"], 1)),
        "",
        "## Chiffres",
        "",
        f"- {len(patients)} patients, {len(visites)} visites, {len(verif['visibles'])} malades "
        f"({len(attendu['trois_signes'])} visites avec les trois signes).",
        "- Cas détectés par semaine (lundi : nombre) : "
        + ", ".join(f"{d:%d/%m} : {n}" for d, n in verif["semaines"] if n),
    ]
    (RACINE / "docs" / "solution.md").write_text("\n".join(solution) + "\n", encoding="utf-8")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    mot_de_passe = lire_mot_de_passe()
    monde = generer()
    verif = verifier(monde)
    ecrire(monde, verif, mot_de_passe)
    taille = (RACINE / "donnees.js").stat().st_size
    print(f"{len(monde['patients'])} patients, {len(monde['visites'])} visites, {len(verif['visibles'])} malades ; "
          f"patient zéro {verif['pz'].id} ; donnees.js {taille / 1024:.0f} Ko")
    print("Cas détectés par semaine :", " ".join(str(n) for _, n in verif["semaines"]))


if __name__ == "__main__":
    main()
