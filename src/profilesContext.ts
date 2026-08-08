// 아바타 디렉토리(이름 → 색·사진) 컨텍스트. Avatar가 라이브 값을 전역에서 읽는다.
// 색은 성향 프로필(profiles), 사진은 계정(accounts)에서 오며 App이 둘을 합쳐 제공한다.
// 기본값은 정적 시드(mockData)라 Provider 없이도 동작하고, App이 DB 로드분으로 덮어쓴다.
import { createContext } from 'react';
import { profiles } from './data/mockData';
import type { Profile } from './types';

export type AvatarInfo = { color: Profile['color']; photoUrl?: string };

export const ProfilesContext = createContext<Map<string, AvatarInfo>>(
  new Map(profiles.map((profile) => [profile.name, { color: profile.color }])),
);
