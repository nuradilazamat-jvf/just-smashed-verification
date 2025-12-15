import { useEffect, useState } from "react";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [locations, setLocations] = useState([]);
  const [locationProgress, setLocationProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");

      try {
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

        const progress = await computeLocationProgress(locs);

        setLocationProgress(progress);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError(
          "Fehler beim Laden der Daten. Bitte versuchen Sie es später noch einmal."
        );
        setLoading(false);
      }
    })();
  }, []);

  async function computeLocationProgress(locs) {
    const progress = {};

    if (locs.length === 0) return progress;

    const brandIdSet = new Set();
    for (const loc of locs) {
      const brands = loc.brandIds || [];
      for (const b of brands) brandIdSet.add(b);
    }

    const totalRequirementsPerBrand = {}; // { brandId: number }

    for (const brandId of brandIdSet) {
      if (!brandId) continue;
      let total = 0;

      const itemsSnap = await getDocs(
        collection(db, "brands", brandId, "menuItems")
      );
      const itemDocs = itemsSnap.docs;

      for (const itemDoc of itemDocs) {
        const reqSnap = await getDocs(
          collection(
            db,
            "brands",
            brandId,
            "menuItems",
            itemDoc.id,
            "requirements"
          )
        );
        total += reqSnap.size;
      }

      totalRequirementsPerBrand[brandId] = total;
    }

    for (const loc of locs) {
      const brands = loc.brandIds || [];
      if (brands.length === 0) {
        progress[loc.partnerId + "_" + loc.id] = {
          total: 0,
          approved: 0,
          percentage: 0,
        };
        continue;
      }

      const brandId = brands[0];

      const total = totalRequirementsPerBrand[brandId] || 0;
      if (total === 0) {
        progress[loc.partnerId + "_" + loc.id] = {
          total: 0,
          approved: 0,
          percentage: 0,
        };
        continue;
      }

      const qSubs = query(
        collection(db, "submissions"),
        where("locationId", "==", loc.id),
        where("partnerId", "==", loc.partnerId),
        where("brandId", "==", brandId),
        where("status", "==", "approved")
      );
      const subsSnap = await getDocs(qSubs);

      const approvedSet = new Set();
      subsSnap.forEach((docSnap) => {
        const s = docSnap.data();
        const key = `${s.itemId}|${s.requirementId}`;
        approvedSet.add(key);
      });

      const approved = approvedSet.size;
      const percentage =
        total > 0 ? Math.round((approved / total) * 100) : 0;

      progress[loc.partnerId + "_" + loc.id] = {
        total,
        approved,
        percentage,
      };
    }

    return progress;
  }

  if (loading) return <div>Loading addresses…</div>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">My restaurants</h1>

      {role && (
        <p className="text-sm text-slate-500 mb-2">
          Current role: <span className="font-mono">{role}</span>
        </p>
      )}

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {locations.map((loc) => {
          const prog =
            locationProgress[`${loc.partnerId}_${loc.id}`] || null;

          return (
            <Link
              key={`${loc.partnerId}_${loc.id}`}
              to={`/location?partnerId=${loc.partnerId}&locationId=${loc.id}`}
              className="bg-white border rounded-2xl p-4 hover:shadow transition text-left"
            >
              <div className="font-semibold">{loc.name}</div>
              <div className="text-sm text-slate-600">{loc.address}</div>
              <div className="text-xs text-slate-500 mt-1">
                Partner: {loc.partnerId} · Brands:{" "}
                {loc.brandIds?.join(", ")}
              </div>

              {prog && (
                <div className="mt-2 text-xs text-slate-600">
                  Verification progress:{" "}
                  <span className="font-semibold">
                    {prog.percentage}%
                  </span>{" "}
                  ({prog.approved}/{prog.total} Anforderungen approved)
                </div>
              )}
            </Link>
          );
        })}

        {!locations.length && (
          <div className="text-sm text-slate-500">
            No locations available.
          </div>
        )}
      </div>
    </div>
  );
}