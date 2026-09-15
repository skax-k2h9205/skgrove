/*
  목록 → 상세를 브라우저 히스토리에 한 칸으로 남기는 규약.

  캔미팅은 상세 id 를 App 이 들고 있어서(selectedCanId) popstate 에서 바로 바꿔주면 됐다.
  모임·장터 보드는 상세 상태를 자기 안에 들고 있고(view/selectedId) 목록 필터·폼 같은 다른
  화면 상태와 얽혀 있어, 그걸 App 으로 끌어올리면 두 컴포넌트를 크게 뜯어야 한다.

  그래서 상태는 보드에 두고 App 은 신호만 내려보낸다. 히스토리를 쌓고 되감는 일은 App 이,
  실제로 열고 닫는 일은 보드가 한다.

  tick 은 '뒤로가기가 이 화면에 닿았다'는 신호다. 0 이면 아직 없었다는 뜻이라 보드는 무시한다.
  같은 상세로 두 번 돌아와도 tick 이 달라지므로 효과가 다시 돈다.
*/
export type DetailNav = {
  /** popstate 가 이 화면에 닿은 횟수. 0 이면 아직 없음. */
  tick: number;
  /** 돌아간 칸이 담고 있던 상세 id. null 이면 목록으로 돌아가야 한다. */
  id: string | null;
};

export const NO_DETAIL_NAV: DetailNav = { tick: 0, id: null };
