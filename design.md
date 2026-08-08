# SKonnection 디자인 가이드

> **SKonnection** (구 Connectioner · SK Grove) — 인스타그램 톤의 클린 뉴트럴
> 화이트 베이스 · 헤어라인 분리 · 파랑 포인트(`#006bb8`) · 사진/일러스트가 화면의 유일한 색
> 대표 화면: **홈 통합 피드**(인스타 프로필형 3열 격자 + 스토리)

**값의 최종 출처는 언제나 `src/styles.css` 의 `:root` 블록**이고, 이 문서와 어긋나면 코드가 맞다.
이 저장소는 Tailwind 도 `lib/themes.ts` 도 쓰지 않는다 — **Vite + React + 단일 `src/styles.css`**.
아래 1~8장은 "클린 뉴트럴" 원문 가이드(역사적 근거), **9장은 저장소 적용 메모, 10~11장이 현재
살아 있는 기준**(인스타 톤 + 기능)이다. 원문의 Tailwind 클래스 예시는 참고용이며 실제 구현은
`styles.css` 클래스에 있다.

---

## 1. 디자인 원칙

1. **여백이 곧 디자인** — 배경은 거의 무채색(`#F6F7FB`), 정보는 화이트 카드로 띄운다.
2. **강조는 딱 한 번** — 색은 액션(파랑)과 상태(빨강/초록)에만. 나머지는 그레이 스케일.
3. **CTA는 검정** — 주요 실행 버튼은 블랙(`#111827`), 링크성/보조 액션은 블루(`#2563EB`).
4. **볼드한 타이틀, 얇은 본문** — 제목은 700, 본문은 400~500으로 대비를 준다.
5. **테두리는 얇고 연하게** — 1px, `#E7EAF3`. 그림자는 아주 은은하게.

---

## 2. 컬러 토큰

### 2.1 코어 팔레트 (5색 원칙)

| 역할 | 이름 | HEX | HSL | 용도 |
|------|------|-----|-----|------|
| Primary (accent) | Blue 600 | `#2563EB` | `hsl(221 83% 53%)` | 링크, 포인트, 진행 바, 선택 링 |
| Neutral (CTA) | Ink 900 | `#111827` | `hsl(221 39% 11%)` | 주요 실행 버튼 배경 |
| Text | Ink 950 | `#0B1220` | `hsl(222 47% 8%)` | 제목/본문 텍스트 |
| Sub text | Gray 500 | `#6B7280` | `hsl(220 9% 46%)` | 보조 설명, 메타 정보 |
| Surface | White | `#FFFFFF` | `hsl(0 0% 100%)` | 카드, 입력 필드 |
| Background | Cloud 50 | `#F6F7FB` | `hsl(225 33% 97%)` | 페이지 배경 |

### 2.2 서포트 · 상태 토큰

| 역할 | 이름 | HEX | 용도 |
|------|------|-----|------|
| Primary soft | Blue 300 | `#93C5FD` | 진행 바 미완료 구간, 연한 강조 |
| Track | Indigo 50 | `#EEF2FF` | 프로그레스 트랙, 칩 배경 |
| Card border | Slate 100 | `#E7EAF3` | 카드/입력 테두리 (1px) |
| Chip text | Blue 600 | `#2563EB` | 칩/뱃지 텍스트 |
| Avatar bg | Blue 100 | `#DBEAFE` | 아바타 배경 |
| Avatar text | Blue 700 | `#1D4ED8` | 아바타 이니셜 |
| Warn bg | Red 50 | `#FEF2F2` | 마감 지남 경고 배경 |
| Warn border | Red 200 | `#FECACA` | 경고 테두리 |
| Warn text | Red 600 | `#DC2626` | 경고 텍스트 / "지남" |
| Success bg | Emerald 50 | `#ECFDF5` | 완료 상태 배경 |
| Success text | Emerald 600 | `#059669` | 완료 상태 텍스트 |

### 2.3 CSS 변수 (globals.css 예시)

```css
:root {
  --page: #f6f7fb;
  --card: #ffffff;
  --card-border: #e7eaf3;
  --text: #0b1220;
  --subtext: #6b7280;
  --primary: #2563eb;
  --primary-soft: #93c5fd;
  --track: #eef2ff;
  --cta: #111827;
  --cta-text: #ffffff;
  --chip-bg: #eef2ff;
  --chip-text: #2563eb;
  --avatar-bg: #dbeafe;
  --avatar-text: #1d4ed8;
  --warn-bg: #fef2f2;
  --warn-border: #fecaca;
  --warn-text: #dc2626;
  --success-bg: #ecfdf5;
  --success-text: #059669;
  --radius: 16px;
  --shadow-card: 0 1px 2px rgba(11, 18, 32, 0.06), 0 8px 24px -18px rgba(11, 18, 32, 0.5);
}
```

Tailwind v4 `@theme` 매핑 예시:

```css
@theme inline {
  --color-background: var(--page);
  --color-card: var(--card);
  --color-border: var(--card-border);
  --color-foreground: var(--text);
  --color-muted-foreground: var(--subtext);
  --color-primary: var(--primary);
  --radius: 16px;
}
```

---

## 3. 타이포그래피

- **폰트**: Sans-serif. 한글 서비스이므로 `Pretendard` 권장, 대체 `Inter` / system-ui.
- **본문 line-height**: 1.4~1.6 (`leading-relaxed`).

| 토큰 | size / weight | Tailwind | 용도 |
|------|---------------|----------|------|
| Display | 28px / 700 | `text-3xl font-bold` | 페이지 타이틀 ("액션아이템") |
| H2 | 20px / 700 | `text-xl font-bold` | 카드 제목 |
| H3 | 16px / 600 | `text-base font-semibold` | 섹션/필드 라벨 |
| Body | 14px / 400~500 | `text-sm` | 본문 |
| Meta | 13px / 500 | `text-[13px] font-medium text-[--subtext]` | 담당/목표일 메타 |
| Caption | 12px / 600 | `text-xs font-semibold` | 뱃지/칩 |

---

## 4. 간격 · 형태 · 그림자

- **라운드(radius)**: 기본 `16px`. 카드 `rounded-2xl`, 버튼/입력 `rounded-xl`, 칩 `rounded-full`.
- **간격**: Tailwind 스케일만 사용 (`gap-4`, `p-6`, `mb-2`). 임의값(`p-[15px]`) 금지.
  - 카드 내부 패딩: `p-6` (24px)
  - 카드 간 간격: `gap-4` (16px)
  - 페이지 좌우 여백: `px-8` (32px)
- **테두리**: `border border-[#E7EAF3]` (1px).
- **그림자**: `0 1px 2px rgba(11,18,32,0.06), 0 8px 24px -18px rgba(11,18,32,0.5)` — 아주 은은하게.
- **레이아웃**: flexbox 우선. 카드 그리드만 `grid grid-cols-1 lg:grid-cols-2 gap-4`.

---

## 5. 컴포넌트 규칙

### 5.1 버튼

| 종류 | 배경 | 텍스트 | 클래스 예시 |
|------|------|--------|-------------|
| Primary CTA | `#111827` | `#FFFFFF` | `bg-[#111827] text-white rounded-xl px-4 py-2.5 font-semibold` |
| Secondary | `#FFFFFF` | `#0B1220` | `bg-white border border-[#E7EAF3] rounded-xl px-4 py-2.5 font-medium` |
| Link/Accent | 투명 | `#2563EB` | `text-[#2563EB] font-semibold hover:underline` |

- hover: primary는 `hover:bg-black`, secondary는 `hover:bg-[#F6F7FB]`.

### 5.2 카드

```html
<div class="bg-white border border-[#E7EAF3] rounded-2xl p-6"
     style="box-shadow: 0 1px 2px rgba(11,18,32,0.06), 0 8px 24px -18px rgba(11,18,32,0.5)">
  ...
</div>
```

- 마감 지남 카드는 좌측 강조 대신 **테두리 색만** `border-[#FECACA]` + 상단 경고 뱃지.

### 5.3 상태 뱃지 (칩)

| 상태 | 배경 | 텍스트 | 아이콘 |
|------|------|--------|--------|
| 대기 | `#EEF2FF` | `#2563EB` | Clock |
| 진행중 | `#EEF2FF` | `#2563EB` | Play |
| 완료 | `#ECFDF5` | `#059669` | CheckCircle |
| 지남(경고) | `#FEF2F2` | `#DC2626` | AlertTriangle |

```html
<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold
             bg-[#EEF2FF] text-[#2563EB]">
  <PlayIcon class="size-3.5" /> 진행중
</span>
```

### 5.4 입력 · 셀렉트

```html
<input class="w-full bg-white border border-[#E7EAF3] rounded-xl px-3.5 py-2.5 text-sm
              text-[#0B1220] placeholder:text-[#6B7280]
              focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent" />
```

### 5.5 프로그레스 바

```html
<div class="h-2 w-full rounded-full bg-[#EEF2FF]">
  <div class="h-2 rounded-full bg-[#2563EB]" style="width: 60%"></div>
</div>
```

### 5.6 아바타

```html
<div class="size-10 rounded-xl bg-[#DBEAFE] text-[#1D4ED8] font-bold
            flex items-center justify-center">이</div>
```

### 5.7 사이드바

- 배경 `#FFFFFF`, 우측 `border-r border-[#E7EAF3]`.
- 선택 항목: `bg-[#EEF2FF] text-[#2563EB] font-semibold rounded-xl`.
- 비선택 항목: `text-[#6B7280] hover:bg-[#F6F7FB]`.
- 그룹 헤더: `text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]`.

---

## 6. 아이콘

- 라이브러리: **lucide-react**.
- 크기: 16 / 20 / 24px (`size-4`, `size-5`, `size-6`). 한 화면에서 톤 통일.
- 색: 기본 `#6B7280`, 활성/포인트 `#2563EB`.
- 이모지를 아이콘으로 사용하지 않는다.

| 메뉴 | 아이콘 |
|------|--------|
| 홈 | `Home` |
| 대나무숲 접수 | `MessageSquarePlus` |
| 안건함/투표 | `SquareCheck` |
| 액션아이템 | `ClipboardList` |
| 동료 성향 | `User` |
| 벼룩숲 | `Store` |
| 알림/메시지 | `Bell` |

---

## 7. 접근성

- 텍스트/배경 명도 대비 최소 4.5:1 (본문), 3:1 (대형 텍스트).
  - `#0B1220` on `#FFFFFF` → 대비 충분. `#6B7280` on `#FFFFFF` → 4.6:1 (통과).
- 상태를 **색으로만** 구분하지 말고 아이콘/텍스트를 항상 병기 (완료 = 초록 + CheckCircle + "완료").
- focus ring(`ring-2 ring-[#2563EB]`)을 제거하지 않는다.
- 아이콘 전용 버튼에는 `aria-label` 부여.

---

## 8. 참고 파일

- `lib/themes.ts` → `themes.clean` (이 문서 토큰의 원본)
- `components/screens/action-items-screen.tsx` (대표 적용 화면)
- `components/screens/app-shell.tsx` (사이드바)

---

## 9. 이 저장소 적용 메모

위 1~8장은 가이드 원문이다. 이 저장소는 Tailwind 도 `lib/themes.ts` 도 쓰지 않고
**Vite + React + 단일 `src/styles.css`** 구조라, 원문을 그대로 옮길 수 없는 부분이 있다.
아래는 옮기면서 내린 결정과 그 이유다. 값의 최종 출처는 언제나 `src/styles.css` 의
`:root` 블록이고, 이 문서와 어긋나면 코드가 맞다.

### 9.1 이름 대응

원문의 CSS 변수명(`--page`, `--card`, `--primary` …)을 그대로 쓰지 않고 저장소의 기존
접두사 규칙(`--color-*`, `--tint-*`)을 유지했다. 이름을 바꾸면 9,000줄이 넘는
`styles.css` 전체를 건드려야 하는데, 얻는 것이 이름의 짧음뿐이다.

| 가이드 | 이 저장소 | 값 |
|---|---|---|
| `--page` | `--color-page` | `#f6f7fb` |
| `--card` | `--color-surface` | `#ffffff` |
| — | `--color-sunken` | `#f1f3f9` (hover · 입력 · 비활성 면) |
| `--track` / `--chip-bg` | `--tint-primary` | `#eef2ff` |
| `--text` | `--color-ink` | `#0b1220` |
| `--subtext` | `--color-muted` | `#4b5563` ※9.2 |
| `--primary` | `--color-primary` | `#2563eb` |
| `--avatar-text` | `--color-primary-strong` | `#1d4ed8` |
| `--primary-soft` | `--color-primary-soft` | `#93c5fd` |
| `--cta` / `--cta-text` | `--color-cta` / `--color-cta-ink` | `#111827` / `#ffffff` |
| `--success-text` | `--color-success` | `#047857` ※9.2 |
| `--warn-text` | `--color-danger` | `#b91c1c` ※9.2 |
| `--card-border` | `--color-border` | `#e7eaf3` |
| `--warn-border` | `--color-border-danger` | `#fecaca` |
| `--success-bg` | `--tint-success` | `#ecfdf5` |
| `--warn-bg` | `--tint-danger` | `#fef2f2` |
| `--avatar-bg` | `--tint-avatar` | `#dbeafe` |
| `--shadow-card` | `--shadow-card` | 원문과 동일 |

### 9.2 대비 때문에 바꾼 값 세 개

`src/designTokens.test.ts` 가 **역할색은 세 표면 모두에서 AA(4.5:1)**, **틴트 짝은
AAA(7:1)** 를 정적으로 강제한다. 가이드 값 중 셋이 이 기준을 통과하지 못해 같은 계열의
한 단계 진한 값으로 내렸다. 색상 계열과 의미는 그대로다.

| 가이드 값 | 실제 값 | 왜 |
|---|---|---|
| `#6B7280` Gray 500 | `#4b5563` Gray 600 | 흰 배경에서는 4.83:1 로 통과하지만 페이지 배경 `#f6f7fb` 위에서 4.46:1 로 미달. 이 앱은 본문 상당수가 카드 밖 페이지 배경 위에 있다 |
| `#059669` Emerald 600 | `#047857` Emerald 700 | 흰 배경에서 3.77:1 로 AA 미달. 가이드 7장이 스스로 요구하는 4.5:1 을 가이드 값이 못 지킨다 |
| `#DC2626` Red 600 | `#b91c1c` Red 700 | 흰 배경은 통과하나 `--color-sunken` 위에서 4.30:1 로 미달 |

틴트 짝의 글자색도 AAA 를 맞추기 위해 가이드의 칩 텍스트보다 진하다.
`--tint-primary-ink` `#1e3a8a`(Blue 900), `--tint-success-ink` `#065f46`(Emerald 800),
`--tint-danger-ink` `#991b1b`(Red 800). 가이드가 지정한 `#2563EB` 를 `#eef2ff` 위에
올리면 6.0:1 로 AAA 에 못 미친다.

### 9.3 상태색 재배치

이끼색(`#4f7350`)은 **브랜드색이면서 동시에 찬성·통과의 상태색**이었다. 초록을 브랜드에서
빼면 두 자리가 같이 비므로 다음과 같이 나눴다.

| 상태 | 이전 | 지금 | 토큰 |
|---|---|---|---|
| 브랜드 · 링크 · 진행바 | moss(초록) | 파랑 | `--color-primary` |
| 주요 실행 버튼 | moss 채움 | 검정 | `--color-cta` |
| 통과 · 완료 · 찬성 | moss(초록) | 초록(상태색으로만) | `--color-success` / `--tint-success` |
| 투표중 · 대기 · 진행중 | pending(올리브) | 파랑 | `--tint-primary` |
| 부결 · 반대 · 마감지남 | danger | 빨강 | `--color-danger` / `--tint-danger` |
| 재검토 · 지난 일 | clay(테라코타) | 무채색 | `--tint-neutral` |
| 정보 · 참고 | info(파랑) | 파랑 | `--tint-primary` |

가이드 5장 상태 뱃지 표는 대기·진행중을 파랑 칩으로 두는데, 이 앱에는 **찬성/반대 투표**가
있어 통과를 파랑으로 두면 진행중과 구분되지 않는다. 그래서 통과만 가이드의 Success 를
쓰고 나머지는 표를 그대로 따랐다.

`--color-clay` 와 `--color-pending` 은 제거했다. 가이드 1장 "강조는 딱 한 번" 원칙에서
두 번째 브랜드 색조가 설 자리가 없다.

### 9.4 옮기지 않은 것

- **Tailwind 클래스 예시(5장)** — 이 저장소는 Tailwind 를 쓰지 않는다. 같은 값을
  `styles.css` 의 기존 클래스(`.btn-primary`, `.status-pill`, `.card` …)에 적용했다.
- **`lib/themes.ts`** — 존재하지 않는다. 토큰 원본은 `src/styles.css` 의 `:root` 다.
- **8장 참고 파일 경로** — 이 저장소의 대응 파일은
  `src/features/actions/`(액션아이템), `src/components/AppShell.tsx`(사이드바) 다.
- **간격 스케일** — 가이드는 Tailwind 스케일을 요구하지만, 이 저장소에는 이미 4px 기반
  `--space-1`~`--space-12` 가 있고 값이 서로 같다. 기존 토큰을 유지한다.
- **브레이크포인트** — 720px / 1100px 두 개 고정은 테스트가 강제한다. 그대로 둔다.


---

## 10. 인스타그램 톤 (feature/connectioner-instagram)

1~9장의 원칙 중 **"강조는 딱 한 번"(1.2), "여백이 곧 디자인"(1.1), 접근성 기준(7장)** 은
그대로 유지됩니다. 바뀐 것은 그 원칙을 실현하는 값입니다.

### 10.1 왜 바꿨나

크레파스 일러스트가 콘텐츠로 들어옵니다. 인스타그램은 **UI 에서 색을 완전히 빼서
사진이 화면의 유일한 색이 되게** 하는 시스템이라, 어떤 화풍이 와도 UI 가 싸우지
않습니다. 클린 뉴트럴의 회색 배경 + 파랑 액센트는 그 자체로 색을 갖고 있어
따뜻한 종이 일러스트와 부딪쳤습니다.

### 10.2 바뀐 토큰

| 토큰 | 클린 뉴트럴 | 인스타그램 | 이유 |
|---|---|---|---|
| `--color-page` | `#f6f7fb` | `#ffffff` | 면을 색이 아니라 헤어라인으로 나눈다 |
| `--color-surface` | `#ffffff` | `#ffffff` | 그대로 |
| `--color-sunken` | `#f1f3f9` | `#fafafa` | hover · 입력에만 |
| `--color-ink` | `#0b1220` | `#262626` | 인스타는 순검정을 쓰지 않는다 |
| `--color-muted` | `#4b5563` | `#616161` | 인스타 `#737373` 은 sunken 위 4.27:1 |
| `--color-primary` | `#2563eb` | `#006bb8` | 인스타 `#0095f6` 은 흰 글자에서 3.17:1 |
| `--color-cta` | `#111827` 검정 | `#006bb8` 파랑 | 인스타에 검정 버튼은 없다 |
| `--color-border` | `#e7eaf3` | `#dbdbdb` | 인스타의 유일한 분리선 |
| `--radius-sm / --radius / --radius-lg` | 8 / 12 / 16 | 4 / 8 / 12 | 사진을 깎지 않는다 |
| `--shadow-card` | 2겹 그림자 | `none` | 피드에는 그림자가 없다 |
| `--text-title / heading / display` | 20 / 24 / 28 | 18 / 20 / 24 | 인스타에 큰 디스플레이 타입은 없다 |
| `--surface-dark` | `#111827` | `#000000` | 다크는 순검정 |

새로 생긴 것: `--color-heart` `#ed4956`(좋아요 아이콘 전용 — 인스타에서 색이 들어가는
유일한 아이콘), `--color-btn-soft` `#efefef` / `--color-btn-soft-press` `#dbdbdb`
(보조 버튼의 회색 면).

### 10.3 바뀐 컴포넌트 규칙

- **선택된 메뉴를 칠하지 않는다.** 틴트 배경 대신 글자 굵기 700 + 아이콘 획 2.4px.
  면을 칠하면 사이드바가 콘텐츠보다 시끄러워진다.
- **보조 버튼은 테두리가 아니라 회색 면.** `#efefef` 채움, 테두리 없음.
- **아바타는 원.** 사람과 콘텐츠를 모양으로 가른다.
- **포스터 격자 간격 16px → 3px.** 거의 붙여야 이미지가 UI 를 만든다. 3열 고정은 유지.
- **목록 행을 칠하지 않는다.** `.account-row` 가 파랑 틴트였는데 흰 면으로 되돌렸다.

### 10.4 지켜진 것

4px 간격 스케일 · `--row-h` 44px · 브레이크포인트 720/1100 · 한국어 줄바꿈 규칙 ·
`designTokens.test.ts` 의 AA/AAA 강제 · 4:5 포스터 비율 · 3열 고정.

### 10.5 이름

제품 이름은 **SKonnection** 이다(SK Grove → Connectioner → SKonnection). 앱 이름과
역할 이름(`커넥셔너`)이 **Connectioner** 때 똑같아 헷갈렸는데, 앱을 **SKonnection** 으로
바꾸면서 그 충돌이 사라졌다. `커넥셔너`는 이제 **직책(팀문화 담당) 역할**로만 남는다
(`isConnectioner`, `src/auth.ts` · 계정 관리의 체크박스). 표시 이름만 SKonnection 으로
바꿨고(`LoginScreen`·`AppShell`·`index.html`·공유 문구), 코드 식별자 `isConnectioner`/
`updateConnectioner` 는 역할 이름이라 그대로 둔다.

`localStorage` 키(`skgrove:*`)는 그대로 두었다. 바꾸면 기존 사용자의 데이터가 전부
사라지고 되돌릴 방법이 없다.

---

## 11. 현재 IA · 기능 패턴 (SKonnection)

10장이 색·값의 인스타 전환이라면, 11장은 그 위에 얹힌 **정보구조와 화면 패턴**이다.
값의 출처는 여전히 `styles.css` `:root`, 동작의 출처는 각 feature 컴포넌트다.

### 11.1 사이드바 그룹 — 역할 기반으로 정리

메뉴는 목적 단위 그룹으로 묶는다: **말하고 정하기 / 함께하기 / 커넥셔너 / 살펴보기·관리**.
`커넥셔너` 그룹은 **커넥셔너(직책)에게만** 보인다(`AppShell.canSee` + `isConnectioner`).
지금은 `조뽑기` 하나이고, 앞으로 커넥셔너가 쓰는 도구를 여기 모은다.
그룹의 모든 항목이 걸러지면 제목째 렌더하지 않는다(빈 헤딩 방지).

### 11.2 홈 = 통합 피드 (인스타 프로필형)

홈은 5개 도메인(안건·액션·모임·유머·장터)의 최근 소식을 **한 판에 최신순 3열 정사각
격자**로 모은다. 정렬·개수·매핑은 순수 함수 `src/homeFeed.ts`(`buildHomeFeed`)가 맡고,
타일 렌더만 `Dashboard` 가 한다.

- **타일**: 사진 있는 도메인은 이미지 + 좌상단 종류 배지, 없는 도메인(안건·액션)은
  도메인 색 타일 + 아이콘 + 제목 + 메타. 3열 정사각(`.home-feed-card` `aspect-ratio: 1/1`),
  간격 3px(포스터 격자와 같은 촘촘함).
- **클릭 = 상세 딥링크**: 타일/스토리를 누르면 그 섹션으로 가서 **그 항목 상세를 연다**
  (App 의 `feedFocus` → 각 보드 `focusId` useEffect, 한 번만 소비). 액션은 상세가 없어
  섹션으로만 간다.
- **폭**: 홈은 화면 폭을 가득 쓴다(`.ig-home` 단일 컬럼, 오른쪽 레일 없음). 커피뽑기의
  홈 스토리(폰 모양 420px)와 달리, 조뽑기 무대는 조건 아래 전체 폭을 쓴다.

### 11.3 스토리 트레이 — 번개 전용, 인스타 규칙

트레이는 `말하기(+)` + **번개(flash)로 등록된 것만** 띄운다(공모·안건은 안 올림).
인스타처럼 **본 스토리는 링이 회색(`.ig-ring.viewed`)이 되고 맨 뒤로** 밀린다
(안 본 것만 컬러 그라데이션 `--ring-a/b/c`). 본 것은 `localStorage: skgrove:viewedStories`
로 유지한다. 정렬은 "안 본 것 먼저(최신순) → 본 것 뒤로".

### 11.4 모임 만들기 3갈래 — 번개 · 공모 · 커피내기

`모임 열기` 폼은 동급 카드 3장이다. 저장 `kind` 는 둘(`flash`/`callup`)뿐이고,
**커피내기는 내부적으로 `flash` + `coffeeDraw`** 다(kind 분기를 늘리지 않는다).
커피내기를 고르면 폼이 간소화된다: 제목·시각 숨김(제목 '커피 내기' 자동, 마감 = 만든 뒤
10분), **어디서만 입력(기본 '4층 cafe4u')** + 정원(기본 4).

### 11.5 커피뽑기 — 공정성이 보이게

번개 상세에서 주최자가 커피 담당을 뽑는다. **조작 의심을 없애는 것이 설계의 축**이다.

- **재추첨 완전 차단**: 한 번 뽑으면 확정(초기화 없음). "마음에 드는 이름 나올 때까지
  다시 돌리는" 구멍을 막는다.
- **후보 박제**: 뽑는 순간의 확정 로스터 전원을 `coffeePool` 로 얼려 결과에 남긴다
  ("후보 N명 중에서 → OO"). 뒤에 들어온 사람이 후보였던 척 못 한다.
- **공개 룰렛**: 주최자가 뽑으면 후보를 훑다 멈추는 연출(그냥 상세 열 땐 안 돎).
- **결과 히어로**: 링 두른 큰 아바타(`.tiny-avatar.xl` 72px 원) → '오늘 커피 담당' →
  이름 크게 → '재추첨 없이 확정' → 후보 명단, 전부 중앙 정렬.

### 11.6 조뽑기 — 한 화면 3구역

커피뽑기는 번개로 통합됐고, `조뽑기` 화면(커넥셔너 그룹)은 조뽑기 전용이다.

- **① 참여자 접이식**: 기본 접힘(전체 선택) + 요약 바("N명 참여 · 파트/세대 종수"),
  바꿀 때만 펼친다. 대부분 전체로 짜므로 큰 명단을 늘 펼쳐 둘 이유가 없다.
- **② 조건 + 큰 '조 섞기' 버튼**: 가로로 정돈, 조 개수 경고는 빨간 박스가 아니라
  차분한 회색 보조 문구(`.connect-adjust-note`).
- **③ 결과 = 프로필 사진 그리드**: 3D 뽑기 무대(three.js)는 **돌리는 중에만** 띄운다.
  결과는 조별 카드에 **멤버 프로필 사진(`.tiny-avatar.lg` 56px 원) + 이름** 그리드로.
  (3D 타일에 이름을 겹쳐 그리면 글자가 깨져 보였다.)

### 11.7 프로필 아바타 크기

`.tiny-avatar` 기본 38px(둥근 사각). 결과·당첨자처럼 사람이 주인공인 자리는 **원형**으로
키운다: `.lg` 56px(조뽑기 결과·기타), `.xl` 72px + 링(커피뽑기 당첨자). 사진 있으면 사진,
없으면 이니셜(`Avatar` 컴포넌트, `photoUrl` 실패 시 이니셜 폴백).
