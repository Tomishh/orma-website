// Thin client for the Strapi 5 REST API (server-side only).

import { STRAPI_URL as RAW_STRAPI_URL, STRAPI_TOKEN } from 'astro:env/server';

const STRAPI_URL = RAW_STRAPI_URL.replace(/\/$/, '');

export interface ImageFormat {
  url: string;
  width: number;
  height: number;
}

export interface StrapiImage {
  id: number;
  url: string;
  width: number | null;
  height: number | null;
  alternativeText: string | null;
  formats: Record<string, ImageFormat> | null;
}

export interface Article {
  id: number;
  documentId: string;
  title: string;
  slug: string | null;
  date: string | null;
  description: string | null;
  publishedAt: string;
  photos: StrapiImage[] | null;
}

export interface TeamMember {
  id: number;
  documentId: string;
  firstName: string;
  lastName: string;
  role: string | null;
  bio: string | null;
  order: number | null;
  photo: StrapiImage | null;
}

export interface Homepage {
  shortName: string | null;
  fullName: string | null;
  tagline: string | null;
  introduction: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  photos: StrapiImage[] | null;
}

interface Pagination {
  start?: number;
  limit?: number;
  total: number;
}

interface StrapiResponse<T> {
  data: T;
  meta: { pagination?: Pagination };
}

const IMAGE_FIELDS = ['url', 'width', 'height', 'alternativeText', 'formats'];

function imagePopulate(field: string): Record<string, string> {
  return Object.fromEntries(
    IMAGE_FIELDS.map((name, i) => [`populate[${field}][fields][${i}]`, name]),
  );
}

async function request<T>(path: string, params: Record<string, string> = {}): Promise<StrapiResponse<T> | null> {
  const url = `${STRAPI_URL}/api/${path}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, {
      headers: STRAPI_TOKEN ? { Authorization: `Bearer ${STRAPI_TOKEN}` } : {},
    });
    if (!res.ok) {
      if (res.status !== 404) console.error(`[strapi] ${res.status} on ${url}`);
      return null;
    }
    return (await res.json()) as StrapiResponse<T>;
  } catch (error) {
    console.error(`[strapi] unreachable (${url})`, error);
    return null;
  }
}

export async function getHomepage(): Promise<Homepage | null> {
  const res = await request<Homepage>('homepage', imagePopulate('photos'));
  return res?.data ?? null;
}

/** Published articles, most recent first (by the editor-set `date`, then publication). */
export async function getArticles({ start = 0, limit = 9 } = {}) {
  const res = await request<Article[]>('articles', {
    'sort[0]': 'date:desc',
    'sort[1]': 'publishedAt:desc',
    'pagination[start]': String(start),
    'pagination[limit]': String(limit),
    ...imagePopulate('photos'),
  });
  return {
    articles: res?.data ?? [],
    total: res?.meta.pagination?.total ?? 0,
  };
}

/** Finds an article by slug, falling back to its documentId for articles without a slug. */
export async function getArticle(slugOrId: string): Promise<Article | null> {
  const bySlug = await request<Article[]>('articles', {
    'filters[slug][$eq]': slugOrId,
    'pagination[limit]': '1',
    ...imagePopulate('photos'),
  });
  if (bySlug?.data.length) return bySlug.data[0];

  const byId = await request<Article>(`articles/${encodeURIComponent(slugOrId)}`, imagePopulate('photos'));
  return byId?.data ?? null;
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const res = await request<TeamMember[]>('team-members', {
    'sort[0]': 'order:asc',
    'sort[1]': 'lastName:asc',
    'pagination[limit]': '100',
    ...imagePopulate('photo'),
  });
  return res?.data ?? [];
}

export function articleHref(article: Pick<Article, 'slug' | 'documentId'>): string {
  return `/realisations/${encodeURIComponent(article.slug || article.documentId)}`;
}

// Strapi's local provider returns relative `/uploads/...` URLs, proxied by pages/uploads/[...path].ts
export function srcset(image: StrapiImage): string {
  const candidates = Object.values(image.formats ?? {}).map((f) => ({ url: f.url, width: f.width }));
  if (image.width) candidates.push({ url: image.url, width: image.width });
  return candidates
    .sort((a, b) => a.width - b.width)
    .map((c) => `${c.url} ${c.width}w`)
    .join(', ');
}

export async function proxyUpload(path: string, headers: Headers): Promise<Response> {
  return fetch(`${STRAPI_URL}/uploads/${path}`, { headers });
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Date shown for an article: its `date` field, or its publication date when unset. */
export function articleDate(article: Pick<Article, 'date' | 'publishedAt'>): string {
  return article.date ?? article.publishedAt;
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFormatter.format(new Date(iso)) : '';
}
