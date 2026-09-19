/**
 * Read-only data-quality report for the legacy `registers` collection.
 *
 * Checks the stored values against the enums the current Mongoose schema
 * enforces, and resolves where the child collections' ObjectId references
 * actually point. Writes nothing.
 *
 *   node scripts/inspect-data-quality.js
 */
import mongoose from "mongoose";
import "dotenv/config";

const SCHEMA_ENUMS = {
  role: ["Admin", "Student", "Teacher"],
  gender: ["male", "female", "other"],
  app: ["WhatsApp", "Teams", "Google Meet", "Telegram", "Zoom"],
  course: ["Qaida", "Tajweed", "Nazra", "Hifz", "Namaz", "Arabic", "Islamic Studies"],
  classDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const registers = db.collection("registers");
  const docs = await registers.find({}).toArray();

  console.log("=== distinct values vs schema enums ===");
  for (const [field, allowed] of Object.entries(SCHEMA_ENUMS)) {
    const seen = new Map();
    for (const d of docs) {
      const raw = d[field];
      const values = Array.isArray(raw) ? raw : [raw];
      for (const v of values) {
        if (v === undefined || v === null || v === "") continue;
        seen.set(v, (seen.get(v) || 0) + 1);
      }
    }
    console.log(`\n${field}:`);
    for (const [value, n] of [...seen.entries()].sort((a, b) => b[1] - a[1])) {
      const ok = allowed.includes(value);
      const fix = ok ? "" : ` -> ${allowed.find((a) => a.toLowerCase() === String(value).toLowerCase()) || "NO CASE-INSENSITIVE MATCH"}`;
      console.log(`  ${String(n).padStart(4)}  ${JSON.stringify(value)} ${ok ? "OK" : "VIOLATES ENUM" + fix}`);
    }
  }

  console.log("\n=== fields the current schema expects but registers lacks ===");
  const expected = [
    "status", "roll_no", "fees", "feeStatus", "feesPaid", "totalFeePaid",
    "feeHistory", "assignedTeacher", "lastActive", "teacherInstructions",
    "adminNotes", "qualification", "experience", "expertise", "bio",
  ];
  for (const f of expected) {
    const n = docs.filter((d) => d[f] !== undefined).length;
    console.log(`  ${String(n).padStart(4)}/${docs.length}  ${f}`);
  }

  console.log("\n=== field-length violations against current schema ===");
  const tooLongName = docs.filter((d) => d.name && d.name.length > 30);
  const shortName = docs.filter((d) => d.name && d.name.length < 3);
  const badPhone = docs.filter((d) => d.phone && (d.phone.length < 10 || d.phone.length > 15));
  console.log(`  name > 30 chars: ${tooLongName.length}`, tooLongName.map((d) => d.email));
  console.log(`  name < 3 chars : ${shortName.length}`, shortName.map((d) => d.email));
  console.log(`  phone length out of 10-15: ${badPhone.length}`, badPhone.map((d) => `${d.email}:${d.phone}(${d.phone.length})`));

  console.log("\n=== teacher/admin accounts in registers ===");
  for (const d of docs.filter((x) => x.role !== "Student")) {
    console.log(`  ${d.role.padEnd(8)} ${d._id} ${d.email} | name=${d.name}`);
  }

  console.log("\n=== where child-collection references actually point ===");
  const refs = [
    ["sessions", "teacherId"], ["sessions", "studentId"],
    ["progresses", "studentId"], ["achievements", "studentId"],
    ["notifications", "userId"],
  ];
  const registerIds = new Set(docs.map((d) => d._id.toString()));
  for (const [colName, field] of refs) {
    const rows = await db.collection(colName).find({}).project({ [field]: 1 }).toArray();
    const inRegisters = rows.filter((r) => r[field] && registerIds.has(r[field].toString()));
    const orphan = rows.filter((r) => r[field] && !registerIds.has(r[field].toString()));
    console.log(`  ${colName}.${field}: ${rows.length} total, ${inRegisters.length} resolve in registers, ${orphan.length} orphan`);
    if (orphan.length) {
      const distinct = [...new Set(orphan.map((r) => r[field].toString()))];
      console.log(`    orphan ids (${distinct.length} distinct):`, distinct.slice(0, 10));
    }
  }

  console.log("\n=== counters ===");
  console.log(await db.collection("counters").find({}).toArray());

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error("Inspection failed:", err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
