#!/bin/bash

# ===================================================================================
#  Skript zur Wiederherstellung des Projekts aus einem GitHub-Repository
# ===================================================================================
#
#  Dieses Skript klont ein von Ihnen angegebenes GitHub-Repository und
#  überschreibt die Dateien im aktuellen Verzeichnis mit dem Inhalt des Repos.
#
#  WARNUNG: Alle nicht gespeicherten lokalen Änderungen in diesem Verzeichnis
#           werden überschrieben.
#
# ===================================================================================

# Farben für die Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Dieses Skript wird das Projekt aus Ihrem GitHub-Repository wiederherstellen."
echo -e "WARNUNG: Alle aktuellen, nicht comitteten Änderungen werden überschrieben.${NC}"
echo ""

# Abfrage der Repository-URL
read -p "Bitte geben Sie die HTTPS-URL Ihres GitHub-Repositorys ein und drücken Sie Enter: " GITHUB_URL

# Überprüfen, ob eine URL eingegeben wurde
if [ -z "$GITHUB_URL" ]; then
    echo -e "${RED}Fehler: Es wurde keine URL eingegeben. Abbruch.${NC}"
    exit 1
fi

# Überprüfen, ob git installiert ist
if ! command -v git &> /dev/null; then
    echo -e "${RED}Fehler: 'git' ist nicht installiert. Bitte installieren Sie Git und versuchen Sie es erneut.${NC}"
    exit 1
fi

# Temporäres Verzeichnis erstellen
TEMP_DIR=$(mktemp -d)
echo "Temporäres Verzeichnis erstellt unter: $TEMP_DIR"

# Klonen des Repositories
echo "Klone das Repository von $GITHUB_URL..."
git clone --depth 1 --branch main "$GITHUB_URL" "$TEMP_DIR"
if [ $? -ne 0 ]; then
    echo -e "${RED}Fehler: Klonen des Repositorys fehlgeschlagen. Überprüfen Sie die URL und Ihre Berechtigungen.${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Bestätigung vor dem Überschreiben
read -p "Sind Sie sicher, dass Sie die aktuellen Dateien überschreiben möchten? (j/n): " confirm
if [[ "$confirm" != [jJ] && "$confirm" != [jJ][aA] ]]; then
    echo "Abbruch durch Benutzer."
    rm -rf "$TEMP_DIR"
    exit 0
fi

# Kopieren der Dateien aus dem geklonten Repo in das aktuelle Verzeichnis
# -a: Archivmodus (behält Berechtigungen, etc.)
# -v: Ausführliche Ausgabe (zeigt, was kopiert wird)
# Der Punkt am Ende des Quellpfades ist wichtig, um auch versteckte Dateien (wie .gitignore) zu kopieren.
echo "Kopiere Dateien aus dem geklonten Repository in das aktuelle Verzeichnis (ohne rsync)..."

# .git-Verzeichnis im Temp-Verzeichnis löschen, damit es nicht mitkopiert wird
rm -rf "$TEMP_DIR/.git"

# Dateien rekursiv und überschreibend kopieren
shopt -s dotglob nullglob
cp -r "$TEMP_DIR/"* "$PWD"
shopt -u dotglob nullglob

if [ $? -ne 0 ]; then
    echo -e "${RED}Fehler: Kopieren der Dateien fehlgeschlagen.${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Aufräumen
echo "Bereinige temporäre Dateien..."
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✅ Wiederherstellung erfolgreich abgeschlossen!${NC}"
echo "Ihr Projekt wurde auf den Stand des GitHub-Repositorys zurückgesetzt."
echo "Es wird empfohlen, den 'npm install' oder 'yarn install' Befehl auszuführen, um sicherzustellen, dass alle Abhängigkeiten korrekt sind."

exit 0
