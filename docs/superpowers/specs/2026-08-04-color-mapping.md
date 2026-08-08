# 색 매핑표 — 기존 199색 → Moss & Clay 토큰

`scripts/classify-colors.mjs`가 채도·명도·색상으로 1차 제안한 표다.
"확정" 열이 비어 있으면 제안을 그대로 채택한다는 뜻이고,
값이 적혀 있으면 그 값이 제안을 덮어쓴다.

## 자동 분류가 틀리는 경우

1차 제안은 색 자체만 본다. 다음은 사람이 확정해야 한다.

- **저채도 녹색**: 기존 팔레트가 녹색을 표면에 썼기 때문에 `#1d2522`(S=12)
  `#e9eee8`(S=15) 처럼 사실상 중립인 색이 녹색으로 잡힌다. 스크립트는
  채도 18 이하를 중립으로 보내 이를 처리한다.
- **라임 `#d8f06a`(21회)**: 브랜드 마크와 히어로 강조에 쓰였다. 팔레트 C에
  대응색이 없다. 마크는 Task 4에서 `--color-moss` 채움으로 바꾸고,
  강조 용도는 `--tint-pending`으로 보낸다.
- **역할/아바타 색 `#e35d4f` `#bc7a12` 등**: 상태 의미가 아니라 사람 구분용이다.
  4개 틴트(moss/clay/pending/info)를 순환 배정하고 글자색·테두리에는 쓰지 않는다.
- **`rgba()` 103곳**: 대부분 그림자다. `--shadow-float` 하나로 통합하고,
  경계 표현이던 것은 `--color-border`로 바꾼다.

- **반전 대상 표면 위의 밝은 글자색** (Task 4에서 발견): 이 표는 색상값만 보고 분류하므로,
  그 색이 *배경*이었는지 *글자*였는지 모른다. 딥그린 사이드바 위의 밝은 글자(`#a9c4b8`
  `#d8e8df` `#8fae9f` 등)는 표의 제안대로 moss/tint 계열로 보내면 밝은 배경 위 밝은 글자가
  되어 읽히지 않는다. **표면이 반전되는 구간에서는 표보다 역할이 우선한다** — 글자는
  `--color-ink`(15.5:1) 또는 `--color-muted`(6.5:1)로 보내고, 표를 벗어난 사실을 커밋
  메시지에 남긴다. 어두운 셸 전용이던 규칙(예: 라임 포커스 링)은 전제가 사라졌으므로 지운다.

## 확정 표

| 횟수 | 기존 | H/S/L | 제안 토큰 | 확정 |
|---:|---|---|---|---|
| 90 | `#17352f` | 168/39/15 | `--color-moss-strong` | |
| 85 | `#ffffff` | 0/0/100 | `--color-surface` | `--color-surface` |
| 63 | `#f7faf5` | 96/33/97 | `--tint-moss` | |
| 43 | `#2f6f62` | 168/41/31 | `--color-moss` | |
| 21 | `#d8f06a` | 71/82/68 | `--color-pending` | `--color-moss` (마크) / `--tint-pending` (강조) |
| 17 | `#e35d4f` | 6/73/60 | `--color-danger` | `--tint-clay` |
| 15 | `#1d2522` | 158/12/13 | `--color-ink` | |
| 14 | `#2f74c0` | 211/61/47 | `--color-info` | |
| 13 | `#e8f3ef` | 158/31/93 | `--tint-moss` | |
| 12 | `#6aaa89` | 149/27/54 | `--color-moss` | |
| 11 | `#d8e8df` | 146/26/88 | `--color-moss` | |
| 11 | `#bc7a12` | 37/83/40 | `--color-clay` | `--tint-pending` |
| 10 | `#cfd8d1` | 133/10/83 | `--color-sunken` | |
| 10 | `#3d4945` | 160/9/26 | `--color-ink` | |
| 9 | `#d8e0d8` | 120/11/86 | `--color-sunken` | |
| 8 | `#2f58b5` | 222/59/45 | `--color-info` | |
| 8 | `#76513a` | 23/34/35 | `--color-clay` | |
| 8 | `#46544f` | 159/9/30 | `--color-ink` | |
| 7 | `#44514d` | 162/9/29 | `--color-ink` | |
| 7 | `#a3453c` | 5/46/44 | `--color-danger` | |
| 6 | `#e9eee8` | 110/15/92 | `--color-page` | |
| 6 | `#fff7e6` | 41/100/95 | `--tint-clay` | |
| 5 | `#eff8ef` | 120/39/95 | `--tint-moss` | |
| 5 | `#2f7d5b` | 154/45/34 | `--color-moss` | |
| 5 | `#d9dfd8` | 111/10/86 | `--color-sunken` | |
| 5 | `#b83324` | 6/67/43 | `--color-danger` | |
| 5 | `#edf6ef` | 133/33/95 | `--tint-moss` | |
| 5 | `#dce5dc` | 120/15/88 | `--color-page` | |
| 5 | `#8a948d` | 138/4/56 | `--color-muted` | |
| 4 | `#284d45` | 167/32/23 | `--color-moss-strong` | |
| 4 | `#ffe5df` | 11/100/94 | `--tint-danger` | |
| 4 | `#eef3f0` | 144/17/94 | `--color-page` | |
| 4 | `#fdf8ec` | 42/81/96 | `--tint-clay` | |
| 4 | `#e4d5a8` | 45/53/78 | `--color-clay` | |
| 4 | `#f1d390` | 41/78/75 | `--color-clay` | |
| 4 | `#4d5c56` | 156/9/33 | `--color-ink` | |
| 4 | `#fbeee7` | 21/71/95 | `--tint-clay` | |
| 4 | `#26322e` | 160/14/17 | `--color-ink` | |
| 4 | `#5a675f` | 143/7/38 | `--color-muted` | |
| 4 | `#eaf1e6` | 98/28/92 | `--tint-moss` | |
| 4 | `#2b4a3f` | 159/26/23 | `--color-moss-strong` | |
| 4 | `#eef1ee` | 120/10/94 | `--color-page` | |
| 3 | `#a9c4b8` | 153/19/72 | `--color-moss` | |
| 3 | `#f5f7f2` | 84/24/96 | `--tint-pending` | |
| 3 | `#46524d` | 155/8/30 | `--color-ink` | |
| 3 | `#21634f` | 162/50/26 | `--color-moss` | |
| 3 | `#edf6ff` | 210/100/96 | `--tint-info` | |
| 3 | `#cfe0f6` | 214/68/89 | `--tint-info` | |
| 3 | `#37443f` | 157/11/24 | `--color-ink` | |
| 3 | `#eef2ea` | 90/24/93 | `--tint-moss` | |
| 3 | `#eaf1ff` | 220/100/96 | `--tint-info` | |
| 3 | `#e2e8de` | 96/18/89 | `--color-page` | |
| 3 | `#40514a` | 155/12/28 | `--color-ink` | |
| 3 | `#8a978f` | 143/6/57 | `--color-muted` | |
| 3 | `#edc9c2` | 10/54/85 | `--color-danger` | |
| 2 | `#000000` | 0/0/0 | `--color-ink` | |
| 2 | `#b7d8c9` | 153/30/78 | `--color-moss` | |
| 2 | `#7651d8` | 256/63/58 | `--color-info` | |
| 2 | `#fff1cf` | 43/100/91 | `--tint-clay` | |
| 2 | `#eaf0ff` | 223/100/96 | `--tint-info` | |
| 2 | `#e3e9e2` | 111/14/90 | `--color-page` | |
| 2 | `#eef4ec` | 105/27/94 | `--tint-moss` | |
| 2 | `#c9d6c8` | 116/15/81 | `--color-sunken` | |
| 2 | `#7eb3ee` | 212/77/71 | `--color-info` | |
| 2 | `#d6deea` | 216/32/88 | `--color-info` | |
| 2 | `#5f6b82` | 219/16/44 | `--color-muted` | |
| 2 | `#87bd9d` | 144/29/64 | `--color-moss` | |
| 2 | `#7aa5d6` | 212/53/66 | `--color-info` | |
| 2 | `#f0a18d` | 12/77/75 | `--color-danger` | |
| 2 | `#e6bd6b` | 40/71/66 | `--color-clay` | |
| 2 | `#f4f6fb` | 223/47/97 | `--tint-info` | |
| 2 | `#f4efe5` | 40/41/93 | `--tint-clay` | |
| 2 | `#7b4f0c` | 36/82/26 | `--color-clay` | |
| 2 | `#cdd8d1` | 142/12/83 | `--color-sunken` | |
| 2 | `#65736d` | 154/6/42 | `--color-muted` | |
| 2 | `#d7e0d5` | 109/15/86 | `--color-sunken` | |
| 2 | `#d5ded6` | 127/12/85 | `--color-sunken` | |
| 2 | `#1f7a43` | 144/59/30 | `--color-moss` | |
| 2 | `#b07a12` | 39/81/38 | `--color-clay` | |
| 2 | `#94a29a` | 146/7/61 | `--color-border-strong` | |
| 2 | `#9aa79f` | 143/7/63 | `--color-border-strong` | |
| 2 | `#eef1ec` | 96/15/94 | `--color-page` | |
| 2 | `#4a544f` | 150/6/31 | `--color-ink` | |
| 2 | `#fdf4f2` | 11/73/97 | `--tint-danger` | |
| 2 | `#eef3ec` | 103/23/94 | `--tint-moss` | |
| 2 | `#b9c9bd` | 135/13/76 | `--color-border-strong` | |
| 1 | `#8fae9f` | 151/16/62 | `--color-border-strong` | |
| 1 | `#f2f5f2` | 120/13/95 | `--color-page` | |
| 1 | `#9aa7a1` | 152/7/63 | `--color-border-strong` | |
| 1 | `#dfe6df` | 120/12/89 | `--color-page` | |
| 1 | `#f0b8ad` | 10/69/81 | `--color-danger` | |
| 1 | `#1b8a63` | 159/67/32 | `--color-moss` | |
| 1 | `#dfe8dd` | 109/19/89 | `--tint-moss` | |
| 1 | `#cfded7` | 152/19/84 | `--color-moss` | |
| 1 | `#2c524a` | 167/30/25 | `--color-moss-strong` | |
| 1 | `#7a5c1f` | 40/59/30 | `--color-clay` | |
| 1 | `#b9c9bf` | 143/13/76 | `--color-border-strong` | |
| 1 | `#7fb597` | 147/27/60 | `--color-moss` | |
| 1 | `#8d6000` | 41/100/28 | `--color-clay` | |
| 1 | `#f1ece7` | 30/26/93 | `--tint-clay` | |
| 1 | `#eef8f2` | 144/42/95 | `--tint-moss` | |
| 1 | `#bfe2ca` | 139/38/82 | `--color-moss` | |
| 1 | `#8a9490` | 156/4/56 | `--color-muted` | |
| 1 | `#5c7bbf` | 221/44/55 | `--color-info` | |
| 1 | `#e0d3d3` | 0/17/85 | `--color-sunken` | |
| 1 | `#a5514a` | 5/38/47 | `--color-danger` | |
| 1 | `#e6c7bd` | 15/45/82 | `--color-danger` | |
| 1 | `#a5644a` | 17/38/47 | `--color-clay` | |
| 1 | `#efd9cc` | 22/52/87 | `--color-clay` | |
| 1 | `#7a4a33` | 19/41/34 | `--color-clay` | |
| 1 | `#d5e2d2` | 109/22/85 | `--color-moss` | |
| 1 | `#f5ffd0` | 73/100/91 | `--tint-pending` | |
| 1 | `#fbfcf8` | 75/40/98 | `--tint-pending` | |
| 1 | `#edf2ec` | 110/19/94 | `--tint-moss` | |
| 1 | `#fff1ef` | 8/100/97 | `--tint-danger` | |
| 1 | `#eef6ff` | 212/100/97 | `--tint-info` | |
| 1 | `#fff8e8` | 42/100/95 | `--tint-clay` | |
| 1 | `#ffd36f` | 42/100/72 | `--color-clay` | |
| 1 | `#9ccdb6` | 152/33/71 | `--color-moss` | |
| 1 | `#f0b4ad` | 6/69/81 | `--color-danger` | |
| 1 | `#b94a40` | 5/49/49 | `--color-danger` | |
| 1 | `#a9cdf4` | 211/77/81 | `--color-info` | |
| 1 | `#e6c680` | 41/67/70 | `--color-clay` | |
| 1 | `#8c6118` | 38/71/32 | `--color-clay` | |
| 1 | `#9f443c` | 5/45/43 | `--color-danger` | |
| 1 | `#2f6099` | 212/53/39 | `--color-info` | |
| 1 | `#9a6a1d` | 37/68/36 | `--color-clay` | |
| 1 | `#cde5d4` | 138/32/85 | `--color-moss` | |
| 1 | `#55625d` | 157/7/36 | `--color-muted` | |
| 1 | `#f4f7fb` | 214/47/97 | `--tint-info` | |
| 1 | `#1f476f` | 210/56/28 | `--color-info` | |
| 1 | `#aebdb3` | 140/10/71 | `--color-border-strong` | |
| 1 | `#9ac5ad` | 147/27/69 | `--color-moss` | |
| 1 | `#c8d4cb` | 135/12/81 | `--color-sunken` | |
| 1 | `#f4f1ea` | 42/31/94 | `--tint-clay` | |
| 1 | `#7b6b58` | 33/17/41 | `--color-muted` | |
| 1 | `#9a8973` | 34/16/53 | `--color-muted` | |
| 1 | `#c9d3ef` | 224/54/86 | `--color-info` | |
| 1 | `#bfd8d2` | 166/24/80 | `--color-moss` | |
| 1 | `#d5dced` | 223/40/88 | `--tint-info` | |
| 1 | `#2f4f96` | 221/52/39 | `--color-info` | |
| 1 | `#1c2749` | 225/45/20 | `--color-info` | |
| 1 | `#fbf8f0` | 44/58/96 | `--tint-clay` | |
| 1 | `#eef8f5` | 162/42/95 | `--tint-moss` | |
| 1 | `#8196d0` | 224/46/66 | `--color-info` | |
| 1 | `#8a5a06` | 38/92/28 | `--color-clay` | |
| 1 | `#fff7ed` | 33/100/96 | `--tint-clay` | |
| 1 | `#e5b862` | 39/72/64 | `--color-clay` | |
| 1 | `#f7dfad` | 41/82/82 | `--color-clay` | |
| 1 | `#6b460a` | 37/83/23 | `--color-clay` | |
| 1 | `#f2f6ef` | 94/28/95 | `--tint-moss` | |
| 1 | `#6b7a71` | 144/7/45 | `--color-muted` | |
| 1 | `#cbd6cb` | 120/12/82 | `--color-sunken` | |
| 1 | `#3f6d3a` | 114/31/33 | `--color-moss` | |
| 1 | `#56635d` | 152/7/36 | `--color-muted` | |
| 1 | `#55635d` | 154/8/36 | `--color-muted` | |
| 1 | `#fff6e5` | 39/100/95 | `--tint-clay` | |
| 1 | `#f0d8a8` | 40/71/80 | `--color-clay` | |
| 1 | `#8a5a12` | 36/77/31 | `--color-clay` | |
| 1 | `#eff3ec` | 94/23/94 | `--tint-moss` | |
| 1 | `#2f5597` | 218/53/39 | `--color-info` | |
| 1 | `#e5eae3` | 103/14/90 | `--color-page` | |
| 1 | `#f4f7f2` | 96/24/96 | `--tint-moss` | |
| 1 | `#5a655f` | 147/6/37 | `--color-muted` | |
| 1 | `#e6f4ea` | 137/39/93 | `--tint-moss` | |
| 1 | `#f2f7ff` | 217/100/97 | `--tint-info` | |
| 1 | `#c9dcff` | 219/100/89 | `--tint-info` | |
| 1 | `#2f4a7a` | 218/44/33 | `--color-info` | |
| 1 | `#eaf3ee` | 147/27/94 | `--tint-moss` | |
| 1 | `#d64545` | 0/64/55 | `--color-danger` | |
| 1 | `#e9f1ff` | 218/100/96 | `--tint-info` | |
| 1 | `#a9c8ff` | 218/100/83 | `--color-info` | |
| 1 | `#2f6fed` | 220/84/56 | `--color-info` | |
| 1 | `#16305c` | 218/61/22 | `--color-info` | |
| 1 | `#55635c` | 150/8/36 | `--color-muted` | |
| 1 | `#eef0ff` | 233/100/97 | `--tint-info` | |
| 1 | `#4b45b5` | 243/45/49 | `--color-info` | |
| 1 | `#fdeede` | 31/89/93 | `--tint-clay` | |
| 1 | `#a4622a` | 28/59/40 | `--color-clay` | |
| 1 | `#f3ecff` | 262/100/96 | `--tint-pending` | |
| 1 | `#6b46b5` | 260/44/49 | `--color-info` | |
| 1 | `#e7f3ee` | 155/33/93 | `--tint-moss` | |
| 1 | `#1f7a52` | 154/59/30 | `--color-moss` | |
| 1 | `#4d5852` | 147/7/32 | `--color-ink` | |
| 1 | `#2f6bff` | 223/100/59 | `--color-info` | |
| 1 | `#55605a` | 147/6/35 | `--color-muted` | |
| 1 | `#f0e2c0` | 43/62/85 | `--color-clay` | |
| 1 | `#b9c6ba` | 125/10/75 | `--color-border-strong` | |
| 1 | `#e4f3ea` | 144/38/92 | `--tint-moss` | |
| 1 | `#d0554a` | 5/59/55 | `--color-danger` | |
| 1 | `#f0c8c2` | 8/61/85 | `--color-danger` | |
| 1 | `#eef4e6` | 86/39/93 | `--tint-moss` | |
| 1 | `#f0d69a` | 42/74/77 | `--color-clay` | |
| 1 | `#d7e3d5` | 111/20/86 | `--color-moss` | |
| 1 | `#f4e9e7` | 9/37/93 | `--tint-danger` | |
| 1 | `#7d2f28` | 5/52/32 | `--color-danger` | |
| 1 | `#f2f5f1` | 105/17/95 | `--color-page` | |
| 1 | `#f2f7f0` | 103/30/95 | `--tint-moss` | |
| 1 | `#f6dedb` | 7/60/91 | `--tint-danger` | |
