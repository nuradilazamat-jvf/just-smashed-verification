import { useEffect, useState } from "react";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const r = userData.role || "partner";
      setRole(r);

      let locs = [];

      if (r === "partner") {
        const partnerId = userData.partnerId;
        const locationIds = userData.locationIds || [];

        const promises = locationIds.map((lid) =>
          getDoc(doc(db, "partners", partnerId, "locations", lid))
        );
        const docs = await Promise.all(promises);

        locs = docs
          .filter((d) => d.exists())
          .map((d) => ({
            id: d.id,
            partnerId,
            ...d.data(),
          }));
      } else {
        const snap = await getDocs(collectionGroup(db, "locations"));
        locs = snap.docs.map((d) => ({
          id: d.id,
          partnerId: d.ref.parent.parent.id,
          ...d.data(),
        }));
      }

      setLocations(locs);
      setLoading(false);
      const tokenResult = await auth.currentUser.getIdTokenResult(true);
      console.log("claims:", tokenResult.claims);

    })();
  }, []);

  if (loading) return <div>Loading addresses…</div>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">My restaurants</h1>
      {role && (
        <p className="text-sm text-slate-500 mb-4">
          Current role: <span className="font-mono">{role}</span>
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {locations.map((loc) => (
          <Link
            key={`${loc.partnerId}_${loc.id}`}
            to={`/location?partnerId=${loc.partnerId}&locationId=${loc.id}`}
            className="bg-white border rounded-2xl p-4 hover:shadow transition text-left"
          >
            <div className="font-semibold">{loc.name}</div>
            <div className="text-sm text-slate-600">{loc.address}</div>
            <div className="text-xs text-slate-500 mt-1">
              Partner: {loc.partnerId} · Brands: {loc.brandIds?.join(", ")}
            </div>
          </Link>
        ))}

        {!locations.length && (
          <div className="text-sm text-slate-500">No locations available.</div>
        )}
      </div>
    </div>
  );
}
