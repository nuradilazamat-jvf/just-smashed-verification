import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("./just-smashed-verification-firebase-adminsdk-fbsvc-4d64a0152b.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function run() {
  const partnerEmail = "partner@justfood.test";
  const partnerUser = await admin.auth().getUserByEmail(partnerEmail);
  await admin.auth().setCustomUserClaims(partnerUser.uid, {
    role: "partner",
    partnerId: "p_justfood_gmbh",
    locationIds: ["loc_berlin_mitte"],
  });
  console.log("partner claims set for", partnerEmail);

  const reviewerEmail = "reviewer@justsmashed.test";
  const reviewerUser = await admin.auth().getUserByEmail(reviewerEmail);
  await admin.auth().setCustomUserClaims(reviewerUser.uid, {
    role: "reviewer",
  });
  console.log("reviewer claims set for", reviewerEmail);

  const adminEmail = "admin@justsmashed.test";
  try {
    const adminUser = await admin.auth().getUserByEmail(adminEmail);
    await admin.auth().setCustomUserClaims(adminUser.uid, {
      role: "admin",
    });
    console.log("admin claims set for", adminEmail);
  } catch (e) {
    console.log("admin user not found, skip");
  }

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
