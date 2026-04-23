export type DemoTier = 'monitor' | 'execute' | 'command';
export type StepType = 'tooltip' | 'callout' | 'popup' | 'zoom';

export interface TemplateStep {
  title: string;
  annotation: string;
  type: StepType;
  screen_hint: string;
}

export interface CoreTapTemplate {
  id: string;
  name: string;
  description: string;
  tier: DemoTier;
  feature_focus: string[];
  steps: TemplateStep[];
}

export const CORETAP_TEMPLATES: CoreTapTemplate[] = [
  {
    id: 'coretap-overview',
    name: 'CoreTAP Overview',
    description: 'High-level walkthrough of the CoreTAP platform across all tiers.',
    tier: 'monitor',
    feature_focus: ['dashboard', 'golden-hours', 'revenue', 'voids', 'staff'],
    steps: [
      {
        title: 'Welcome to [BAR_NAME] Command Center',
        annotation: 'This is your nightly cockpit — the dashboard you open at 11pm to see how [BAR_NAME] performed today.',
        type: 'callout',
        screen_hint: 'CoreTAP main dashboard landing screen',
      },
      {
        title: 'Golden Hours Widget',
        annotation: 'Most bars make 60% of their revenue in just 3 hours. Here is yours, live.',
        type: 'tooltip',
        screen_hint: 'Golden Hours card on dashboard, top-left',
      },
      {
        title: 'Revenue Pulse',
        annotation: 'Real-time revenue ticker — see [BAR_NAME] hit its number before close.',
        type: 'tooltip',
        screen_hint: 'Revenue pulse chart, hero section',
      },
      {
        title: 'Void Alerts Badge',
        annotation: 'Red badge = suspicious voids that need your eyes tonight.',
        type: 'callout',
        screen_hint: 'Void alerts notification badge in nav',
      },
      {
        title: 'Employee Performance Ring',
        annotation: 'A–D grades on every bartender. Spot tonight is winning. Spot who is leaking margin.',
        type: 'tooltip',
        screen_hint: 'Employee performance ring chart',
      },
      {
        title: 'Start Your Free Trial',
        annotation: 'See [BAR_NAME] in CoreTAP within 48 hours. No credit card.',
        type: 'popup',
        screen_hint: 'CTA modal with pricing tiers',
      },
    ],
  },
  {
    id: 'coretap-golden-hours',
    name: 'Golden Hours Deep Dive',
    description: 'Show prospects exactly how Golden Hours analytics surface revenue concentration.',
    tier: 'monitor',
    feature_focus: ['golden-hours', 'reporting'],
    steps: [
      {
        title: 'Open Golden Hours',
        annotation: 'Navigate from the dashboard to the Golden Hours module.',
        type: 'tooltip',
        screen_hint: 'Sidebar nav highlighting Golden Hours item',
      },
      {
        title: '3-Hour Peak Window',
        annotation: 'Visualized: the 3-hour window where [BAR_NAME] makes most of its money.',
        type: 'zoom',
        screen_hint: 'Heatmap of hourly revenue, peak window highlighted',
      },
      {
        title: 'Day-Over-Day Comparison',
        annotation: 'Compare Friday Golden Hours week-over-week — is your peak growing or shrinking?',
        type: 'callout',
        screen_hint: 'DoD comparison line chart',
      },
      {
        title: 'Your Bar Makes 60% in 3 Hours',
        annotation: '[PAIN_POINT]. Golden Hours is where you win or lose the night.',
        type: 'popup',
        screen_hint: 'Insight callout overlay',
      },
      {
        title: 'Export Report',
        annotation: 'One-click PDF for your weekly ops meeting.',
        type: 'tooltip',
        screen_hint: 'Export button in top-right',
      },
      {
        title: 'Upgrade for Live Alerts',
        annotation: 'Execute tier sends real-time Slack alerts when peak performance dips.',
        type: 'popup',
        screen_hint: 'Upgrade CTA modal',
      },
    ],
  },
  {
    id: 'coretap-void-detection',
    name: 'Void Detection Walkthrough',
    description: 'Demonstrate AI-powered void pattern detection for loss prevention.',
    tier: 'execute',
    feature_focus: ['voids', 'loss-prevention', 'staff'],
    steps: [
      {
        title: 'Void Alerts Dashboard',
        annotation: 'Every void at [BAR_NAME], scored for risk in real time.',
        type: 'callout',
        screen_hint: 'Void Alerts main dashboard',
      },
      {
        title: 'Filter by Employee',
        annotation: 'Drill into a specific bartender. Patterns become obvious fast.',
        type: 'tooltip',
        screen_hint: 'Employee filter dropdown',
      },
      {
        title: 'Suspicious Pattern Detected',
        annotation: 'AI flagged 14 voids on the same tab number across 3 shifts. That is not a coincidence.',
        type: 'popup',
        screen_hint: 'Pattern detection overlay with flagged transactions',
      },
      {
        title: 'Dollar Amount at Risk',
        annotation: '$2,400/mo leaking from this one pattern alone. [PAIN_POINT].',
        type: 'callout',
        screen_hint: 'Risk dollar value summary card',
      },
      {
        title: 'Investigation Workflow',
        annotation: 'Assign, comment, close. Full audit trail built-in.',
        type: 'tooltip',
        screen_hint: 'Investigation case panel',
      },
      {
        title: 'Manager Notification',
        annotation: 'Push to phone the second a Tier-1 pattern hits. No more morning surprises.',
        type: 'popup',
        screen_hint: 'Mobile notification mockup',
      },
    ],
  },
  {
    id: 'coretap-employee-grading',
    name: 'Employee Grading System',
    description: 'A–D grading grid for staff performance with trend analysis.',
    tier: 'execute',
    feature_focus: ['staff', 'grading', 'performance'],
    steps: [
      {
        title: 'Staff Performance Module',
        annotation: 'Every employee at [BAR_NAME] graded across speed, upsell, voids, and tips.',
        type: 'callout',
        screen_hint: 'Staff Performance landing page',
      },
      {
        title: 'A–D Grading Grid',
        annotation: 'One screen, every shift, every grade. No more guessing who is carrying the bar.',
        type: 'zoom',
        screen_hint: 'Grading grid with color-coded letter grades',
      },
      {
        title: 'Top Performer',
        annotation: 'Sarah is your A+. Schedule her on Golden Hours.',
        type: 'tooltip',
        screen_hint: 'Top performer highlight card',
      },
      {
        title: 'Underperformer Flag',
        annotation: 'Mike has trended D for 3 weeks. Time for a conversation.',
        type: 'callout',
        screen_hint: 'Underperformer flag with trend sparkline',
      },
      {
        title: '30-Day Trend',
        annotation: 'Performance is a trajectory, not a snapshot.',
        type: 'tooltip',
        screen_hint: 'Trend chart over 30 days',
      },
      {
        title: 'Export to Payroll',
        annotation: 'CSV export ready for ADP or Toast Payroll.',
        type: 'popup',
        screen_hint: 'CSV export modal',
      },
    ],
  },
  {
    id: 'coretap-monitor-pitch',
    name: 'Monitor Tier Pitch ($449)',
    description: 'Sales pitch demo aimed at Monitor tier conversion.',
    tier: 'monitor',
    feature_focus: ['pitch', 'lead-capture', 'conversion'],
    steps: [
      {
        title: 'The Problem',
        annotation: '[PAIN_POINT]. Most bar owners have no idea where their money goes after midnight.',
        type: 'popup',
        screen_hint: 'Problem statement overlay, dark background',
      },
      {
        title: 'You Are Losing $2,400/mo',
        annotation: 'And you do not even know it. Here is what CoreTAP would have caught at [BAR_NAME] last month.',
        type: 'callout',
        screen_hint: 'Loss attribution summary card',
      },
      {
        title: 'Golden Hours Reveal',
        annotation: 'Your money is made in 3 hours. CoreTAP shows you which 3.',
        type: 'zoom',
        screen_hint: 'Golden Hours visualization full-screen',
      },
      {
        title: 'Revenue Dashboard',
        annotation: 'Everything you need on one screen. Built for owners who close at 2am.',
        type: 'tooltip',
        screen_hint: 'Full revenue dashboard view',
      },
      {
        title: 'See [BAR_NAME] in CoreTAP',
        annotation: 'Drop your email. We will load your last 30 days of data and send you a personalized walkthrough.',
        type: 'popup',
        screen_hint: 'Lead capture form modal',
      },
      {
        title: 'Book a Live Walkthrough',
        annotation: 'Or skip the wait — book 15 minutes with our team now.',
        type: 'popup',
        screen_hint: 'Calendly embed CTA',
      },
    ],
  },
  {
    id: 'coretap-command-full',
    name: 'Command Tier Full Demo ($749)',
    description: 'Full multi-location Command tier walkthrough with white-label.',
    tier: 'command',
    feature_focus: ['multi-location', 'enterprise', 'api', 'white-label'],
    steps: [
      {
        title: 'Command Center',
        annotation: 'Every [BAR_NAME] location, one screen. Built for groups.',
        type: 'callout',
        screen_hint: 'Multi-location command center hero view',
      },
      {
        title: 'Location Switcher',
        annotation: 'Jump between venues without losing context.',
        type: 'tooltip',
        screen_hint: 'Location switcher dropdown',
      },
      {
        title: 'Cross-Venue Comparison',
        annotation: 'Which location is winning? Which is leaking? Stack-ranked, live.',
        type: 'zoom',
        screen_hint: 'Cross-venue stack-ranked comparison table',
      },
      {
        title: 'Executive Report',
        annotation: 'Auto-generated weekly exec summary. Goes straight to your CFO.',
        type: 'callout',
        screen_hint: 'Executive PDF report preview',
      },
      {
        title: 'API Access',
        annotation: 'Pipe CoreTAP data into your warehouse, BI tool, or custom dashboards.',
        type: 'popup',
        screen_hint: 'API documentation panel',
      },
      {
        title: 'White-Label Demo',
        annotation: 'Your logo, your colors, your domain. CoreTAP under the hood.',
        type: 'popup',
        screen_hint: 'White-label theming preview',
      },
    ],
  },
];

export function getTemplate(id: string): CoreTapTemplate | undefined {
  return CORETAP_TEMPLATES.find((t) => t.id === id);
}

export function listTemplates(tier?: DemoTier): CoreTapTemplate[] {
  if (!tier) return CORETAP_TEMPLATES;
  const order: DemoTier[] = ['monitor', 'execute', 'command'];
  const idx = order.indexOf(tier);
  return CORETAP_TEMPLATES.filter((t) => order.indexOf(t.tier) <= idx);
}

export function personalizeStep(
  step: TemplateStep,
  vars: { bar_name: string; tier?: string; pain_point?: string },
): TemplateStep {
  const replace = (s: string) =>
    s
      .replaceAll('[BAR_NAME]', vars.bar_name)
      .replaceAll('[TIER]', vars.tier ?? 'Monitor')
      .replaceAll('[PAIN_POINT]', vars.pain_point ?? 'Revenue is leaking after midnight');
  return {
    ...step,
    title: replace(step.title),
    annotation: replace(step.annotation),
  };
}
