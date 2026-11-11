import "server-only";
import { join } from "node:path";
import { createFsStorage, type ContentStorage } from "./storage";

/** Pasta dos arquivos: CONTENT_DIR, ou /data/content em produção (volume do Easypanel), ou .content no desenvolvimento. */
export const contentDir = () => process.env.CONTENT_DIR?.trim() || (process.env.NODE_ENV === "production" ? "/data/content" : join(process.cwd(), ".content"));

let instance: ContentStorage | null = null;
export const getStorage = (): ContentStorage => (instance ??= createFsStorage(contentDir()));
