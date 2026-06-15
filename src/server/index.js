import { openDb } from "../db/index.js";
import { createApp } from "./app.js";
import { HOST, PORT, DB_PATH, SESSION_PATH } from "../config.js";

const db = openDb(DB_PATH);
const app = createApp(db, SESSION_PATH);

app.listen(PORT, HOST, () => {
  console.log(`coach server listening on http://${HOST}:${PORT}`);
  console.log(`session file: ${SESSION_PATH}`);
});
