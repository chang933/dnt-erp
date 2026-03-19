/**
 * 한글 퍼지 매칭 (약어, 초성, 부분 문자열, 레벤슈타인)
 * 검색 우선순위: 정확한 이름(0) > 약어 정확(1) > 시작 매칭(2) > 초성(3) > 부분(4) > 퍼지(5+)
 */
import { MenuItem } from '../types';

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

/** 한글 음절에서 초성만 추출 (초성 검색용) */
function getChosung(str: string): string {
  let result = '';
  for (const c of str) {
    const code = c.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const idx = code - 0xac00;
      result += CHO[Math.floor(idx / (21 * 28))];
    } else if (/[ㄱ-ㅎ]/.test(c)) {
      result += c;
    } else if (/[가-힣]/.test(c)) {
      result += c; // 한글 음절은 초성만 넣었으므로 나머지는 문자 유지 (비교용)
    } else {
      result += c;
    }
  }
  return result;
}

/** 한글 음절을 초성+중성+종성 문자열로 (비교용) */
function getChosungFull(str: string): string {
  let result = '';
  for (const c of str) {
    const code = c.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const idx = code - 0xac00;
      result += CHO[Math.floor(idx / (21 * 28))];
      result += JUNG[Math.floor((idx % (21 * 28)) / 28)];
      const j = idx % 28;
      if (j > 0) result += JONG[j];
    } else {
      result += c;
    }
  }
  return result;
}

function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  const dp: number[][] = Array(an + 1).fill(null).map(() => Array(bn + 1).fill(0));
  for (let i = 0; i <= an; i++) dp[i][0] = i;
  for (let j = 0; j <= bn; j++) dp[0][j] = j;
  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[an]![bn]!;
}

export interface SearchResult {
  item: MenuItem;
  score: number;
  matchedBy?: string;
}

export function searchMenu(query: string, menuList: MenuItem[], limit = 10): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  const qCho = getChosung(query);
  const results: SearchResult[] = [];

  for (const item of menuList) {
    const name = item.name;
    const nameLower = name.toLowerCase();
    const nameCho = getChosung(name);        // 초성만 (초성 검색용)
    const nameChoFull = getChosungFull(name); // 초성+중성+종성 (시작/포함 비교용)

    // 1. 정확한 이름 매칭
    if (nameLower === q || name === query) {
      results.push({ item, score: 0, matchedBy: 'name' });
      continue;
    }

    // 2. 약어 정확 매칭
    const aliases = [item.shortName, ...(item.aliases || [])].filter(Boolean) as string[];
    for (const al of aliases) {
      if (al.toLowerCase() === q || al === query) {
        results.push({ item, score: 1, matchedBy: 'alias' });
        break;
      }
    }
    if (results.some(r => r.item.id === item.id)) continue;

    // 3. 이름/약어 시작 매칭
    if (nameLower.startsWith(q) || nameChoFull.startsWith(getChosungFull(query)) || nameCho.startsWith(qCho)) {
      results.push({ item, score: 2, matchedBy: 'start' });
      continue;
    }
    for (const al of aliases) {
      if (al.toLowerCase().startsWith(q) || getChosung(al).startsWith(qCho) || getChosungFull(al).startsWith(getChosungFull(query))) {
        results.push({ item, score: 2, matchedBy: 'aliasStart' });
        break;
      }
    }
    if (results.some(r => r.item.id === item.id)) continue;

    // 4. 초성 매칭 (쿼리가 초성만 있는 경우)
    if (/^[ㄱ-ㅎㅏ-ㅣ\s]+$/.test(query) && nameCho.replace(/\s/g, '').includes(qCho.replace(/\s/g, ''))) {
      results.push({ item, score: 3, matchedBy: 'cho' });
      continue;
    }

    // 5. 부분 문자열
    if (nameLower.includes(q) || nameChoFull.includes(getChosungFull(query)) || nameCho.includes(qCho)) {
      results.push({ item, score: 4, matchedBy: 'partial' });
      continue;
    }
    for (const al of aliases) {
      if (al.toLowerCase().includes(q)) {
        results.push({ item, score: 4, matchedBy: 'aliasPartial' });
        break;
      }
    }
    if (results.some(r => r.item.id === item.id)) continue;

    // 6. 퍼지 (레벤슈타인) - 짧은 쿼리일 때만
    if (q.length >= 2) {
      const dist = Math.min(
        levenshtein(q, nameLower.slice(0, q.length + 3)),
        levenshtein(q, nameLower)
      );
      if (dist <= 2) {
        results.push({ item, score: 5 + dist, matchedBy: 'fuzzy' });
      }
    }
  }

  results.sort((a, b) => a.score - b.score);
  return results.slice(0, limit);
}
