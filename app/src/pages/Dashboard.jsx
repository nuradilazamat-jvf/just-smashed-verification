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

function SkeletonCard() {
  return (
    <div className="bg-white border rounded-2xl p-4 animate-pulse">
      <div className="h-4 w-2/3 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-1/2 bg-slate-200 rounded mb-3" />
      <div className="h-3 w-full bg-slate-200 rounded mb-2" />
      <div className="h-3 w-3/4 bg-slate-200 rounded" />
    </div>
  );
}

export default function Dashboard() {
  const [locations, setLocations] = useState([]);
  const [locationProgress, setLocationProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) {
        setLocations([]);
        setLocationProgress({});
        setRole(null);
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
          partnerId: d.ref.parent.parent?.id,
          ...d.data(),
        }));
      }

      setLocations(locs);

      const progress = await computeLocationProgress(locs);
      setLocationProgress(progress);

      setLoading(false);
    } catch (e) {
      console.error(e);
      setError("Fehler beim Laden der Daten. Bitte versuchen Sie es später noch einmal.");
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function computeLocationProgress(locs) {
    const progress = {};
    if (locs.length === 0) return progress;

    const brandIdSet = new Set();
    for (const loc of locs) {
      const brands = loc.brandIds || [];
      for (const b of brands) brandIdSet.add(b);
    }

    const totalRequirementsPerBrand = {};

    for (const brandId of brandIdSet) {
      if (!brandId) continue;
      let total = 0;

      const itemsSnap = await getDocs(collection(db, "brands", brandId, "menuItems"));
      const itemDocs = itemsSnap.docs;

      for (const itemDoc of itemDocs) {
        const reqSnap = await getDocs(
          collection(db, "brands", brandId, "menuItems", itemDoc.id, "requirements")
        );
        total += reqSnap.size;
      }

      totalRequirementsPerBrand[brandId] = total;
    }

    for (const loc of locs) {
      const brands = loc.brandIds || [];
      const key = `${loc.partnerId}_${loc.id}`;

      if (brands.length === 0) {
        progress[key] = { total: 0, approved: 0, percentage: 0 };
        continue;
      }

      const brandId = brands[0];
      const total = totalRequirementsPerBrand[brandId] || 0;

      if (total === 0) {
        progress[key] = { total: 0, approved: 0, percentage: 0 };
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
        const k = `${s.itemId}|${s.requirementId}`;
        approvedSet.add(k);
      });

      const approved = approvedSet.size;
      const percentage = total > 0 ? Math.round((approved / total) * 100) : 0;

      progress[key] = { total, approved, percentage };
    }

    return progress;
  }

  const isReviewerOrAdmin = role === "reviewer" || role === "admin";
  const title = isReviewerOrAdmin ? "All restaurants" : "My restaurants";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {role && (
            <p className="text-sm text-slate-500 mt-1">
              Current role: <span className="font-mono">{role}</span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg border text-xs hover:bg-slate-100 disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-white border border-red-200 rounded-2xl p-4">
          <div className="text-sm text-red-700 font-medium">Fehler</div>
          <div className="text-sm text-red-700 mt-1">{error}</div>
          <div className="mt-3">
            <button
              type="button"
              onClick={load}
              className="px-3 py-1.5 rounded-lg bg-black text-white text-xs hover:bg-slate-800"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {locations.map((loc) => {
            const key = `${loc.partnerId}_${loc.id}`;
            const prog = locationProgress[key] || null;

            const pct = prog?.percentage ?? 0;
            const showProgress = prog && prog.total > 0;

            return (
              <Link
                key={key}
                to={`/location?partnerId=${loc.partnerId}&locationId=${loc.id}`}
                className="bg-white border rounded-2xl p-4 hover:shadow transition text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{loc.name}</div>
                    <div className="text-sm text-slate-600 truncate">{loc.address}</div>
                    <div className="text-xs text-slate-500 mt-1 truncate">
                      Partner: <span className="font-mono">{loc.partnerId}</span>
                      {loc.brandIds?.length ? (
                        <>
                          {" "}
                          · Brands: <span className="font-mono">{loc.brandIds.join(", ")}</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {showProgress ? (
                    <div className="shrink-0 text-right">
                      <div className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-xs font-semibold">
                        {pct}%
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {prog.approved}/{prog.total}
                      </div>
                    </div>
                  ) : (
                    <div className="shrink-0 text-right">
                      <div className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-xs text-slate-600">
                        —
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">no data</div>
                    </div>
                  )}
                </div>

                {showProgress && (
                  <div className="mt-3">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-800 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      Verification progress:{" "}
                      <span className="font-semibold">{pct}%</span>{" "}
                      ({prog.approved}/{prog.total} Anforderungen approved)
                    </div>
                  </div>
                )}
              </Link>
            );
          })}

          {!locations.length && !error && (
            <div className="text-sm text-slate-500 bg-white border rounded-2xl p-4">
              No locations available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
