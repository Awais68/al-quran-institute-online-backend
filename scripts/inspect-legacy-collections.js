/**
 * Read-only inspection of the legacy account collections.
 *
 * The live accounts turned out to live in `registers`, not `users`, so this
 * dumps the real shape of every account-ish collection before anything is
 * migrated. Writes nothing. Safe to run against production.
 *
 *   node scripts/inspect-legacy-collections.js
 */
import mongoose from "mongoose";
import "dotenv/config";

const ACCOUNT_COLLECTIONS = ["registers", "users", "teachers", "students"];

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  for (const name of ACCOUNT_COLLECTIONS) {
    const col = db.collection(name);
    const count = await col.countDocuments();
    console.log(`\n================ ${name} (${count} docs) ================`);
    if (count === 0) continue;

    console.log("--- indexes ---");
    console.log(JSON.stringify(await col.indexes(), null, 2));

    console.log("--- role distribution ---");
    console.log(
      await col.aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray()
    );

    console.log("--- field coverage ---");
    const docs = await col.find({}).toArray();
    const fields = {};
    for (const d of docs) {
      for (const k of Object.keys(d)) fields[k] = (fields[k] || 0) + 1;
    }
    Object.entries(fields)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, n]) => console.log(String(n).padStart(5), k));

    console.log("--- sample doc (password redacted) ---");
    const sample = { ...docs[0] };
    if (sample.password) sample.password = `<bcrypt:${String(sample.password).slice(0, 7)}...>`;
    console.log(JSON.stringify(sample, null, 2));

    console.log("--- duplicate emails within collection ---");
    console.log(
      await col
        .aggregate([
          { $group: { _id: "$email", n: { $sum: 1 } } },
          { $match: { n: { $gt: 1 } } },
        ])
        .toArray()
    );
  }

  console.log("\n================ cross-collection email overlap ================");
  const emailsOf = async (name) =>
    new Set(
      (await db.collection(name).find({}).project({ email: 1 }).toArray())
        .map((d) => d.email)
        .filter(Boolean)
    );
  const sets = {};
  for (const name of ACCOUNT_COLLECTIONS) sets[name] = await emailsOf(name);
  for (const a of ACCOUNT_COLLECTIONS) {
    for (const b of ACCOUNT_COLLECTIONS) {
      if (a >= b) continue;
      const shared = [...sets[a]].filter((e) => sets[b].has(e));
      if (shared.length) console.log(`${a} ∩ ${b}:`, shared);
    }
  }

  console.log("\n================ referenced ids: which collection owns them ================");
  const refs = [
    ["sessions", "teacherId"],
    ["sessions", "studentId"],
    ["progresses", "studentId"],
    ["achievements", "studentId"],
    ["notifications", "userId"],
  ];
  for (const [col, field] of refs) {
    const docs = await db.collection(col).find({ [field]: { $ne: null } }).project({ [field]: 1 }).toArray();
    const tally = {};
    for (const d of docs) {
      const id = d[field];
      let owner = "DANGLING";
      for (const name of ACCOUNT_COLLECTIONS) {
        if (await db.collection(name).findOne({ _id: id })) {
          owner = name;
          break;
        }
      }
      tally[owner] = (tally[owner] || 0) + 1;
    }
    console.log(`${col}.${field}:`, tally);
  }

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error("Inspection failed:", err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
