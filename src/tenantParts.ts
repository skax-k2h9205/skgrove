import { createContext, useContext } from 'react';
import { teamParts } from './auth';

// 현재 로그인한 사용자의 테넌트(팀) 조직 파트 목록을 공급한다.
// 예전에는 auth.teamParts(SK 고정)를 직접 import 했는데, 파트는 팀마다 다르므로
// App 이 현재 테넌트의 parts 를 이 컨텍스트로 내려주고, 컴포넌트는 훅으로 읽는다.
// '전체'는 포함하지 않는다(필터에서 각 컴포넌트가 앞에 붙인다). 폴백은 SK 기본 파트.
export const TenantPartsContext = createContext<string[]>([...teamParts]);

export function useTenantParts(): string[] {
  return useContext(TenantPartsContext);
}
