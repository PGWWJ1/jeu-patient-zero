"""Met à jour les numéros de version des fichiers chargés par index.html.

    python generateur/versions.py

Chaque fichier local de la page (style.css, donnees.js, js/*.js) reçoit un numéro tiré de son contenu :
« donnees.js?v=3f2a91c0 ». Quand un fichier change, son adresse change aussi, et les navigateurs téléchargent la
nouvelle version au lieu de garder l'ancienne en cache. À lancer avant de publier une modification du code ;
generer.py le lance lui-même après avoir écrit donnees.js.
"""
from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
REFERENCE = re.compile(r'(?P<attribut>src|href)="(?P<chemin>(?!https?:|//)[^"?#]+\.(?:js|css))(?:\?v=[0-9a-f]*)?"')


def version(chemin: Path) -> str:
    # Les fins de ligne ne comptent pas : git les convertit selon le poste, le site publie celles du dépôt.
    return hashlib.sha256(chemin.read_bytes().replace(b"\r\n", b"\n")).hexdigest()[:8]


def mettre_a_jour() -> list[str]:
    """Réécrit index.html avec les numéros à jour ; renvoie les fichiers dont le numéro a changé."""
    page = RACINE / "index.html"
    html = page.read_bytes().decode("utf-8")
    changes = []

    def numeroter(m: re.Match) -> str:
        reference = f'{m["attribut"]}="{m["chemin"]}?v={version(RACINE / m["chemin"])}"'
        if reference != m[0]:
            changes.append(m["chemin"])
        return reference

    nouveau = REFERENCE.sub(numeroter, html)
    if nouveau != html:
        page.write_bytes(nouveau.encode("utf-8"))
    return changes


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    changes = mettre_a_jour()
    print("Numéros de version mis à jour : " + ", ".join(changes) if changes else "Numéros de version déjà à jour.")
