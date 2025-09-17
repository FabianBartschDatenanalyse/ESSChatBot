#!/bin/bash

# =============================================================================
#  Anleitung zum Pushen Ihres Codes auf GitHub in einen neuen Branch
# =============================================================================
#
# 1. Erstellen Sie ein neues, leeres Repository auf GitHub.
#    (https://github.com/new)
#
# 2. Kopieren Sie die HTTPS-URL Ihres neuen Repositorys.
#
# 3. Fügen Sie die URL unten in die Variable GITHUB_URL ein.
#
# 4. Wählen Sie den gewünschten Branch-Namen in der Variable BRANCH_NAME.
#
# 5. Machen Sie dieses Skript ausführbar:
#    chmod +x push-to-github.sh
#
# 6. Führen Sie das Skript aus:
#    ./push-to-github.sh
#
# =============================================================================

# --- BEARBEITEN SIE DIESE ZEILEN ---
GITHUB_URL="https://github.com/FabianBartschDatenanalyse/ESSChatBot.git"
BRANCH_NAME="codex"   # <--- gewünschten Branch-Namen hier eintragen

# --- AB HIER NICHTS MEHR ÄNDERN ---

if [ "$GITHUB_URL" == "IHRE_GITHUB_REPOSITORY_URL_HIER" ]; then
  echo "Fehler: Bitte bearbeiten Sie die Datei 'push-to-github.sh' und ersetzen Sie den Platzhalter durch Ihre GitHub-Repository-URL."
  exit 1
fi

# Initialisiere Git, falls nicht vorhanden
if [ ! -d .git ]; then
  echo "Initialisiere neues Git-Repository..."
  git init
else
  echo "Git-Repository existiert bereits."
fi

echo "Füge alle Dateien zum Staging-Bereich hinzu..."
git add .

echo "Committe Änderungen..."
if git rev-parse -q --verify HEAD >/dev/null; then
  git commit -m "Aktuelle Änderungen committen"
else
  git commit -m "Erster Commit: Projektinitialisierung"
fi

echo "Wechsle auf Branch '$BRANCH_NAME'..."
git checkout -B "$BRANCH_NAME"

echo "Füge das Remote-Repository hinzu..."
git remote remove origin 2>/dev/null
git remote add origin "$GITHUB_URL"

echo "Pushe den Code auf GitHub (Branch: $BRANCH_NAME)..."
git push -u origin "$BRANCH_NAME"

echo "✅ Fertig! Ihr Code wurde erfolgreich auf GitHub gepusht."
echo "Sie können Ihr Repository hier einsehen: $GITHUB_URL"
