import { join } from "node:path";
import { getDb } from "../lib/db";
import { importAVoir } from "./importAVoir";

const gdprDir = join(process.cwd(), "gdpr-data");
const db = getDb();
const n = importAVoir(db, gdprDir);
console.log(`Watchlist « à voir » : ${n} titre(s) au total.`);
db.close();
