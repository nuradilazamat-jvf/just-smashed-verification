import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const PARTNER_ID = "p_justfood_gmbh";

export default async function seedPartnerAndLocations() {
  const pRef = doc(db, "partners", PARTNER_ID);
  if (!(await getDoc(pRef)).exists()) {
    await setDoc(pRef, { name: "JustFood GmbH", isActive: true });
  }

  const locations = [
    {
      id: "loc_berlin_mitte",
      name: "JustFood Berlin-Mitte",
      address: "Friedrichstr. 10, Berlin",
      city: "Berlin",
      country: "DE",
      brandIds: ["justsmashed"],
      isActive: true,
    },
    {
      id: "loc_munich_center",
      name: "JustFood München-Center",
      address: "Leopoldstr. 25, München",
      city: "München",
      country: "DE",
      brandIds: ["justsmashed"],
      isActive: true,
    },
  ];

  for (const loc of locations) {
    const lRef = doc(db, "partners", PARTNER_ID, "locations", loc.id);
    if (!(await getDoc(lRef)).exists()) {
      await setDoc(lRef, loc);
    }
  }
}
