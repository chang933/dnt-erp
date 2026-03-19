/**
 * 도원반점 KDS 메뉴 기본 데이터
 * 가격은 메뉴관리에서 설정. 여기서는 이름/파트/카테고리만 정의.
 */
import { MenuItem } from '../types';

export const KITCHEN_PARTS = ['면파트', '웍파트', '튀김파트', '떨파트'] as const;
export const KDS_PARTS = ['면파트', '웍파트', '튀김파트', '떨파트'] as const;

export const GOP_CATEGORIES = ['면류', '밥류'];
export const MENU_CATEGORIES = ['면류', '요리', '밥류', '세트', '사이드', '코스'] as const;

export const DEFAULT_MENU_DATA: MenuItem[] = [
  // 면류
  { id: 'dojon-jjajang',    name: '도원짜장면',   shortName: '도원짜장', aliases: ['도짜','도원짜장'],    parts: ['면파트'],              category: '면류', canGop: true },
  { id: 'dojon-jjamppong',  name: '도원짬뽕',     shortName: '도짬',     aliases: ['도짬'],              parts: ['면파트'],              category: '면류', canGop: true },
  { id: 'gapo-jjamppong',   name: '갑오징어짬뽕', shortName: '갑오짬',   aliases: ['갑오짬','갑짬'],     parts: ['면파트','웍파트'],     category: '면류', canGop: true },
  { id: 'gul-jjamppong',    name: '굴짬뽕',       shortName: '굴짬',     aliases: ['굴짬'],              parts: ['면파트','웍파트'],     category: '면류', canGop: true },
  { id: 'chadol-jjamppong', name: '차돌짬뽕',     shortName: '차짬',     aliases: ['차짬'],              parts: ['면파트','웍파트'],     category: '면류', canGop: true },
  { id: 'jjamppong',        name: '짬뽕',         shortName: '짬뽕',     aliases: ['짬뽕'],              parts: ['면파트'],              category: '면류', canGop: true },
  { id: 'udon',             name: '우동',          shortName: '우동',     aliases: ['우동'],              parts: ['면파트'],              category: '면류', canGop: true },
  { id: 'gan-jjajang',      name: '간짜장',        shortName: '간짜장',   aliases: ['간짜장'],            parts: ['면파트','웍파트'],     category: '면류', canGop: true },
  // 요리
  { id: 'tangsuyuk-s',      name: '탕수육 소',     shortName: '탕소',     aliases: ['탕소'],              parts: ['튀김파트','웍파트'],   category: '요리' },
  { id: 'tangsuyuk-m',      name: '탕수육 중',     shortName: '탕중',     aliases: ['탕중'],              parts: ['튀김파트','웍파트'],   category: '요리' },
  { id: 'tangsuyuk-l',      name: '탕수육 대',     shortName: '탕대',     aliases: ['탕대'],              parts: ['튀김파트','웍파트'],   category: '요리' },
  { id: 'mini-tang',        name: '미니탕수육',    shortName: '미탕',     aliases: ['미탕'],              parts: ['튀김파트'],            category: '요리' },
  { id: 'kkampunggi',       name: '깐풍기',        shortName: '깐풍',     aliases: ['깐풍','깐기'],       parts: ['튀김파트','웍파트'],   category: '요리' },
  { id: 'lajoki',           name: '라조기',        shortName: '라조',     aliases: ['라조','라기'],       parts: ['튀김파트','웍파트'],   category: '요리' },
  { id: 'lajuk',            name: '라조육',        shortName: '라육',     aliases: ['라육'],              parts: ['튀김파트','웍파트'],   category: '요리' },
  { id: 'yulinki',          name: '유린기',        shortName: '유린',     aliases: ['유린','유기'],       parts: ['튀김파트','떨파트'], category: '요리' },
  { id: 'yangjangpi',       name: '양장피',        shortName: '양장피',   aliases: ['양장피'],            parts: ['웍파트','떨파트'],   category: '요리' },
  // 밥류
  { id: 'bokkeumbap',       name: '볶음밥',        shortName: '볶밥',     aliases: ['볶밥'],              parts: ['웍파트'],              category: '밥류', canGop: true },
  { id: 'saeu-bokkeum',     name: '새우볶음밥',    shortName: '새볶',     aliases: ['새볶'],              parts: ['웍파트'],              category: '밥류', canGop: true },
  { id: 'japchae-bap',      name: '잡채밥',        shortName: '잡밥',     aliases: ['잡밥','잡볶'],       parts: ['웍파트'],              category: '밥류', canGop: true },
  // 세트
  { id: 'jatang-set',       name: '짜탕세트',      shortName: '짜탕셋',   aliases: ['짜탕셋','A세트'],    parts: ['면파트','튀김파트'],   category: '세트' },
  // 사이드
  { id: 'gungmandu',        name: '군만두',        shortName: '만두',     aliases: ['만두'],              parts: ['떨파트'],          category: '사이드' },
  { id: 'rice',             name: '공기밥',        shortName: '공기밥',   aliases: ['공기밥','밥'],       parts: ['떨파트'],          category: '사이드' },
];

export const DEFAULT_COURSE_DATA: MenuItem[] = [
  {
    id: 'course-yi', name: '이코스', shortName: '이코스', aliases: ['이코스'], parts: [], category: '코스',
    isCourse: true, maxPerPlate: 4, courseDesc: '',
    courseItems: [
      { name: '탕수육 중', parts: ['튀김파트','웍파트'] },
      { name: '깐풍기',    parts: ['튀김파트','웍파트'] },
    ],
  },
  {
    id: 'course-eom', name: '엄코스', shortName: '엄코스', aliases: ['엄코스'], parts: [], category: '코스',
    isCourse: true, maxPerPlate: 4, courseDesc: '유산슬+춘권샐러드+칠리새우+탕수육+유린기+짜장/짬뽕',
    courseItems: [
      { name: '유산슬',     parts: ['웍파트'] },
      { name: '춘권샐러드', parts: ['튀김파트'] },
      { name: '칠리새우',   parts: ['튀김파트','웍파트'] },
      { name: '탕수육 중',  parts: ['튀김파트','웍파트'] },
      { name: '유린기',     parts: ['튀김파트','떨파트'] },
    ],
  },
  {
    id: 'course-yeo', name: '여코스', shortName: '여코스', aliases: ['여코스'], parts: [], category: '코스',
    isCourse: true, maxPerPlate: 4, courseDesc: '',
    courseItems: [
      { name: '유산슬',    parts: ['웍파트'] },
      { name: '양장피',    parts: ['웍파트','떨파트'] },
      { name: '칠리새우',  parts: ['튀김파트','웍파트'] },
      { name: '깐풍기',    parts: ['튀김파트','웍파트'] },
      { name: '탕수육 중', parts: ['튀김파트','웍파트'] },
      { name: '유린기',    parts: ['튀김파트','떨파트'] },
    ],
  },
];

const LS_KEY = 'dowon_menu_data';
const LS_COURSE_KEY = 'dowon_course_data';

/** localStorage에서 메뉴 로드 (없으면 기본값) */
export function loadMenuData(): MenuItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as MenuItem[];
  } catch {}
  return DEFAULT_MENU_DATA;
}

export function saveMenuData(list: MenuItem[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export function loadCourseData(): MenuItem[] {
  try {
    const raw = localStorage.getItem(LS_COURSE_KEY);
    if (raw) return JSON.parse(raw) as MenuItem[];
  } catch {}
  return DEFAULT_COURSE_DATA;
}

export function saveCourseData(list: MenuItem[]): void {
  localStorage.setItem(LS_COURSE_KEY, JSON.stringify(list));
}

// 하위 호환: MENU_DATA, COURSE_MENU_DATA export (빌드 타임에 기본값 사용)
export const MENU_DATA = DEFAULT_MENU_DATA;
export const COURSE_MENU_DATA = DEFAULT_COURSE_DATA;
