// Mustache-style token replacement for narrative popups.
//
// Supported tokens:
//   {{prospectName}}      — prospect.name
//   {{prospectLocation}}  — prospect.location
//   {{prospectContext}}   — prospect.context
//
// Rules:
//   - Unknown tokens pass through unchanged (so we never silently drop
//     content the user intended)
//   - Missing values → empty string (a leading "Welcome to 's bar" reads
//     worse than letting the render surface a soft gap; we trade one
//     kind of ugly for another. Generator validates prospect.name is
//     non-empty before calling, so this should never fire in practice.)
//   - HTML-escape values before substitution — narrative body is HTML,
//     so a prospect name like "Matty & Co" would otherwise break markup

import type { ObjectIdString } from '../types/upstream.js';

export interface ProspectContext {
  name: string;
  location?: string;
  context?: string;
}

export interface NarrativeCta {
  text: string;
  url: string;
}

export interface NarrativePopupSpec {
  title: string;
  body: string;
  alignment?: 'center' | 'left' | 'right';
  showOverlay?: boolean;
  cta?: NarrativeCta;
}

export interface NarrativeEntry {
  screenIndex: number;
  popup: NarrativePopupSpec;
}

export interface RenderedPopup {
  title: string;
  description: string; // HTML
  alignment: 'center' | 'left' | 'right';
  showOverlay: boolean;
  buttons: Array<{
    index: number;
    text: string;
    gotoType: 'website' | 'next';
    gotoWebsite?: string;
    textColor?: string;
    backgroundColor?: string;
  }>;
}

export interface Defaults {
  ctaUrl?: string;
  ctaText?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTemplate(tpl: string, prospect: ProspectContext): string {
  const values: Record<string, string> = {
    prospectName: escapeHtml(prospect.name ?? ''),
    prospectLocation: escapeHtml(prospect.location ?? ''),
    prospectContext: escapeHtml(prospect.context ?? ''),
  };
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    if (key in values) return values[key] ?? '';
    return match; // unknown token — pass through
  });
}

/**
 * Render a narrative entry into a popup spec ready to ship to PATCH /steps.
 * The shape matches ScreenStep.view.popup (see docs/upstream-data-model.md).
 */
export function renderPopup(
  entry: NarrativeEntry,
  prospect: ProspectContext,
  defaults: Defaults = {},
  nextScreenId?: ObjectIdString,
): RenderedPopup {
  const { popup } = entry;
  const cta = popup.cta ?? (defaults.ctaUrl && defaults.ctaText
    ? { text: defaults.ctaText, url: defaults.ctaUrl }
    : null);

  const title = renderTemplate(popup.title, prospect);
  const description = renderTemplate(popup.body, prospect);

  const buttons: RenderedPopup['buttons'] = [];
  if (cta) {
    buttons.push({
      index: 0,
      text: renderTemplate(cta.text, prospect),
      gotoType: 'website',
      gotoWebsite: cta.url,
      textColor: '#FFFFFF',
      backgroundColor: '#0A1420', // DK navy — see ~/.claude/skills/dk-brand
    });
  } else if (nextScreenId) {
    // No CTA and we're not the last screen — default to "Next"
    buttons.push({
      index: 0,
      text: 'Next',
      gotoType: 'next',
    });
  }

  return {
    title,
    description,
    alignment: popup.alignment ?? 'center',
    showOverlay: popup.showOverlay ?? true,
    buttons,
  };
}
