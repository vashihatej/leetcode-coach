import { openDb } from "../db/index.js";
import { createApp } from "./app.js";
import { PORT, DB_PATH, SESSION_PATH } from "../config.js";

const db = openDb(DB_PATH);
const app = createApp(db, SESSION_PATH);

app.listen(PORT, () => {
  console.log(`coach server listening on http://localhost:${PORT}`);
  console.log(`session file: ${SESSION_PATH}`);
});
