// image-proxy.mjs 는 프록시(Node 전용)라 .mjs 로 두지만, 순수 함수들은 테스트에서 가져다 쓴다.
// 그 경계에 타입을 붙여 프롬프트 조립 규칙이 조용히 바뀌지 않게 한다.
import type { IncomingMessage, ServerResponse } from 'node:http';

/** 프롬프트 조립에 필요한 등록값만. Gathering 전체를 넘길 필요가 없다. */
export type ThumbnailInput = {
  title: string;
  place: string;
  startAt: string;
  capacity: number | null | undefined;
};

export function timeOfDay(startAt: string): string;
export function castFor(capacity: number | null | undefined): string;
export function usableSubject(line: unknown): boolean;
export function sniffMime(buf: Uint8Array): string;
export function buildPrompt(subject: string, gathering: ThumbnailInput): string;
export function retryNoteFor(found: string): string;

/** 글자 없는 썸네일. 세 번 안에 못 만들면 null — 호출부는 기존 포스터로 떨어진다. */
export function generateThumbnail(
  gathering: ThumbnailInput,
): Promise<{ mime: string; dataUri: string; attempts: number } | null>;

export function handleGatheringImage(req: IncomingMessage, res: ServerResponse): void;
