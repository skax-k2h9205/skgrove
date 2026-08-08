import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Grid3x3,
  ImagePlus,
  MessageCircle,
  PartyPopper,
  Pencil,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { compressImage } from '../../imageCompress';
import {
  deleteMemoryAssetRecord,
  deleteMemoryRecord,
  loadMemories,
  saveMemories,
  uploadMemoryAssetFile,
} from '../../memoryStore';
import type { CurrentUser, MemoryAsset, MemoryEmoji, TeamMemory } from '../../types';

type MemoryProps = {
  currentUser: CurrentUser;
};

const initialMemories: TeamMemory[] = [];

const assetTones: MemoryAsset['tone'][] = ['green', 'blue', 'coral', 'amber'];
const emojiOptions: MemoryEmoji[] = ['👍', '👏', '😂', '🔥', '💚'];

function shortDate(date: string) {
  const [, month, day] = date.split('-');
  return `${Number(month)}/${Number(day)}`;
}

// 로컬 기준 YYYY-MM-DD. toISOString 은 UTC 라 한국(+9)에서 하루가 밀려,
// 고른 날짜와 저장되는 날짜가 어긋난다. 지역 시간 그대로 키를 만든다.
function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

type MonthCell = { key: string; day: number; memory?: TeamMemory } | null;

// 한 달치 달력 칸. 1일 앞의 빈칸(전 주 요일 맞춤)은 null 로 둔다.
// 원하는 달로 넘겨가며 아무 날짜나 고를 수 있게, 3주 고정창이 아니라 월 단위로 만든다.
function getMonthCells(year: number, month: number, memories: TeamMemory[]): MonthCell[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventMap = new Map(memories.map((memory) => [memory.date, memory]));

  const cells: MonthCell[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = toDateKey(new Date(year, month, day));
    cells.push({ key, day, memory: eventMap.get(key) });
  }
  return cells;
}

export function Memory({ currentUser }: MemoryProps) {
  const [memories, setMemories] = useState<TeamMemory[]>(initialMemories);
  const [selectedId, setSelectedId] = useState(initialMemories[0]?.id ?? 0);
  const [selectedAssetId, setSelectedAssetId] = useState(initialMemories[0]?.assets[0]?.id ?? 0);
  const [assetCommentDrafts, setAssetCommentDrafts] = useState<Record<number, string>>({});
  // 인스타 프로필의 탭. 기본은 격자다 — 이 화면에 오는 이유가 사진을 보는 것이라
  // 캘린더(행사 만들기)는 필요할 때 들어가는 두 번째 탭으로 내렸다.
  const [tab, setTab] = useState<'grid' | 'calendar'>('grid');
  // 게시물 탭 안의 두 단계. 'events'는 행사별 커버 한 장씩 보는 앨범 목록,
  // 'detail'은 한 행사로 들어가 그 안의 사진들을 보고 올리는 곳이다.
  const [view, setView] = useState<'events' | 'detail'>('events');
  // 상세에서 행사명·장소를 고쳐 쓰는 중인지. 앨범을 옮기면 항상 닫는다.
  const [editingInfo, setEditingInfo] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [placeDraft, setPlaceDraft] = useState('');

  // 프로필 통계. 인스타의 게시물·팔로워 자리라 팀 전체를 세야 뜻이 맞는다.
  const totalAssets = memories.reduce((sum, memory) => sum + memory.assets.length, 0);
  const contributorCount = new Set(
    memories.flatMap((memory) => memory.assets.map((asset) => asset.uploader)),
  ).size;

  // 행사가 하나도 없을 수 있다(가데이터를 걷어낸 첫 상태). 이 경우 selectedMemory 는
  // undefined 이고, 게시물 탭은 늘 앨범 목록(빈 안내)만 보여주므로 상세를 못 만진다.
  const selectedMemory = memories.find((memory) => memory.id === selectedId) ?? memories[0];
  const selectedAsset =
    selectedMemory?.assets.find((asset) => asset.id === selectedAssetId) ?? selectedMemory?.assets[0];
  // 달력이 보여주는 달. 기본은 실제 이번 달이고, 이전/다음 버튼으로 옮긴다.
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const monthCells = useMemo(
    () => getMonthCells(monthCursor.year, monthCursor.month, memories),
    [monthCursor, memories],
  );
  const shiftMonth = (delta: number) => {
    setMonthCursor((cursor) => {
      const moved = new Date(cursor.year, cursor.month + delta, 1);
      return { year: moved.getFullYear(), month: moved.getMonth() };
    });
  };

  useEffect(() => {
    let isMounted = true;

    loadMemories(initialMemories).then((loadedMemories) => {
      if (!isMounted) return;
      setMemories(loadedMemories);
      setSelectedId(loadedMemories[0]?.id ?? 0);
      setSelectedAssetId(loadedMemories[0]?.assets[0]?.id ?? 0);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const persistMemories = (nextMemories: TeamMemory[]) => {
    setMemories(nextMemories);
    void saveMemories(nextMemories);
  };

  // 한 행사 앨범으로 들어간다. 어디서 부르든(스토리·캘린더·목록) 게시물 탭의
  // 상세로 데려가, 사진을 보고 바로 올릴 수 있게 한다.
  const openAlbum = (memory: TeamMemory) => {
    setSelectedId(memory.id);
    setSelectedAssetId(memory.assets[0]?.id ?? 0);
    setEditingInfo(false);
    setTab('grid');
    setView('detail');
  };

  // 행사명·장소 편집을 연다. 지금 값으로 입력칸을 채운다.
  const startEditInfo = () => {
    if (!selectedMemory) return;
    setTitleDraft(selectedMemory.title);
    setPlaceDraft(selectedMemory.place);
    setEditingInfo(true);
  };

  const saveAlbumInfo = () => {
    if (!selectedMemory) return;
    const title = titleDraft.trim() || selectedMemory.title;
    const place = placeDraft.trim() || '장소 미정';
    persistMemories(
      memories.map((memory) => (memory.id === selectedMemory.id ? { ...memory, title, place } : memory)),
    );
    setEditingInfo(false);
  };

  // 행사 삭제 — 사진·영상까지 함께 지운다. 화면(로컬)을 먼저 정리하고 목록으로
  // 빠진 뒤, Supabase 의 파일·자산행·행사행을 지운다. persistMemories 는 upsert 라
  // 지운 행사를 되살리지 않게, 남은 것만 저장하고 삭제는 별도로 호출한다.
  const deleteAlbum = async (memory: TeamMemory) => {
    const ok = window.confirm(`'${memory.title}' 행사를 삭제할까요?\n이 행사의 사진·영상도 함께 지워집니다.`);
    if (!ok) return;

    const remaining = memories.filter((item) => item.id !== memory.id);
    persistMemories(remaining);
    setEditingInfo(false);
    setView('events');
    setSelectedId(remaining[0]?.id ?? 0);
    setSelectedAssetId(remaining[0]?.assets[0]?.id ?? 0);

    await Promise.all(memory.assets.map((asset) => deleteMemoryAssetRecord(asset)));
    await deleteMemoryRecord(memory.id);
  };

  const selectCalendarDay = (date: string, memory?: TeamMemory) => {
    if (memory) {
      openAlbum(memory);
      return;
    }

    const [, month, day] = date.split('-');
    const nextMemory: TeamMemory = {
      id: Date.now(),
      title: `${Number(month)}/${Number(day)} 팀 추억`,
      date,
      place: '장소 미정',
      host: currentUser.name,
      createdBy: currentUser.name,
      summary: '새 추억 공간이에요. 게시물 탭에서 사진과 영상을 올려 함께 채워가요.',
      tags: ['새앨범'],
      assets: [],
      comments: [],
      reactions: { 좋아요: 0, 웃겨요: 0, 또가요: 0 },
    };

    persistMemories([...memories, nextMemory].sort((a, b) => a.date.localeCompare(b.date)));
    // 새 앨범은 바로 상세로 들어가 첫 사진을 올릴 수 있게 한다.
    setSelectedId(nextMemory.id);
    setSelectedAssetId(0);
    setTab('grid');
    setView('detail');
  };

  const uploadAssets = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!selectedMemory) return;
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const uploadedAssets: MemoryAsset[] = await Promise.all(
      files.map(async (file, index) => {
        const id = Date.now() + index;
        const isVideo = file.type.startsWith('video');
        // 사진은 업로드 전에 줄여 용량을 아낀다(영상·GIF는 compressImage가 원본 유지).
        const toUpload = await compressImage(file);
        const localPreviewUrl = URL.createObjectURL(toUpload);
        const stored = await uploadMemoryAssetFile(selectedMemory.id, id, toUpload);

        return {
          id,
          type: isVideo ? 'video' : 'photo',
          title: file.name.replace(/\.[^/.]+$/, ''),
          uploader: currentUser.name,
          tone: assetTones[(selectedMemory.assets.length + index) % assetTones.length],
          uploadedAt: '방금',
          reactions: { '👍': 0, '👏': 0, '😂': 0, '🔥': 0, '💚': 0 },
          comments: [],
          previewUrl: stored.previewUrl || localPreviewUrl,
          storagePath: stored.storagePath || undefined,
        };
      }),
    );

    persistMemories(
      memories.map((memory) =>
        memory.id === selectedMemory.id
          ? { ...memory, assets: [...uploadedAssets, ...memory.assets] }
          : memory,
      ),
    );
    setSelectedAssetId(uploadedAssets[0].id);
    event.target.value = '';
  };

  const reactAsset = (assetId: number, emoji: MemoryEmoji) => {
    if (!selectedMemory) return;
    persistMemories(
      memories.map((memory) =>
        memory.id === selectedMemory.id
          ? {
              ...memory,
              assets: memory.assets.map((asset) =>
                asset.id === assetId
                  ? { ...asset, reactions: { ...asset.reactions, [emoji]: asset.reactions[emoji] + 1 } }
                  : asset,
              ),
            }
          : memory,
      ),
    );
  };

  const addAssetComment = (assetId: number) => {
    if (!selectedMemory) return;
    const comment = assetCommentDrafts[assetId]?.trim();
    if (!comment) return;

    persistMemories(
      memories.map((memory) =>
        memory.id === selectedMemory.id
          ? {
              ...memory,
              assets: memory.assets.map((asset) =>
                asset.id === assetId ? { ...asset, comments: [comment, ...asset.comments] } : asset,
              ),
            }
          : memory,
      ),
    );
    setAssetCommentDrafts({ ...assetCommentDrafts, [assetId]: '' });
  };

  return (
    <section className="screen ig-profile">
      {/*
        인스타 프로필 헤더. 이 앱의 계정은 사람이 아니라 팀 하나라
        아바타도 팀이고 통계도 팀의 것이다. 개인 계정을 만들면
        익명 접수의 전제가 흔들린다.
      */}
      <header className="ig-prof-head">
        <span className="ig-prof-ava">
          <PartyPopper size={38} strokeWidth={1.4} />
        </span>
        <div className="ig-prof-info">
          <div className="ig-prof-line">
            <h2>team_memory</h2>
            <button className="ig-btn-soft" type="button" onClick={() => setTab('calendar')}>
              행사 만들기
            </button>
          </div>
          <div className="ig-prof-stats">
            <span>
              행사 <b>{memories.length}</b>
            </span>
            <span>
              기록 <b>{totalAssets}</b>
            </span>
            <span>
              함께한 사람 <b>{contributorCount}</b>
            </span>
          </div>
          <p className="ig-prof-bio">
            <b>팀 추억</b>
            행사별로 사진 · 영상 · 반응을 한 곳에 모아요.
          </p>
        </div>
      </header>

      {/* 하이라이트. 인스타에서 하이라이트는 지나간 스토리를 묶어두는 자리라
          지난 행사와 성질이 같다. 링을 칠하지 않는 이유도 같다 — 이미 본 것이다. */}
      <div className="ig-tray ig-highlights">
        {memories.map((memory) => (
          <button
            className="ig-story"
            key={memory.id}
            onClick={() => openAlbum(memory)}
            type="button"
          >
            <span className={memory.id === selectedMemory?.id ? 'ig-ring' : 'ig-ring seen'}>
              <span className="ig-thumb">
                <CalendarDays size={22} strokeWidth={1.6} />
              </span>
            </span>
            <small>{memory.title}</small>
          </button>
        ))}
      </div>

      <div className="ig-tabs">
        <button
          className={tab === 'grid' ? 'on' : ''}
          onClick={() => {
            setTab('grid');
            setView('events');
          }}
          type="button"
        >
          <Grid3x3 size={12} />
          게시물
        </button>
        <button
          className={tab === 'calendar' ? 'on' : ''}
          onClick={() => setTab('calendar')}
          type="button"
        >
          <CalendarDays size={12} />
          캘린더
        </button>
      </div>

      {tab === 'grid' ? (
        view === 'events' || !selectedMemory ? (
          // 앨범 목록 — 행사마다 커버 한 장. 인스타 프로필 격자를 재사용하되
          // 각 칸이 사진 하나가 아니라 '행사 하나'다. 누르면 그 행사 상세로 들어간다.
          <div className="ig-grid-tab">
            <p className="ig-grid-note">
              <b>행사 앨범</b>
              행사를 누르면 그 행사의 사진을 볼 수 있어요.
            </p>
            <div className="ig-cells">
              {memories.map((memory) => {
                const cover = memory.assets.find((asset) => asset.previewUrl);
                return (
                  <button
                    className="ig-cell memory-album-cell"
                    key={memory.id}
                    onClick={() => openAlbum(memory)}
                    type="button"
                  >
                    {cover?.previewUrl ? (
                      cover.type === 'photo' ? (
                        <img alt="" src={cover.previewUrl} />
                      ) : (
                        <video muted src={cover.previewUrl} />
                      )
                    ) : (
                      <span className="ig-cell-blank">
                        <CalendarDays size={26} />
                      </span>
                    )}
                    <span className="memory-album-cap">
                      <strong>{memory.title}</strong>
                      <small>{memory.assets.length}개</small>
                    </span>
                  </button>
                );
              })}
            </div>
            {memories.length === 0 && (
              <div className="memory-empty">캘린더 탭에서 행사를 먼저 만들어 보세요.</div>
            )}
          </div>
        ) : (
        <div className="ig-grid-tab">
          <button
            className="memory-back"
            type="button"
            onClick={() => {
              setView('events');
              setEditingInfo(false);
            }}
          >
            <ChevronLeft size={16} />
            앨범 목록
          </button>

          {editingInfo ? (
            <div className="memory-info-edit">
              <label>
                행사명
                <input
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  placeholder="예: 여름 팀 워크샵"
                  aria-label="행사명"
                />
              </label>
              <label>
                장소
                <input
                  value={placeDraft}
                  onChange={(event) => setPlaceDraft(event.target.value)}
                  placeholder="예: 성수 라운지"
                  aria-label="장소"
                />
              </label>
              <div className="memory-info-edit-actions">
                <button className="secondary-button" type="button" onClick={() => setEditingInfo(false)}>
                  취소
                </button>
                <button className="primary-button" type="button" onClick={saveAlbumInfo}>
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div className="memory-detail-head">
              <p className="ig-grid-note">
                <b>{selectedMemory.title}</b>
                {selectedMemory.date} · {selectedMemory.place} · 담당 {selectedMemory.host}
              </p>
              <div className="memory-detail-actions">
                <button type="button" onClick={startEditInfo}>
                  <Pencil size={14} />
                  행사명 수정
                </button>
                <button type="button" className="danger" onClick={() => void deleteAlbum(selectedMemory)}>
                  <Trash2 size={14} />
                  삭제
                </button>
              </div>
            </div>
          )}

          {/* 인스타 프로필 격자. 1:1 · 3열 · 3px 간격. 셀을 누르면 아래 게시물이 바뀐다. */}
          <div className="ig-cells">
            {selectedMemory.assets.map((asset) => (
              <button
                className={asset.id === selectedAsset?.id ? 'ig-cell on' : 'ig-cell'}
                key={asset.id}
                onClick={() => setSelectedAssetId(asset.id)}
                type="button"
              >
                {asset.previewUrl ? (
                  asset.type === 'photo' ? (
                    <img alt="" src={asset.previewUrl} />
                  ) : (
                    <video muted src={asset.previewUrl} />
                  )
                ) : (
                  <span className="ig-cell-blank">
                    {asset.type === 'photo' ? <ImagePlus size={26} /> : <Film size={26} />}
                  </span>
                )}
                {asset.type === 'video' && (
                  <i className="ig-cell-mark" aria-hidden="true">
                    <Film size={15} />
                  </i>
                )}
              </button>
            ))}
          </div>

          {selectedMemory.assets.length === 0 && (
            <div className="memory-empty">첫 사진이나 영상을 올려보세요.</div>
          )}

          <div className="memory-upload-box">
            <div>
              <UploadCloud size={20} />
              <strong>내 사진첩에서 여러 개 올리기</strong>
            </div>
            <label className="memory-file-drop">
              <input accept="image/*,video/*" multiple type="file" onChange={uploadAssets} />
              <span>사진/동영상 선택</span>
              <small>여러 파일을 한 번에 선택하면 앨범에 바로 쌓여요. 사진은 올릴 때 자동으로 가볍게 줄여 저장해요.</small>
            </label>
          </div>

          {selectedAsset && (
            <article className={`memory-post ${selectedAsset.tone}`}>
              <div className="memory-post-media">
                {selectedAsset.previewUrl ? (
                  selectedAsset.type === 'photo' ? (
                    <img alt="" src={selectedAsset.previewUrl} />
                  ) : (
                    <video controls src={selectedAsset.previewUrl} />
                  )
                ) : selectedAsset.type === 'photo' ? (
                  <ImagePlus size={36} />
                ) : (
                  <Film size={36} />
                )}
              </div>
              <div className="memory-post-side">
                <div className="memory-asset-profile">
                  <span>{selectedAsset.uploader.slice(0, 1)}</span>
                  <div>
                    <strong>{selectedAsset.uploader}</strong>
                    <small>{selectedAsset.uploadedAt}</small>
                  </div>
                </div>
                <h3>{selectedAsset.title}</h3>
                <div className="memory-emoji-actions" aria-label="사진 반응">
                  {emojiOptions.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => reactAsset(selectedAsset.id, emoji)}>
                      <span>{emoji}</span>
                      {selectedAsset.reactions[emoji]}
                    </button>
                  ))}
                </div>
                {selectedAsset.previewUrl && (
                  <div className="memory-asset-actions">
                    <a href={selectedAsset.previewUrl} rel="noreferrer" target="_blank">
                      <Download size={16} />
                      원본 보기
                    </a>
                  </div>
                )}
                <div className="memory-asset-comments">
                  <div className="memory-asset-comment-input">
                    <MessageCircle size={16} />
                    <input
                      value={assetCommentDrafts[selectedAsset.id] ?? ''}
                      onChange={(event) =>
                        setAssetCommentDrafts({ ...assetCommentDrafts, [selectedAsset.id]: event.target.value })
                      }
                      aria-label="댓글 달기"
                      placeholder="댓글 달기"
                    />
                    <button className="secondary-button" type="button" onClick={() => addAssetComment(selectedAsset.id)}>
                      등록
                    </button>
                  </div>
                  {selectedAsset.comments.map((comment) => (
                    <p key={comment}>{comment}</p>
                  ))}
                </div>
              </div>
            </article>
          )}
        </div>
        )
      ) : (
        <div className="ig-grid-tab">
          <section className="panel memory-calendar-panel">
            <div className="panel-header">
              <CalendarDays size={20} />
              <h2>행사 선택</h2>
            </div>
            <p className="memory-calendar-guide">
              빈 날짜를 누르면 그 날짜의 추억 공간이 만들어져요. 지난 행사도 이전 달로 넘겨 등록할 수 있어요.
            </p>
            <div className="memory-month-nav">
              <button type="button" aria-label="이전 달" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={18} />
              </button>
              <strong>{monthCursor.year}년 {monthCursor.month + 1}월</strong>
              <button type="button" aria-label="다음 달" onClick={() => shiftMonth(1)}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="memory-weekdays">
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="memory-calendar">
              {monthCells.map((cell, index) =>
                cell === null ? (
                  <span className="memory-day-empty" key={`empty-${index}`} aria-hidden="true" />
                ) : (
                  <button
                    className={cell.memory?.id === selectedMemory?.id && cell.memory ? 'selected' : ''}
                    key={cell.key}
                    // 칸이 좁아 제목을 넣을 수 없다. 이름은 툴팁과 아래 행사 목록에서 읽는다.
                    title={cell.memory ? cell.memory.title : `${cell.day}일 추억 만들기`}
                    aria-label={cell.memory ? `${cell.day}일 ${cell.memory.title}` : `${cell.day}일 추억 만들기`}
                    onClick={() => selectCalendarDay(cell.key, cell.memory)}
                  >
                    <span>{cell.day}</span>
                    {cell.memory ? (
                      <small className="memory-day-title">{cell.memory.title}</small>
                    ) : (
                      <small className="memory-create-hint">만들기</small>
                    )}
                  </button>
                ),
              )}
            </div>
          </section>
          <section className="memory-event-list">
            {memories.map((memory) => (
              <button
                className={memory.id === selectedMemory?.id ? 'memory-event-card selected' : 'memory-event-card'}
                key={memory.id}
                onClick={() => {
                  setSelectedId(memory.id);
                  setSelectedAssetId(memory.assets[0]?.id ?? 0);
                }}
              >
                <span>{shortDate(memory.date)}</span>
                <div>
                  <strong>{memory.title}</strong>
                  <small>{memory.date} · {memory.place}</small>
                </div>
                <em>{memory.assets.length}개</em>
              </button>
            ))}
          </section>
        </div>
      )}
    </section>
  );
}
