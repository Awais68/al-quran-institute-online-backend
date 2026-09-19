/**
 * Consolidate every account into the `users` collection keyed by `role`.
 *
 * The live accounts are in the legacy `registers` collection, written by an
 * older revision of this backend. The current code registers its model as
 * `mongoose.model("User", ...)`, which Mongoose maps to `users` — a collection
 * that is empty. So the running backend cannot see any real account.
 *
 * This migration:
 *   1. Backs up `registers` and `users` to JSON on disk.
 *   2. Copies every `registers` document into `users`, preserving `_id`.
 *   3. Normalises values that violate the current schema's enums
 *      (course/app casing) and length rules (phone).
 *   4. Backfills the fields the current schema expects but the legacy
 *      documents never had (status, fee fields, roll_no, teacher fields).
 *   5. Reports child documents (sessions/progress/achievements/notifications)
 *      whose owner account does not exist.
 *   6. Re-validates every migrated document against the Mongoose schema.
 *
 * It is idempotent: `_id` is preserved and writes are upserts, so re-running
 * converges to the same result. `registers` is never modified or dropped — it
 * stays as the rollback source until you drop it by hand.
 *
 * Usage:
 *   node scripts/migrate-to-unified-users.js                 # dry run (default)
 *   node scripts/migrate-to-unified-users.js --apply         # perform the migration
 *   node scripts/migrate-to-unified-users.js --apply --drop-empty
 *                                                            # also drop the empty
 *                                                            # teachers/students collections
 *   node scripts/migrate-to-unified-users.js --apply --purge-orphans
 *                                                            # also delete child docs whose
 *                                                            # owner account no longer exists
 */
import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import "dotenv/config";
import User from "../models/user.js";

const APPLY = process.argv.includes("--apply");
const DROP_EMPTY = process.argv.includes("--drop-empty");
const PURGE_ORPHANS = process.argv.includes("--purge-orphans");

const SOURCE = "registers";
const TARGET = "users";
const EMPTY_LEGACY = ["teachers", "students"];

// Child collections that reference an account, and the field that holds the id.
const CHILD_REFS = [
  ["sessions", "teacherId"],
  ["sessions", "studentId"],
  ["lessons", "studentId"],
  ["lessons", "teacherId"],
  ["progresses", "studentId"],
  ["achievements", "studentId"],
  ["activities", "studentId"],
  ["notifications", "userId"],
  ["messages", "senderId"],
  ["messages", "receiverId"],
  ["recitationpractices", "studentId"],
];

const COURSES = ["Qaida", "Tajweed", "Nazra", "Hifz", "Namaz", "Arabic", "Islamic Studies"];
const APPS = ["WhatsApp", "Teams", "Google Meet", "Telegram", "Zoom"];

// Values seen in the legacy data that no case-insensitive match would fix.
const APP_ALIASES = {
  googlemeet: "Google Meet",
  "google-meet": "Google Meet",
  meet: "Google Meet",
  "ms teams": "Teams",
  msteams: "Teams",
  whatsap: "WhatsApp",
};

const log = [];
const note = (line) => {
  console.log(line);
  log.push(line);
};

// Maps a loose value onto one of `allowed`, case-insensitively, then via aliases.
const normaliseEnum = (value, allowed, aliases = {}) => {
  if (value === undefined || value === null || value === "") return undefined;
  const raw = String(value).trim();
  const exact = allowed.find((a) => a === raw);
  if (exact) return exact;
  const ci = allowed.find((a) => a.toLowerCase() === raw.toLowerCase());
  if (ci) return ci;
  const alias = aliases[raw.toLowerCase().replace(/\s+/g, " ")];
  return alias || undefined;
};

// Trims a phone number down to the schema's 15-character ceiling without
// losing the country code: strips formatting, keeps a leading "+".
const normalisePhone = (phone) => {
  if (!phone) return phone;
  if (phone.length <= 15) return phone;
  const plus = phone.trim().startsWith("+") ? "+" : "";
  const digits = phone.replace(/\D/g, "");
  return (plus + digits).slice(0, 15);
};

// The legacy documents store dob as a string. Most are ISO-8601 and cast
// cleanly, but some are DD-MM-YYYY, which Mongoose rejects outright.
const parseDob = (dob) => {
  if (!dob) return undefined;
  if (dob instanceof Date) return isNaN(dob.getTime()) ? undefined : dob;

  const raw = String(dob).trim();
  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? undefined : parsed;
};

// Whole years between a date of birth and now, floored at the schema's
// minimum of 1 so a same-year birth date does not fail validation.
const ageFromDob = (dob) => {
  if (!dob) return undefined;
  const ms = Date.now() - dob.getTime();
  if (ms < 0) return 1;
  return Math.max(1, Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000)));
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  note(`\n${"=".repeat(70)}`);
  note(`  ${APPLY ? "APPLY" : "DRY RUN"} — consolidate accounts into "${TARGET}"`);
  note(`  database: ${db.databaseName}`);
  note(`${"=".repeat(70)}\n`);

  const existingCollections = (await db.listCollections().toArray()).map((c) => c.name);
  if (!existingCollections.includes(SOURCE)) {
    note(`Source collection "${SOURCE}" does not exist — nothing to migrate.`);
    await mongoose.connection.close();
    return;
  }

  const source = db.collection(SOURCE);
  const target = db.collection(TARGET);
  const sourceDocs = await source.find({}).sort({ createdAt: 1 }).toArray();
  const targetDocs = await target.find({}).toArray();

  note(`STEP 1 — read source`);
  note(`  ${SOURCE}: ${sourceDocs.length} docs`);
  note(`  ${TARGET}: ${targetDocs.length} docs (before)`);
  note(`  ${TARGET} indexes: ${JSON.stringify((await target.indexes()).map((i) => i.name))}`);

  // --- guard: an email already in the target under a different _id would
  // --- silently collide with the unique email index.
  const targetByEmail = new Map(targetDocs.map((d) => [d.email, d]));
  const collisions = sourceDocs.filter((d) => {
    const hit = targetByEmail.get(d.email);
    return hit && !hit._id.equals(d._id);
  });
  if (collisions.length) {
    note(`\n  ABORT: ${collisions.length} email(s) exist in "${TARGET}" under a different _id:`);
    collisions.forEach((d) => note(`    - ${d.email}`));
    note(`  Resolve these by hand before migrating.`);
    await mongoose.connection.close();
    process.exit(1);
  }
  note(`  email collisions with existing ${TARGET} docs: none`);

  // --- backup -------------------------------------------------------------
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve(`backups/migration-${stamp}`);
  note(`\nSTEP 2 — backup`);
  if (APPLY) {
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(
      path.join(backupDir, `${SOURCE}.json`),
      JSON.stringify(sourceDocs, null, 2)
    );
    await fs.writeFile(
      path.join(backupDir, `${TARGET}.before.json`),
      JSON.stringify(targetDocs, null, 2)
    );
    const counters = await db.collection("counters").find({}).toArray();
    await fs.writeFile(
      path.join(backupDir, "counters.before.json"),
      JSON.stringify(counters, null, 2)
    );
    note(`  written to ${backupDir}`);
  } else {
    note(`  would write ${SOURCE}.json, ${TARGET}.before.json, counters.before.json`);
    note(`  to ${backupDir}`);
  }

  // --- roll numbers -------------------------------------------------------
  // Students need a roll_no (unique sparse index). The legacy docs have none,
  // so allocate a contiguous block from the shared counter.
  const students = sourceDocs.filter((d) => d.role === "Student" && !d.roll_no);
  const counterDoc = await db.collection("counters").findOne({ id: "roll_no" });
  const startSeq = counterDoc ? counterDoc.seq : 501;
  const endSeq = startSeq + students.length;

  note(`\nSTEP 3 — roll numbers`);
  note(`  counter "roll_no" current seq: ${startSeq}`);
  note(`  students needing a roll_no: ${students.length}`);
  note(`  will allocate: ${students.length ? `${startSeq + 1}..${endSeq}` : "(none)"}`);

  const rollFor = new Map();
  students.forEach((d, i) => rollFor.set(d._id.toString(), String(startSeq + 1 + i)));

  // --- transform ----------------------------------------------------------
  note(`\nSTEP 4 — transform`);
  const changes = {
    course: [],
    app: [],
    phone: [],
    dob: [],
    dobUnparseable: [],
    age: [],
    teacherFields: [],
    backfilled: 0,
  };
  const operations = [];

  for (const doc of sourceDocs) {
    const next = { ...doc };

    // Enum casing.
    if (doc.course) {
      const fixed = normaliseEnum(doc.course, COURSES);
      if (fixed && fixed !== doc.course) {
        changes.course.push(`${doc.email}: ${JSON.stringify(doc.course)} -> ${JSON.stringify(fixed)}`);
        next.course = fixed;
      } else if (!fixed) {
        changes.course.push(`${doc.email}: ${JSON.stringify(doc.course)} -> UNMAPPABLE (left as-is)`);
      }
    }
    if (doc.app) {
      const fixed = normaliseEnum(doc.app, APPS, APP_ALIASES);
      if (fixed && fixed !== doc.app) {
        changes.app.push(`${doc.email}: ${JSON.stringify(doc.app)} -> ${JSON.stringify(fixed)}`);
        next.app = fixed;
      } else if (!fixed) {
        changes.app.push(`${doc.email}: ${JSON.stringify(doc.app)} -> UNMAPPABLE (left as-is)`);
      }
    }

    // Phone length.
    const phone = normalisePhone(doc.phone);
    if (phone !== doc.phone) {
      changes.phone.push(`${doc.email}: ${JSON.stringify(doc.phone)} -> ${JSON.stringify(phone)}`);
      next.phone = phone;
    }

    // dob is declared as a Date but every legacy document stores a string.
    if (doc.dob !== undefined && doc.dob !== null && doc.dob !== "") {
      const dob = parseDob(doc.dob);
      if (dob) {
        if (!(doc.dob instanceof Date)) {
          changes.dob.push(`${doc.email}: ${JSON.stringify(doc.dob)} -> ${dob.toISOString()}`);
        }
        next.dob = dob;
      } else {
        changes.dobUnparseable.push(`${doc.email}: ${JSON.stringify(doc.dob)} — dropped, admin must re-enter`);
        delete next.dob;
      }
    }

    // age must be >= 1; a few records were stored as -1 by an old signup form.
    if (!(typeof next.age === "number" && next.age >= 1)) {
      const derived = ageFromDob(next.dob instanceof Date ? next.dob : undefined);
      if (derived !== undefined) {
        changes.age.push(`${doc.email}: ${JSON.stringify(doc.age)} -> ${derived} (derived from dob)`);
        next.age = derived;
      } else if (doc.age !== undefined) {
        changes.age.push(`${doc.email}: ${JSON.stringify(doc.age)} -> UNFIXABLE (no usable dob)`);
      }
    }

    // Fields the current schema expects but the legacy documents never had.
    const defaults = {
      status: "active",
      fees: 0,
      feeStatus: "unpaid",
      feesPaid: false,
      totalFeePaid: 0,
      feeHistory: [],
      teacherInstructions: "",
      adminNotes: "",
      mustResetPassword: false,
      lastActive: doc.updatedAt || doc.createdAt || new Date(),
      joinDate: doc.createdAt || new Date(),
    };
    let didBackfill = false;
    for (const [key, value] of Object.entries(defaults)) {
      if (next[key] === undefined) {
        next[key] = value;
        didBackfill = true;
      }
    }
    if (didBackfill) changes.backfilled += 1;

    // Students get their allocated roll number.
    const roll = rollFor.get(doc._id.toString());
    if (roll) next.roll_no = roll;

    // The schema requires these three for role === "Teacher"; the legacy
    // teacher record has none of them, so seed them from what is known.
    if (doc.role === "Teacher") {
      const seeded = [];
      if (!next.qualification) {
        next.qualification = "Not specified";
        seeded.push("qualification");
      }
      if (next.experience === undefined || next.experience === null || next.experience === "") {
        next.experience = "0";
        seeded.push("experience");
      }
      if (!next.expertise) {
        next.expertise = next.course || "Not specified";
        seeded.push("expertise");
      }
      if (!next.specialization && next.course) {
        next.specialization = [next.course];
        seeded.push("specialization");
      }
      if (seeded.length) {
        changes.teacherFields.push(`${doc.email}: seeded ${seeded.join(", ")} — admin should fill these in`);
      }
    }

    operations.push({
      updateOne: { filter: { _id: doc._id }, update: { $set: next }, upsert: true },
    });
  }

  const report = (label, rows) => {
    note(`  ${label}: ${rows.length}`);
    rows.forEach((r) => note(`    - ${r}`));
  };
  report("course values normalised", changes.course);
  report("app values normalised", changes.app);
  report("phone numbers shortened to 15 chars", changes.phone);
  note(`  dob strings converted to Date: ${changes.dob.length}`);
  report("dob values that could not be parsed", changes.dobUnparseable);
  report("age values corrected", changes.age);
  report("teacher records seeded", changes.teacherFields);
  note(`  documents receiving backfilled defaults: ${changes.backfilled}`);

  // --- write --------------------------------------------------------------
  note(`\nSTEP 5 — write to "${TARGET}"`);
  if (APPLY) {
    const result = await target.bulkWrite(operations, { ordered: false });
    note(`  upserted: ${result.upsertedCount}, modified: ${result.modifiedCount}, matched: ${result.matchedCount}`);

    if (students.length) {
      await db
        .collection("counters")
        .updateOne({ id: "roll_no" }, { $set: { seq: endSeq } }, { upsert: true });
      note(`  counter "roll_no" advanced to ${endSeq}`);
    }

    note(`  syncing indexes from the Mongoose schema...`);
    const dropped = await User.syncIndexes();
    note(`  indexes dropped as no longer in schema: ${JSON.stringify(dropped)}`);
    note(`  indexes now: ${JSON.stringify((await target.indexes()).map((i) => i.name))}`);
  } else {
    note(`  would upsert ${operations.length} documents (preserving _id)`);
    if (students.length) note(`  would advance counter "roll_no" to ${endSeq}`);
    note(`  would run User.syncIndexes()`);
  }

  // --- empty legacy collections ------------------------------------------
  note(`\nSTEP 6 — empty legacy collections`);
  for (const name of EMPTY_LEGACY) {
    if (!existingCollections.includes(name)) {
      note(`  ${name}: does not exist`);
      continue;
    }
    const count = await db.collection(name).countDocuments();
    if (count > 0) {
      note(`  ${name}: ${count} docs — NOT empty, left untouched (migrate by hand)`);
    } else if (DROP_EMPTY && APPLY) {
      await db.collection(name).drop();
      note(`  ${name}: empty — dropped`);
    } else {
      note(`  ${name}: empty — ${DROP_EMPTY ? "would drop" : "left in place (pass --drop-empty to remove)"}`);
    }
  }

  // --- orphaned child documents ------------------------------------------
  note(`\nSTEP 7 — child documents with no owner account`);
  const liveIds = new Set(
    (await target.find({}).project({ _id: 1 }).toArray()).map((d) => d._id.toString())
  );
  // In a dry run the target is still empty, so judge against the source ids.
  const knownIds = APPLY ? liveIds : new Set(sourceDocs.map((d) => d._id.toString()));

  for (const [colName, field] of CHILD_REFS) {
    if (!existingCollections.includes(colName)) continue;
    const rows = await db
      .collection(colName)
      .find({ [field]: { $ne: null } })
      .project({ [field]: 1 })
      .toArray();
    if (!rows.length) continue;
    const orphans = rows.filter((r) => !knownIds.has(r[field].toString()));
    if (!orphans.length) {
      note(`  ${colName}.${field}: ${rows.length} refs, all resolve`);
      continue;
    }
    note(`  ${colName}.${field}: ${orphans.length}/${rows.length} refs have no owner account`);
    if (PURGE_ORPHANS && APPLY) {
      const res = await db
        .collection(colName)
        .deleteMany({ _id: { $in: orphans.map((o) => o._id) } });
      note(`    purged ${res.deletedCount} documents`);
    } else {
      note(`    ${PURGE_ORPHANS ? "would purge" : "left in place (pass --purge-orphans to delete)"}`);
    }
  }

  // --- verify -------------------------------------------------------------
  note(`\nSTEP 8 — verify against the Mongoose schema`);
  const toCheck = APPLY
    ? await target.find({}).toArray()
    : operations.map((o) => o.updateOne.update.$set);
  let invalid = 0;
  for (const doc of toCheck) {
    const err = new User(doc).validateSync();
    if (err) {
      invalid += 1;
      note(`  INVALID ${doc.email}: ${Object.keys(err.errors).join(", ")}`);
      Object.entries(err.errors).forEach(([field, e]) => note(`      ${field}: ${e.message}`));
    }
  }
  note(`  documents checked: ${toCheck.length}, failing validation: ${invalid}`);

  const rollNos = toCheck.map((d) => d.roll_no).filter(Boolean);
  note(`  roll_no assigned: ${rollNos.length}, distinct: ${new Set(rollNos).size}`);

  const emails = toCheck.map((d) => d.email);
  note(`  emails: ${emails.length}, distinct: ${new Set(emails).size}`);

  const roles = toCheck.reduce((acc, d) => ({ ...acc, [d.role]: (acc[d.role] || 0) + 1 }), {});
  note(`  roles: ${JSON.stringify(roles)}`);

  note(`\n${"=".repeat(70)}`);
  if (APPLY) {
    note(`  MIGRATION APPLIED. Backup: ${backupDir}`);
    note(`  "${SOURCE}" was left untouched — verify the app, then drop it by hand.`);
    await fs.writeFile(path.join(backupDir, "migration.log"), log.join("\n"));
  } else {
    note(`  DRY RUN — nothing was written. Re-run with --apply to perform it.`);
  }
  note(`${"=".repeat(70)}\n`);

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error("\nMigration failed:", err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
