import { getCollection } from 'astro:content';
import profileData from '../content/profile.json';
import interestsData from '../content/interests.json';

export const profile = profileData;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-01" -> "Jan 2026" */
export function formatMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** "Jan – Apr 2026", "Sep 2023 – Mar 2025", "Sep 2026 – Present" */
export function formatRange(start: string, end: string | null): string {
  if (!end) return `${formatMonth(start)} – Present`;
  const [sy] = start.split('-');
  const [ey] = end.split('-');
  return sy === ey
    ? `${MONTHS[Number(start.split('-')[1]) - 1]} – ${formatMonth(end)}`
    : `${formatMonth(start)} – ${formatMonth(end)}`;
}

/** 2025-01-15 -> "15 Jan 2025" */
export function formatDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export async function getExperience() {
  const all = await getCollection('experience');
  // Newest first; for the same start month, the one still running (or ending later) first.
  return all.sort(
    (a, b) =>
      b.data.start.localeCompare(a.data.start) || (b.data.end ?? '9999').localeCompare(a.data.end ?? '9999'),
  );
}

export async function getProjects() {
  const all = await getCollection('projects');
  return all.sort((a, b) => a.data.code.localeCompare(b.data.code));
}

export async function getCities() {
  const all = await getCollection('cities');
  return all.sort((a, b) => a.data.km - b.data.km);
}

/** Keeps the order of interests.json (the file loader sorts by id). */
export async function getInterests() {
  const order = interestsData.map((i) => i.id);
  const all = await getCollection('interests');
  return all.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

/** Drafts only appear in `astro dev`; production builds ship published posts only. */
export async function getPosts() {
  // Skip the lookup (and Astro's "collection is empty" warning on every page) when there are no posts yet.
  if (Object.keys(import.meta.glob('../content/posts/*.md')).length === 0) return [];
  const all = await getCollection('posts', (p) => import.meta.env.DEV || !p.data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
