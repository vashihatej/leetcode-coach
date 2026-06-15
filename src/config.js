import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const PORT = Number(process.env.COACH_PORT) || 8765;
export const HOST = process.env.COACH_HOST || "127.0.0.1";
export const DB_PATH = path.join(root, "coach.db");
export const SESSION_PATH = path.join(root, "session.md");
export const PUBLIC_DIR = path.join(root, "public");
