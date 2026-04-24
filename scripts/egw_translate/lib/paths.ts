import { join } from "path";
import type { TranslateBookConfig } from "./types";

const REPO_ROOT = `${import.meta.dir}/../../..`;

export function absPath(book: TranslateBookConfig, relative: string): string {
  return join(REPO_ROOT, relative);
}

export function sourceTextPath(book: TranslateBookConfig, chapter: number): string {
  const nn = String(chapter).padStart(2, "0");
  return join(REPO_ROOT, book.sourceDir, `ch${nn}.txt`);
}

export function chunkPath(book: TranslateBookConfig, chapter: number, chunk: number): string {
  const nn = String(chapter).padStart(2, "0");
  const mm = String(chunk).padStart(2, "0");
  return join(REPO_ROOT, book.chunksDir, `ch${nn}-${mm}.txt`);
}

export function translatedChunkPath(book: TranslateBookConfig, chapter: number, chunk: number): string {
  const nn = String(chapter).padStart(2, "0");
  const mm = String(chunk).padStart(2, "0");
  return join(REPO_ROOT, book.translatedDir, `ch${nn}-${mm}.md`);
}

export function errorChunkPath(book: TranslateBookConfig, chapter: number, chunk: number): string {
  const nn = String(chapter).padStart(2, "0");
  const mm = String(chunk).padStart(2, "0");
  return join(REPO_ROOT, book.translatedDir, `ch${nn}-${mm}.err`);
}

export function hugoChapterPath(book: TranslateBookConfig, chapter: number): string {
  const nn = String(chapter).padStart(2, "0");
  return join(REPO_ROOT, book.hugoBookDir, `chuong-${nn}.md`);
}

export function chaptersJsonPath(book: TranslateBookConfig): string {
  return join(REPO_ROOT, book.sourceDir, "chapters.json");
}
