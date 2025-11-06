
# SocialAnalysis: AI-Augmented Social Data Studio

SocialAnalysis ist ein Research-Copilot fuer gesellschaftliche Datensaetze. Statt komplexer SQL-Queries formulierst du Fragen in Alltagssprache, der Copilot analysiert das verbundene Dataset, fuehrt statistische Verfahren aus und liefert verstaendliche Einsichten inklusive Visualisierung, SQL-Statements und Kontext aus Codebooks.

## Core Capabilities

- **Natural Language Analytics**: Stelle deine Frage in Englisch oder Deutsch. Der Assistant reformuliert Folgefragen kontextsensitiv, erzeugt SQL oder startet eine Regression und fuegt das Resultat als Chat-Antwort ein.
- **Transparent Antworten**: Jede Antwort kann die generierte SQL-Query sowie das aus dem Codebook geholte Kontextmaterial im Detailpane anzeigen. Markdown, Tabellen und eingebettete PNG-Charts werden im Chat sauber gerendert.
- **Statistical Modelling**: The assistant runs linear and non-linear regressions, Welch t-tests for group comparisons, and returns model KPIs, coefficient tables, confidence intervals, and diagnostics in a structured format.
- **Interactive Charting**: Visualisierungen werden mit Vega/Vega-Lite gerendert, sind responsiv und lassen sich direkt im UI bearbeiten oder via Vega-Editor oeffnen. Charts koennen als PNG exportiert werden.
- **Dataset Lifecycle Management**: CSV-Dateien lassen sich hochladen, Metadaten (Titel, Notizen, Gewichtung) anpassen, Spalten beschreiben, Value Labels und Missing Codes pflegen sowie Sample-Rows direkt im Browser inspizieren.
- **Session Handling & UI Comfort**: Mehrere Konversationen pro Dataset, automatische Session-Benennung, History-Navigation, Theme-Toggle (Light/Dark) und Metrik-Kacheln sorgen fuer Orientierung.

## User Experience at a Glance

### Dashboard & Sessions

- Sidebar mit Logo, KPI-Kacheln, Konversationsliste und Schnellstart fuer neue Sessions.
- Header-Actions fuer Refresh, Theme-Wechsel und Deeplink in die Dataset-Verwaltung (`/datasets/manage` in neuem Fenster).
- Automatische Dataset-Kopplung an aktive Konversation, inklusive Fallback-Hinweisen wenn kein Dataset ausgewaehlt ist.

### Ask-AI Panel

- Formular mit Dataset-Dropdown, Validierung und Loading-States.
- Chat-Rendering mit Avataren, Markdown-Unterstuetzung (u.a. Tabellen, Code, Links, Inline-Bilder/Base64-Charts).
- Vega-Charts im `ChartShell` mit Edit-Dialog (JSON-Spezifikation), Vega-Editor-Shortcut und Download-Button.
- Accordion fuer SQL-Statement, Context-Snippets und statistische Ergebnisse (`RegressionSummary`).
- Fehlerbehandlung und Fallback-Antworten bei API-Issues.

### Dataset Studio (`/datasets/manage`)

- CSV-Upload inklusive Statusmeldungen, automatischer Schema-Erkennung und Reset-Moeglichkeit.
- Detailkonfiguration pro Dataset: Titel, Notes, Default Missing Values, Gewichtsvariable.
- Spalteneditor mit Display-Name, Beschreibung, Datentyp, Skalenniveau, Value Labels und Spalten-Missing Codes.
- Preview-Table der ersten Zeilen, um Datenqualitaet direkt zu checken.
- Aktionen zum Speichern, Dataset loeschen und Feedback zu Erfolgen/Fehlern.
- Optionales Codebook: Lade beim Upload eine zweite Datei mit Variablen-Metadaten hoch. Fehlt sie, werden Spezifikationen wie gewohnt automatisch aus dem Rohdatensatz abgeleitet.

### Column Metadata Upload

- Akzeptierte Formate: JSON (empfohlen) oder CSV. Beide muessen eine Zeile/Eintrag pro Spalte enthalten.
- `dataType` Unterstuetzung: `string`, `number`, `boolean`, `date`. Synonyme wie `numeric` oder `int` werden automatisch gemappt.
- `measurementLevel` Werte: `nominal`, `ordinal`, `metric`. Auch `scale`, `interval` oder `ratio` werden auf `metric` gemappt.
- Optional: `valueLabels` (kommagetrennt, z.B. `1=Ja,2=Nein`), `missingValues`, `isWeight` (markiert Gewichtsvariable), `defaultMissingValues` und `notes` auf Dataset-Ebene.

**JSON Beispiel**

```json
{
  "defaultMissingValues": ["77", "88", "99"],
  "weightColumn": "dweight",
  "notes": "Original ESS Codebook wurde uebernommen.",
  "columns": [
    {
      "name": "tvpol",
      "displayName": "TV Politik (min)",
      "description": "Zeit fuer politische TV-Inhalte pro Werktag",
      "dataType": "number",
      "measurementLevel": "metric",
      "valueLabels": ["0=Keine Zeit", "1440=24h"],
      "missingValues": ["77", "88"]
    },
    {
      "name": "cntry",
      "dataType": "string",
      "measurementLevel": "nominal",
      "valueLabels": ["AT=Austria", "DE=Germany", "CH=Switzerland"]
    }
  ]
}
```

**CSV Beispiel**

```csv
name,displayName,dataType,measurementLevel,valueLabels,missingValues,is_weight
tvpol,TV Politik,number,metric,"0=Keine Zeit;1440=24h","77;88",
dweight,,number,metric,,,"true"
```

Wird keine Metadaten-Datei hochgeladen, bleibt der Workflow unveraendert: Datentypen, Missing Codes und Skalenniveaus werden aus dem Rohdatensatz inferiert und koennen anschliessend im Studio ueberarbeitet werden.

## Analytical Workflow

1. **User Input & Reformulation**  
   Die Eingabe startet im `AskAiPanel`. Die Frage samt Verlauf landet in `mainAssistant`, der mithilfe des `mainAssistantFlow` Follow-up-Fragen in vollstaendige Prompts ueberfuehrt.

2. **Context Retrieval (RAG)**  
   `searchCodebook` embeddert die Anfrage, durchsucht die pgvector-Collection mit Codebook-Chunks und liefert relevante Beschreibungen (z.B. fuer Variablen wie `trstprl` oder `cntry`).

3. **SQL oder Statistik**  
   - *SQL-Pfad*: `suggestSqlQueryFlow` erzeugt eine valide Query, `executeQueryTool` leitet sie an den `data-service` weiter, der via Supabase-RPC (`execute_safe_query`) nur `SELECT`-Statements ausfuehrt.  
   - *Analyse-Pfad*: `statisticsTool` plant das Modell (Targets, Features, Filter), holt Rohdaten und fuehrt Regressionsverfahren in Node.js (z.B. Multivariate Linear Regression) aus.

4. **Answer Synthesis & UI**  
   Das LLM bekommt Daten, SQL, Kontext und erzeugt eine gut lesbare Antwort. Der Client zeigt Antwort, Chart, Statistik-Block sowie optional SQL & Kontext an – alles in der gleichen Chatnachricht.

## Technology Stack

- **Frontend**: Next.js, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **AI Orchestration**: Google Genkit
- **LLM Provider**: OpenAI (GPT-4o)
- **Database**: Supabase (PostgreSQL + pgvector)
- **Vector Embeddings**: OpenAI `text-embedding-3-small`

SocialAnalysis vereint damit explorative Datenanalyse, transparente KI-Unterstuetzung und ein Dataset-Studio in einer Anwendung.


