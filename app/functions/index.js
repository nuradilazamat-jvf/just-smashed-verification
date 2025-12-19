const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

async function assertIsAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Not authenticated.");
  }

  const callerUid = request.auth.uid;
  const userDoc = await admin.firestore().doc(`users/${callerUid}`).get();

  if (!userDoc.exists || userDoc.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can create users.");
  }
}

exports.adminCreateUser = onCall({ region: "us-central1" }, async (request) => {
  await assertIsAdmin(request);

  const data = request.data || {};

  const email = String(data.email || "").trim().toLowerCase();
  const role = String(data.role || "").trim();
  const partnerId = data.partnerId ? String(data.partnerId).trim() : null;
  const locationIdsRaw = Array.isArray(data.locationIds) ? data.locationIds : [];

  if (!email) {
    throw new HttpsError("invalid-argument", "Email is required.");
  }

  const allowedRoles = ["partner", "reviewer", "admin"];
  if (!allowedRoles.includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid role.");
  }

  const locationIds =
    role === "partner"
      ? locationIdsRaw.map((s) => String(s).trim()).filter(Boolean)
      : [];

  if (role === "partner" && !partnerId) {
    throw new HttpsError("invalid-argument", "partnerId is required for partner role.");
  }

  const tempPassword =
    Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password: tempPassword,
    });

    const uid = userRecord.uid;

    const profile = {
      email,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (role === "partner") {
      profile.partnerId = partnerId;
      profile.locationIds = locationIds;
    }

    await admin.firestore().doc(`users/${uid}`).set(profile, { merge: true });

    return { uid, tempPassword };
  } catch (e) {
    logger.error("adminCreateUser error:", e);

    if (e.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "A user with this email already exists.");
    }

    throw new HttpsError("internal", e?.message || "Unknown error while creating user.");
  }
});
