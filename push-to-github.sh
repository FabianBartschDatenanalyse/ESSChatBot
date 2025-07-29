#!/bin/bash

# =============================================================================
#  Anleitung zum Pushen Ihres Codes auf GitHub
# =============================================================================
#
# 1. Erstellen Sie ein neues, leeres Repository auf GitHub.
#    (https://github.com/new)
#
# 2. Kopieren Sie die HTTPS-URL Ihres neuen Repositorys.
#
# 3. Fügen Sie die URL unten in die Variable GITHUB_URL ein.
#    Ersetzen Sie den Platzhalter "IHRE_GITHUB_REPOSITORY_URL_HIER".
#
# 4. Speichern Sie diese Datei.
#
# 5. Machen Sie dieses Skript in Ihrem Terminal ausführbar mit dem Befehl:
#    chmod +x push-to-github.sh
#
# 6. Führen Sie das Skript mit diesem Befehl aus:
#    ./push-to-github.sh
#
# =============================================================================

# --- BEARBEITEN SIE DIESE ZEILE ---
GITHUB_URL="IHRE_GITHUB_REPOSITORY_URL_HIER"

# --- AB HIER NICHTS MEHR ÄNDERN ---

if [ "$GITHUB_URL" == "IHRE_GITHUB_REPOSITORY_URL_HIER" ]; then
  echo "Fehler: Bitte bearbeiten Sie die Datei 'push-to-github.sh' und ersetzen Sie den Platzhalter 'IHRE_GITHUB_REPOSITORY_URL_HIER' mit Ihrer tatsächlichen GitHub-Repository-URL."
  exit 1
fi

# Initialisiert ein neues Git-Repository, falls noch keines existiert.
if [ ! -d .git ]; then
  echo "Initialisiere neues Git-Repository..."
  git init
else
  echo "Git-Repository existiert bereits."
fi

echo "Füge alle Dateien zum Staging-Bereich hinzu..."
git add .

echo "Erstelle den ersten Commit..."
# Prüfen, ob bereits ein Commit existiert
if git rev-parse -q --verify HEAD >/dev/null; then
  echo "Ein Commit existiert bereits. Erstelle einen neuen Commit mit aktuellen Änderungen."
  git commit -m "Aktuelle Änderungen committen"
else
  git commit -m "Erster Commit: Projektinitialisierung"
fi

echo "Setze den Haupt-Branch auf 'main'..."
git branch -M main

echo "Füge das Remote-Repository hinzu..."
# Entfernen des 'origin'-Remotes, falls es bereits existiert, um Fehler zu vermeiden.
git remote remove origin 2>/dev/null
git remote add origin $GITHUB_URL

echo "Pushe den Code auf GitHub..."
git push -u origin main

echo "✅ Fertig! Ihr Code wurde erfolgreich auf GitHub gepusht."
echo "Sie können Ihr Repository hier einsehen: $GITHUB_URL"

