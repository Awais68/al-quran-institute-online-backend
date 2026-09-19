/**
 * Read-only pre-migration inspection.
 *
 * Prints the current shape of the `users` and `teachers` collections so the
 * teacher consolidation migration can be planned against real data.
 * Writes nothing. Safe to run against production.
 *
 *   node scripts/inspect-teacher-data.js
 */
import mongoose from "mongoose";
import "dotenv/config";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log("DATABASE:", db.databaseName);
  console.log("\n--- collections ---");
  const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
  for (const name of names) {
    const count = await db.collection(name).countDocuments();
    console.log(String(count).padStart(6), name);
  }

  console.log("\n--- users by role ---");
  const byRole = await db
    .collection("users")
    .aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }, { $sort: { n: -1 } }])
    .toArray();
  byRole.forEach((r) => console.log(String(r.n).padStart(6), r._id));

  const teachers = names.includes("teachers")
    ? await db.collection("teachers").find({}).toArray()
    : [];

  console.log(`\n--- teachers collection (${teachers.length} docs) ---`);
  for (const t of teachers) {
    const match = await db.collection("users").findOne({ email: t.email });
    console.log(
      ` - ${t._id} | ${t.email} | status=${t.status} | experience=${JSON.stringify(
        t.experience
      )} | specialization=${JSON.stringify(t.specialization)} | assignedStudents=${
        (t.assignedStudents || []).length
      } | users-match=${match ? `YES (${match._id}, role=${match.role})` : "NO"}`
    );
  }

  console.log("\n--- users.assignedTeacher pointers ---");
  const withAssigned = await db
    .collection("users")
    .find({ assignedTeacher: { $ne: null } })
    .project({ email: 1, assignedTeacher: 1 })
    .toArray();
  console.log(`count: ${withAssigned.length}`);
  for (const u of withAssigned) {
    const inTeachers = teachers.some((t) => t._id.equals(u.assignedTeacher));
    const inUsers = await db.collection("users").findOne({ _id: u.assignedTeacher });
    console.log(
      ` - ${u.email} -> ${u.assignedTeacher} ${
        inTeachers ? "[teachers]" : inUsers ? "[users]" : "[DANGLING]"
      }`
    );
  }

  console.log("\n--- users with role=Teacher ---");
  const teacherUsers = await db
    .collection("users")
    .find({ role: "Teacher" })
    .project({
      email: 1,
      name: 1,
      country: 1,
      gender: 1,
      phone: 1,
      qualification: 1,
      experience: 1,
      expertise: 1,
      status: 1,
    })
    .toArray();
  console.log(JSON.stringify(teacherUsers, null, 2));

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error("Inspection failed:", err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
