'use client';

import Link from 'next/link';
import { ArrowRight, BarChart3, MessageSquare, Moon, ShieldCheck, Sun } from 'lucide-react';
import Logo from '@/src/components/logo';
import { Button } from '@/src/components/ui/button';
import { useTheme } from '@/src/components/theme-provider';
import { cn } from '@/src/lib/utils';

const NAV_ITEMS = [
  { href: '#funktionen', label: 'Funktionen' },
  { href: '#workflow', label: 'Workflow' },
  { href: '#datenquellen', label: 'Datenquellen' },
  { href: '#insights', label: 'Insights' },
];

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Kontextuelle Chat-Antworten',
    description:
      'Fuehre komplexe Gespraeche mit deinen Daten und erhalte fundierte Antworten in natuerlicher Sprache.',
  },
  {
    icon: BarChart3,
    title: 'Interaktive Visualisierungen',
    description: 'Erstelle dynamische Charts und Dashboards, die Trends auf Knopfdruck sichtbar machen.',
  },
  {
    icon: ShieldCheck,
    title: 'Governance & Sicherheit',
    description: 'Behalte die volle Kontrolle ueber Berechtigungen, Compliance und die Nutzung deiner Daten.',
  },
];

type WorkflowStep = {
  title: string;
  text: string;
  bullets: string[];
  mockup: 'upload' | 'refine' | 'chat' | 'visualize' | 'compute';
};

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    title: 'Datensaetze hochladen',
    text: 'Ziehe CSVs, XLSX oder verbinde Data Warehouses. SocialAnalysis prueft Schema und Qualitaet automatisch.',
    bullets: [
      'Drag & Drop oder Konnektoren fuer Snowflake, BigQuery und SharePoint',
      'Automatische Profiling-Checks machen fehlende Werte sichtbar',
    ],
    mockup: 'upload',
  },
  {
    title: 'Daten vorbereiten & labeln',
    text: 'Bereinige, kombiniere und annotiere Datensaetze per Low-Code-Editor oder wiederverwendbare Playbooks.',
    bullets: [
      'Filter, Join und Labeln funktionieren ohne SQL-Kenntnisse',
      'Jeder Schritt wird kommentiert und fuer das Team versioniert',
    ],
    mockup: 'refine',
  },
  {
    title: 'Konversationen fuehren',
    text: 'Stelle Fragen in natuerlicher Sprache. Der Assistent erklaert Ergebnisse, verweist auf Quellen und bleibt kontexttreu.',
    bullets: [
      'Antworten mit Zitaten und verlinkten Evidenzen',
      'Folgefragen behalten deine Filter und Segmente bei',
    ],
    mockup: 'chat',
  },
  {
    title: 'Visualisierungen erstellen',
    text: 'Erzeuge Diagramme, Dashboards und Stories aus deinen Prompts oder per Drag & Drop.',
    bullets: [
      'Vorlagen fuer Balken-, Linien- und Kartenvisualisierungen',
      'Teile Ergebnisse als Live-Dashboard oder exportiere Slides',
    ],
    mockup: 'visualize',
  },
  {
    title: 'Komplexe Berechnungen ausfuehren',
    text: 'Lass Forecasts, Clusterings oder KPI-Szenarien rechnen und versioniere Ergebnisse automatisch.',
    bullets: [
      'Python- und SQL-Notebooks laufen direkt im sicheren Workspace',
      'Parameter und Resultate bleiben fuer Audits nachvollziehbar',
    ],
    mockup: 'compute',
  },
];

export default function Home() {
  const { theme, toggleTheme, isReady: isThemeReady } = useTheme();
  const isDark = theme === 'dark';

  const translucentPanel = cn(
    'border transition-colors duration-300 backdrop-blur-sm',
    isDark
      ? 'border-white/10 bg-white/5'
      : 'border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.08)]',
  );

  const solidPanel = cn(
    'border transition-colors duration-300 backdrop-blur-sm',
    isDark
      ? 'border-white/10 bg-slate-950/70'
      : 'border-slate-200 bg-white/95 shadow-[0_18px_50px_rgba(15,23,42,0.08)]',
  );

  const sectionTitle = 'font-heading text-3xl md:text-4xl text-foreground dark:text-white';
  const bodyCopy = 'text-sm md:text-base text-muted-foreground dark:text-slate-300';
  const mockupSurface = cn(
    'relative overflow-hidden rounded-2xl border p-5 text-left shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition-colors duration-300',
    isDark
      ? 'border-white/10 bg-slate-950/80 shadow-[0_20px_45px_rgba(15,23,42,0.45)]'
      : 'border-slate-200 bg-white/95 shadow-[0_20px_45px_rgba(15,23,42,0.08)]',
  );

  const renderMockup = (type: WorkflowStep['mockup']) => {
    switch (type) {
      case 'upload':
        return (
          <div className={mockupSurface}>
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>upload_customer_sentiment.xlsx</span>
              <span>65%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-primary/15">
              <div className="h-2 w-3/5 rounded-full bg-primary" />
            </div>
            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-xs text-primary">
              <span className="font-medium">Dateien hier ablegen</span>
              <span className="text-[11px] text-primary/80">CSV, XLSX, JSON, SQL Dumps</span>
            </div>
            <div className="mt-4 space-y-2 text-[11px] text-muted-foreground">
              <div className="flex items-center justify-between rounded-lg bg-muted/10 px-3 py-2">
                <span>Schema erkannt</span>
                <span className="text-emerald-500">OK</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/10 px-3 py-2">
                <span>Fehlende Werte</span>
                <span className="text-amber-500">12 Hinweise</span>
              </div>
            </div>
          </div>
        );
      case 'refine':
        return (
          <div className={mockupSurface}>
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Transformations-Editor</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                Live
              </span>
            </div>
            <div className="mt-4 space-y-2 text-[11px]">
              <div className="grid grid-cols-[1.5fr,1fr,1fr] gap-2 rounded-lg bg-muted/10 px-3 py-2 font-medium text-muted-foreground">
                <span>Spalte</span>
                <span>Typ</span>
                <span>Aenderung</span>
              </div>
              <div className="grid grid-cols-[1.5fr,1fr,1fr] gap-2 rounded-lg bg-background/60 px-3 py-2 text-muted-foreground dark:bg-slate-900/60">
                <span>Sentiment</span>
                <span>Kategorie</span>
                <span className="text-primary">Label hinzugefuegt</span>
              </div>
              <div className="grid grid-cols-[1.5fr,1fr,1fr] gap-2 rounded-lg bg-background/40 px-3 py-2 text-muted-foreground dark:bg-slate-900/40">
                <span>Tickets</span>
                <span>Integer</span>
                <span className="text-amber-500">Ausreisser markiert</span>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-primary">
              <p className="font-semibold">Playbook: Churn-Analyse</p>
              <p className="mt-1 text-[11px] text-primary/80">1. Filter Region = DACH • 2. Merge CRM Tags • 3. Label Negative Calls</p>
            </div>
          </div>
        );
      case 'chat':
        return (
          <div className={mockupSurface}>
            <div className="space-y-3">
              <div className="flex flex-col gap-2 text-[11px] text-muted-foreground">
                <span className="font-semibold uppercase tracking-[0.28em] text-primary/70">Kontext</span>
                <div className="rounded-xl bg-muted/10 px-3 py-2">
                  Community: HealthTech • Zeitraum: Q3 2025 • Filter: Deutschland
                </div>
              </div>
              <div className="flex flex-col gap-3 text-sm">
                <div className="ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-md shadow-primary/25">
                  Welche Themen trieben die Kundenabwanderung im Juli?
                </div>
                <div className="max-w-[95%] rounded-2xl bg-muted/20 px-4 py-3 text-sm text-muted-foreground dark:bg-slate-900/70 dark:text-slate-200">
                  <p className="font-semibold text-foreground dark:text-white">Assistant</p>
                  <p className="mt-1 text-sm">
                    Wichtigster Faktor war <span className="font-semibold text-foreground dark:text-white">Lieferverzoegerung</span> (+18%).
                    Quelle: <span className="text-primary">[Support Tickets • 674 Eintraege]</span>
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/10 px-3 py-1 text-[11px] uppercase tracking-wide text-primary">
                    Folgefragen vorschlagen
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'visualize':
        return (
          <div className={mockupSurface}>
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Segmentanalyse</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                Vega-Lite
              </span>
            </div>
            <div className="mt-4 grid grid-cols-6 items-end gap-2">
              <div className="h-16 rounded-md bg-primary/20" />
              <div className="h-24 rounded-md bg-primary/30" />
              <div className="h-20 rounded-md bg-primary/50" />
              <div className="h-28 rounded-md bg-primary" />
              <div className="h-14 rounded-md bg-primary/40" />
              <div className="relative h-28 rounded-md bg-gradient-to-t from-primary/20 via-primary/40 to-primary/70">
                <div className="absolute inset-x-1 bottom-12 h-12 rounded-md border border-white/40 bg-white/40 dark:border-white/10 dark:bg-white/5" />
              </div>
            </div>
            <div className="mt-5 rounded-xl bg-muted/10 p-4 text-[11px] text-muted-foreground">
              <p className="font-semibold uppercase tracking-[0.2em] text-primary/70">Story Slide 3</p>
              <p className="mt-1">
                Conversion Rate stieg um 12% nachdem personalisierte Onboarding-Mails live gingen.
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Als Dashboard-Kachel speichern</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                Teilen
              </span>
            </div>
          </div>
        );
      case 'compute':
        return (
          <div className={mockupSurface}>
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Notebook: churn_forecast.ipynb</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-500">
                Erfolgreich
              </span>
            </div>
            <pre className="mt-4 overflow-hidden rounded-xl bg-slate-950/90 p-4 text-[11px] font-mono leading-relaxed text-slate-100 shadow-inner dark:bg-slate-950/80">
{`from ess.notebook import forecast

segments = df.group_by("plan_type")
results = forecast.arima(
    data=segments,
    horizon="6w",
    include_confidence=True,
)`}
            </pre>
            <div className="mt-4 space-y-2 text-[11px]">
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-400">
                <span className="font-semibold uppercase tracking-wide text-emerald-400">Output</span>
                <span>Runtime 4.2s</span>
              </div>
              <div className="rounded-lg bg-muted/10 px-3 py-2 text-muted-foreground">
                <p>Churn-Risiko: <span className="font-semibold text-foreground dark:text-white">-12.4%</span> vs. Vorwoche</p>
                <p>Konfidenzintervall: 88%</p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'relative flex min-h-screen flex-col transition-colors duration-500',
        isDark
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100'
          : 'bg-gradient-to-br from-slate-50 via-white to-slate-200 text-slate-900',
      )}
    >
      <header
        className={cn(
          'sticky top-0 z-50 border-b backdrop-blur transition-colors duration-500',
          isDark
            ? 'border-white/5 bg-slate-950/70'
            : 'border-slate-200/80 bg-white/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]',
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="inline-flex items-center">
            <Logo className="text-base" />
          </Link>
          <nav className="hidden items-center gap-9 text-sm font-medium tracking-wide text-muted-foreground md:flex">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="transition-colors hover:text-primary" scroll>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              disabled={!isThemeReady}
              className="gap-2 text-sm"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? 'Heller Modus' : 'Dunkler Modus'}
            </Button>
            <Button asChild variant="ghost" className="hidden text-sm md:inline-flex">
              <Link href="#kontakt">Kontakt</Link>
            </Button>
            <Button asChild className="text-sm">
              <Link href="/dashboard" className="flex items-center gap-2">
                Zum Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24 pt-20 text-center md:gap-16 md:pt-28">
          <div className="mx-auto max-w-3xl space-y-6">
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]',
                isDark ? 'border-white/10 bg-white/5 text-primary' : 'border-primary/20 bg-primary/10 text-primary',
              )}
            >
              Social Data Intelligence
            </span>
            <h1
              className={cn(
                'font-heading text-4xl leading-tight tracking-tight transition-colors md:text-6xl',
                isDark ? 'text-white' : 'text-foreground',
              )}
            >
              Verstehe soziale Realitaeten mit datengetriebener Praezision.
            </h1>
            <p className="text-base text-muted-foreground md:text-lg">
              SocialAnalysis vereint KI, Visual Analytics und Data Governance in einem Studio. Erkenne Trends, vergleiche
              Narrative und leite Entscheidungen aus Echtzeitdaten ab.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link href="/dashboard" className="flex items-center gap-2">
                Jetzt Demo starten
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className={cn(
                'h-12 px-6 text-base transition-colors',
                isDark
                  ? 'border-white/20 bg-transparent text-white hover:bg-white/10'
                  : 'border-border bg-white/80 text-foreground hover:bg-secondary hover:text-secondary-foreground',
              )}
            >
              <Link href="#funktionen">Mehr erfahren</Link>
            </Button>
          </div>
          <div
            className={cn(
              'grid gap-6 rounded-3xl p-6 text-left transition-colors md:grid-cols-3 md:gap-8 md:p-10',
              translucentPanel,
            )}
          >
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-foreground dark:text-white">{feature.title}</h3>
                  <p className={bodyCopy}>{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section
          id="funktionen"
          className={cn(
            'border-t py-20 transition-colors duration-500',
            isDark ? 'border-white/5 bg-slate-950/60' : 'border-slate-200 bg-white/70',
          )}
        >
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 md:flex-row md:items-start md:gap-16">
            <div className="max-w-sm space-y-4">
              <span className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Funktionen</span>
              <h2 className={sectionTitle}>Alles, was du fuer wirkungsvolle Sozialanalysen brauchst.</h2>
              <p className={bodyCopy}>
                Von explorativen Fragen bis hin zu automatisierten Reports: SocialAnalysis begleitet Teams entlang des
                gesamten Analyseprozesses.
              </p>
            </div>
            <div className="grid flex-1 gap-6">
              <div className={cn('rounded-2xl p-6', translucentPanel)}>
                <h3 className="font-heading text-lg text-foreground dark:text-white">Conversational Analytics</h3>
                <p className={cn('mt-2', bodyCopy)}>
                  Interagiere mit deinen Datensaetzen wie mit einem Kollegenteam. Die KI fasst Muster zusammen, stellt
                  Rueckfragen und liefert nachvollziehbare Antworten.
                </p>
              </div>
              <div className={cn('rounded-2xl p-6', translucentPanel)}>
                <h3 className="font-heading text-lg text-foreground dark:text-white">Visual Storytelling</h3>
                <p className={cn('mt-2', bodyCopy)}>
                  Kombiniere Diagramme, Heatmaps und Zeitreihen zu lebendigen Stories, die du mit Stakeholdern teilen
                  kannst.
                </p>
              </div>
              <div className={cn('rounded-2xl p-6', translucentPanel)}>
                <h3 className="font-heading text-lg text-foreground dark:text-white">Team Collaboration</h3>
                <p className={cn('mt-2', bodyCopy)}>
                  Teile Konversationen, sichere Versionen deiner Analysen und arbeite in gemeinsamen Dashboards weiter.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="workflow"
          className={cn(
            'border-t py-20 transition-colors duration-500',
            isDark ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-slate-50/80',
          )}
        >
          <div className="mx-auto w-full max-w-5xl px-6 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Workflow</span>
            <h2 className={cn('mt-4', sectionTitle)}>Von Rohdaten zu handlungsrelevanten Entscheidungen.</h2>
            <p className={cn('mx-auto mt-4 max-w-2xl', bodyCopy)}>
              Von Upload bis Forecast: Die folgenden Schritte zeigen, wie du Datensaetze importierst, vorbereitest,
              analysierst und Ergebnisse sofort veredelst. Alles geschieht in einem konsistenten Workspace.
            </p>
            <div className="mt-12 space-y-8">
              {WORKFLOW_STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className={cn(
                    'relative overflow-hidden rounded-3xl px-6 py-8 text-left transition-colors duration-500 md:px-10 md:py-12',
                    solidPanel,
                  )}
                >
                  <div className="grid gap-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:items-start">
                    <div className="space-y-5">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/50 bg-primary/10 font-heading text-base font-semibold text-primary">
                        0{index + 1}
                      </span>
                      <div className="space-y-3">
                        <h3 className="font-heading text-xl text-foreground dark:text-white">{step.title}</h3>
                        <p className={bodyCopy}>{step.text}</p>
                      </div>
                      <ul className="space-y-2 text-sm">
                        {step.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-2 text-left">
                            <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                            <span className="text-sm text-muted-foreground dark:text-slate-300">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center justify-center">
                      {renderMockup(step.mockup)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="datenquellen"
          className={cn(
            'border-t py-20 transition-colors duration-500',
            isDark ? 'border-white/5 bg-slate-950/80' : 'border-slate-200 bg-slate-100/70',
          )}
        >
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 md:flex-row md:items-center md:gap-16">
            <div className="flex-1 space-y-4">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Datenquellen</span>
              <h2 className={sectionTitle}>
                Verbinde Social Media, Umfragen, interne Daten und externe Studien.
              </h2>
              <p className={bodyCopy}>
                SocialAnalysis unterstuetzt strukturierte und unstrukturierte Quellen. Dank semantischer Indizierung
                findest du spannende Narrative und erkennst Muster schneller.
              </p>
            </div>
            <ul className="flex-1 space-y-3 text-sm">
              <li className={cn('rounded-xl px-5 py-4 transition-colors', translucentPanel)}>
                Social Listening Streams: Twitter, Mastodon, YouTube, TikTok und mehr.
              </li>
              <li className={cn('rounded-xl px-5 py-4 transition-colors', translucentPanel)}>
                Forschungsdaten: Befragungen, Fokusgruppen, qualitative Interviews.
              </li>
              <li className={cn('rounded-xl px-5 py-4 transition-colors', translucentPanel)}>
                Unternehmensdaten: CRM, Wissensdatenbanken, Support-Tickets, interne Kommunikation.
              </li>
              <li className={cn('rounded-xl px-5 py-4 transition-colors', translucentPanel)}>
                Offene Datenquellen: Statistische Aemter, NGO-Reports, wissenschaftliche Publikationen.
              </li>
            </ul>
          </div>
        </section>

        <section
          id="insights"
          className={cn(
            'border-t py-20 transition-colors duration-500',
            isDark ? 'border-white/5 bg-white/5' : 'border-slate-200 bg-white/70',
          )}
        >
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-6 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Insights</span>
            <h2 className={sectionTitle}>
              KI-gestuetzte Analysen, die deine Entscheidungsfindung beschleunigen.
            </h2>
            <p className={cn('max-w-2xl', bodyCopy)}>
              Identifiziere Risiken fruehzeitig, beobachte Stimmungen in Communities und uebersetze Erkenntnisse direkt
              in Massnahmen. SocialAnalysis liefert nachvollziehbare Erklaerungen fuer jedes Insight.
            </p>
            <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
              <div className={cn('rounded-2xl p-6 text-left', solidPanel)}>
                <h3 className="font-heading text-lg text-foreground dark:text-white">Narrative Detection</h3>
                <p className={cn('mt-3', bodyCopy)}>
                  Entdecke, welche Storylines in deiner Zielgruppe entstehen und wie sie sich ueber Zeit veraendern.
                </p>
              </div>
              <div className={cn('rounded-2xl p-6 text-left', solidPanel)}>
                <h3 className="font-heading text-lg text-foreground dark:text-white">Impact Forecasting</h3>
                <p className={cn('mt-3', bodyCopy)}>
                  Schaetze ein, welche Handlungsalternativen zu den groessten Effekten fuehren - transparent und
                  nachvollziehbar.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="kontakt"
          className={cn(
            'border-t py-20 transition-colors duration-500',
            isDark ? 'border-white/5 bg-slate-950' : 'border-slate-200 bg-white',
          )}
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 text-center">
            <h2 className={sectionTitle}>Bereit, soziale Dynamiken neu zu verstehen?</h2>
            <p className={cn('max-w-2xl', bodyCopy)}>
              Starte mit unserer Demo, buche einen Workshop oder vernetze dich mit unserem Team. Wir begleiten dich von
              der Strategie bis zur Umsetzung.
            </p>
            <div className="flex flex-col gap-4 md:flex-row">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link href="/dashboard">Demo starten</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className={cn(
                  'h-12 px-6 text-base transition-colors',
                  isDark
                    ? 'border-white/20 bg-transparent text-white hover:bg-white/10'
                    : 'border-border bg-white/80 text-foreground hover:bg-secondary hover:text-secondary-foreground',
                )}
              >
                <Link href="mailto:hello@socialanalysis.ai">Gespraech vereinbaren</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer
        className={cn(
          'border-t py-6 text-sm transition-colors duration-500',
          isDark ? 'border-white/10 bg-slate-950/90 text-slate-400' : 'border-slate-200 bg-white/90 text-muted-foreground',
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <p>Copyright {new Date().getFullYear()} SocialAnalysis. Alle Rechte vorbehalten.</p>
          <div className="flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="transition-colors hover:text-primary">
                {item.label}
              </Link>
            ))}
            <Link href="/impressum" className="transition-colors hover:text-primary">
              Impressum
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
