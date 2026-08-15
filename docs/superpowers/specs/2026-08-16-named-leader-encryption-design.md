# 실명 '리더만 보기' E2E 암호화 (v2) — 설계

**목표:** 실명 + `리더만 보기` 접수 본문을 [대상 리더 + 작성자 본인] 공개키로 E2E 암호화해, 운영자(anon/DB/백업)는 못 읽고 **리더와 작성자 본인만** 복호화한다. 익명글 암호화(v1)의 확장.

## 배경 / 동기
- v1(`feature/anon-encryption`, dev 병합)은 **익명글만** 암호화했다. 실명 `리더만 보기` 글은 여전히 anon 키로 본문이 평문 SELECT 된다.
- 익명글과 다른 결정적 지점: 실명글은 작성자가 "내 접수"에서 **자기 본문(body/expectedChange)을 재열람**한다(Intake.tsx). 따라서 작성자도 복호화 가능해야 하고, 작성자에게도 키페어가 필요하다 → **전 팀원 키 발급**.

## 결정 (사용자 승인)
- 범위 = 전 팀원 키 발급(완전형). 실명 `리더만 보기` 본문을 **리더 + 작성자** 공개키로 암호화.
- 실명글 `submitterName/Email`은 평문 유지 → 암호화는 **본문 내용만** 가리고 신원은 안 가린다(진짜 익명성은 익명글 담당). 문서에 명시.

## 아키텍처 (재사용 극대화)
- **DB: 마이그레이션 0건.** `leader_keys`는 이미 `account_id`(모든 계정) PK + RLS(공개키 전체 read / 본인 1회 insert)라 팀원 키 저장에 그대로 쓴다. `issues.encrypted/enc_payload/enc_keys/enc_alg` 컬럼도 존재.
- **크립토: 그대로.** `encryptForRecipients(plaintext, recipients[])`에 리더+작성자를 함께 넘긴다. `decryptAsRecipient(issue, accountId, priv)`는 계정 id로 자기 감싼키를 찾으므로 작성자·리더 공용.
- **UI 컴포넌트: 그대로.** `LeaderKeySetup({accountId,onDone})`·`EncryptedIssueBody({issue,accountId})`는 계정 범용 → 작성자용 재사용.

## 컴포넌트 / 데이터 흐름
1. **정책 (신규 순수 함수)** `src/issueEncryptionPolicy.ts`
   `encryptionPlan(author, visibility) → { encrypt, includeAuthor }`
   - 익명 → `{true, false}` · 실명+리더만보기 → `{true, true}` · 그 외 → `{false,false}`.
2. **제출 (App.submitIssue)**: 정책이 `encrypt`면 수신자 = `leadersFor(target)` + (`includeAuthor`면 작성자 계정). accountId로 dedupe. 공개키 있는 수신자만 암호화, body/expectedChange 비움. 수신자 0이면 평문 폴백.
3. **작성자 키 게이트 (Intake.submit)**: 실명+리더만보기인데 작성자 키 없으면(`loadLeaderKeyRecord`==null) `LeaderKeySetup` 모달 → 완료 후 재제출. 키 없이는 암호화 못 하므로 게이트 필수(거부 시 평문 폴백).
4. **작성자 재열람 (Intake 내 접수)**: `issue.encrypted`면 `<EncryptedIssueBody issue accountId={myAccountId}/>`, 아니면 기존 평문 렌더.
5. **리더 열람**: 기존 인박스 복호화가 이미 동작(수신자에 리더 포함).
6. **AI 검토 스킵**: `skipReview`에 실명+리더만보기 추가(암호화 본문을 외부 AI로 안 보냄).

## 정책 (익명 v1과 일관)
- 신규글부터, 기존 평문 유지 · 키/대상 없으면 평문 폴백(제출 안 막음) · 복구코드 본인 보관 · 암호화된 `리더만 보기` 글은 v1에서 안건(공개) 자동 전환 대상 아님(전환하려면 복호화 필요 — 후속).

## 정직한 한계
- 실명글은 신원(이름/이메일) 평문 → 본문만 보호.
- 웹 능동공격(운영자의 악의적 프론트 JS 교체)은 못 막음 — 수동 DB 열람만 차단. iOS 네이티브는 스토어 서명으로 리스크 축소.

## 검증
- 단위: `issueEncryptionPolicy` TDD. 기존 crypto/store 테스트 유지.
- 통합: 로컬 브라우저(실명 리더만보기 제출→암호화 배지, 내 접수 복호화), **실 Supabase E2E**(insert→anon SELECT 암호문만·평문 부재→작성자/리더 복호화 일치→삭제).
- iOS: 웹과 동일 배선 후 시뮬 구동 + TestFlight.
