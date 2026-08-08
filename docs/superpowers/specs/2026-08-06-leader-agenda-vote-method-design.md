# 리더 관리함 안건 후보에 투표 방식(찬반/객관식)

작성일 2026-08-06 · 브랜치 `feature/leader-agenda-vote-method`

## 문제

리더 관리함 > 안건 탭의 "안건 후보 만들기" 폼은 승격되는 안건을 **늘 찬반**으로 만든다
(`App.tsx`의 `promoteToAgenda`에 `voteType: '찬반'` 하드코딩). "회식 장소를 어디로 할까"처럼
답이 둘이 아닌 접수를 리더가 안건으로 올릴 때, 안건함의 직접 등록(`AgendaForm`)에는 있는
객관식을 리더 경로에서는 쓸 수 없다.

## 하기로 한 것

리더 안건 후보 폼에 **투표 방식(찬반/객관식)** 선택을 더한다. 객관식이면 안건함 직접 등록과
동일하게 선택지를 직접 써 넣고(2~6개, 추가·삭제), "여러 개 고르기 허용"을 열 수 있다.
UI/UX는 `AgendaForm`(새 안건 등록)을 그대로 따른다.

## 하지 않는 것

- 데이터 모델·DB·집계·결과 판정 변경. 객관식 인프라(`VoteType`, `AgendaOption`, `multiSelect`,
  `voterCount`, 결과 판정, 정렬)는 이미 존재한다. 이 작업은 UI + 승격 경로 연결뿐이다.
- 리더 폼의 리더 전용 요소(원문 불러오기, 프라이버시 안내, 공개 미리보기)는 유지한다.
- 새 검증 규칙 신설 없음. `AgendaForm`의 기존 규칙(2개 이상 / 공백 불가 / 중복 불가)을 공유한다.

## 접근: 공유 컴포넌트 추출

객관식 편집 UI와 검증은 지금 `AgendaForm` 안에 인라인으로 있다. 리더 폼에 복붙하면 두 곳이
갈라진다. 표현 컴포넌트 하나와 검증 헬퍼 하나로 뽑아 두 폼이 공유한다.

1. **`VoteMethodEditor`** (`src/features/agenda/VoteMethodEditor.tsx`, 신규)
   - 찬반/객관식 choice-card 그리드 + 객관식일 때 선택지 편집 줄 + "여러 개 고르기 허용" 토글.
   - 순수 표현 컴포넌트. 상태(`voteType`/`optionLabels`/`multiSelect`)는 부모가 소유하고
     값과 setter를 props로 받는다.
   - `MIN_OPTIONS(2)` / `MAX_OPTIONS(6)` 상수와 선택지 추가/삭제/수정 헬퍼를 여기 둔다.

   ```ts
   type VoteMethodEditorProps = {
     voteType: VoteType;
     optionLabels: string[];
     multiSelect: boolean;
     onVoteTypeChange: (voteType: VoteType) => void;
     onOptionLabelsChange: (labels: string[]) => void;
     onMultiSelectChange: (value: boolean) => void;
   };
   ```

2. **`validateVoteOptions(voteType, optionLabels)`** (같은 파일에서 export)
   - 객관식일 때 `2개 이상 / 공백 제거 후 중복 불가`를 검사해 에러 문자열 또는 `null`을 반환.
   - 빈 라벨을 걸러 정제한 라벨 배열도 함께 돌려줘 submit이 그대로 쓰게 한다.
   - `AgendaForm.submit`과 `LeaderInbox.submitAgendaDraft`가 공유한다.

3. **`AgendaForm`** — 인라인 투표 방식/선택지 블록을 `VoteMethodEditor`로 교체하고
   검증은 `validateVoteOptions`로 치환. 동작·모양 동일한 순수 리팩터.

## 변경 파일

- **`src/features/agenda/VoteMethodEditor.tsx`** (신규) — 공유 UI + 상수 + `validateVoteOptions`.
- **`src/features/agenda/AgendaForm.tsx`** — 인라인 → 공유 컴포넌트/헬퍼로 치환.
- **`src/features/leader/LeaderInbox.tsx`**
  - 로컬 `AgendaDraft` 타입에 `voteType/multiSelect/optionLabels` 추가.
  - `makeAgendaDraft`에 기본값(`voteType: '찬반'`, `multiSelect: false`, `optionLabels: []`) 추가.
  - 안건 폼(`activeAction === 'agenda'`)의 공개방식·마감일 grid 아래, 공개 미리보기 위에
    `VoteMethodEditor` 삽입.
  - `submitAgendaDraft`에서 `validateVoteOptions`로 검증하고, 통과 시 정제 라벨을 넘긴다.
    실패 시 리더 폼에도 인라인 에러 라인을 노출한다.
  - 공개 미리보기(`agenda-publish-preview`)의 `<small>`에 투표 방식 표기를 더한다.
- **`src/App.tsx`**
  - `promoteToAgenda`의 draft 타입에 `voteType/multiSelect/optionLabels` 추가.
  - 하드코딩 `voteType: '찬반' / options: [] / multiSelect: false`를 draft 값으로 교체:
    `voteType: draft.voteType`, `options: makeAgendaOptions(draft.optionLabels)`,
    `multiSelect: draft.voteType === '객관식' && draft.multiSelect`.
  - `LeaderInbox`에 넘기는 `onPromoteToAgenda` prop 시그니처를 맞춘다.

## 화면

- **리더 안건 후보 폼** — 공개방식·마감일 아래에 투표 방식 카드 2개. 객관식이면 그 아래
  선택지 입력 줄과 복수선택 토글. 좁은 패널(≈584px)에서도 카드 2개 그리드는 이미
  다른 곳에서 쓰이므로 폭 문제 없음.
- `리더만 보기`로 익명화되는 건도 객관식 가능하다. 선택지는 리더가 직접 쓰는 라벨이라
  원문·작성자 노출과 무관하다.

## 테스트

이 작업은 UI 배선이며 새 규칙 로직이 없다. 기존 `agendaRules`/`agendaSort` 테스트가
객관식 데이터 모델을 이미 덮는다. 수동 확인:

- 리더 폼에서 객관식 선택 → 선택지 편집 노출 → 승격 시 객관식 안건으로 저장·표시.
- 찬반 선택 시 선택지 편집 숨김, 기존과 동일하게 찬반 안건 생성.
- 객관식 선택지 1개/공백/중복이면 승격 버튼이 막히고 에러 문구 노출.
- `AgendaForm`(새 안건 등록)의 기존 동작·모양이 리팩터 후에도 동일.
