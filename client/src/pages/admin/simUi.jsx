import { EDITOR_ROOT } from './adminUi';

export const SIM_DIFFICULTIES = ['easy', 'medium', 'above', 'hard'];
export const SIM_FORMATS = ['standard', 'compare', 'reading'];
export const SIM_TRACKS = ['main', 'subject', 'state_lang'];

export function simPath(...parts) {
  const path = window.location.pathname;
  let root = '/админ';
  if (path.startsWith('/admin')) root = '/admin';
  else if (path.startsWith(EDITOR_ROOT)) root = EDITOR_ROOT;
  return [root, 'sim', ...parts.filter((p) => p !== undefined && p !== null && p !== '')].join('/');
}

export function slotCrumbs(t, info, { last = true } = {}) {
  const { subject, variant, block, part, slot } = info;
  const items = [
    { label: t('admin.simulation.title'), to: simPath() },
    { label: subject.name, to: simPath(subject.id) },
    { label: t('admin.simulation.variantN', { n: variant.number }), to: simPath('variant', variant.id) },
  ];
  if (block.title !== part.name) items.push({ label: block.title });
  if (!slot.isPart) items.push({ label: part.name, to: simPath('slot', part.id) });
  items.push(last ? { label: slot.name } : { label: slot.name, to: simPath('slot', slot.id) });
  return items;
}

export function DifficultyBadge({ t, value }) {
  return <span className={`sim-diff sim-diff-${value}`}>{t(`admin.simulation.diff.${value}`)}</span>;
}

export function StatusBadge({ t, status }) {
  return <span className={`badge${status === 'published' ? ' brand' : ''}`}>{t(`admin.simulation.status.${status}`)}</span>;
}

export function CountBadge({ count, need }) {
  const cls = !need ? '' : (count === need ? ' is-ok' : (count > need ? ' is-over' : ' is-short'));
  return <span className={`sim-count${cls}`}>{need ? `${count} / ${need}` : count}</span>;
}
