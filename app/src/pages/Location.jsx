import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import VerifyModal from "../ui/VerifyModal";

const CATEGORIES = [
  { id: "burgers", label: "Burgers" },
  { id: "wings", label: "Wings" },
  { id: "fries", label: "Fries" },
];

export default function Location() {
  const [params] = useSearchParams();
  const partnerId = params.get("partnerId");
  const locationId = params.get("locationId");

  const [location, setLocation] = useState(null);
  const [brandId, setBrandId] = useState(null);
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState("burgers");
  const [activeItem, setActiveItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progressByItem, setProgressByItem] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!partnerId || !locationId) return;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const locSnap = await getDoc(
          doc(db, "partners", partnerId, "locations", locationId)
        );
        if (!locSnap.exists()) {
          setLocation(null);
          setLoading(false);
          return;
        }
        const loc = { id: locSnap.id, ...locSnap.data() };
        setLocation(loc);

        const bId = loc.brandIds?.[0];
        if (!bId) {
          setBrandId(null);
          setItems([]);
          setProgressByItem({});
          setLoading(false);
          return;
        }
        setBrandId(bId);

        const itemsSnap = await getDocs(
          collection(db, "brands", bId, "menuItems")
        );
        const allItems = itemsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setItems(allItems);

        const progressMap = {};

        const qSubs = query(
          collection(db, "submissions"),
          where("locationId", "==", locationId),
          where("partnerId", "==", partnerId)
        );
        const subsSnap = await getDocs(qSubs);

        const approvedMap = {};
        subsSnap.forEach((docSnap) => {
          const s = docSnap.data();
          if (s.status !== "approved") return;
          if (s.brandId !== bId) return;
          const key = `${s.itemId}|${s.requirementId}`;
          approvedMap[key] = true;
        });

        for (const item of allItems) {
          const reqSnap = await getDocs(
            collection(
              db,
              "brands",
              bId,
              "menuItems",
              item.id,
              "requirements"
            )
          );
          const total = reqSnap.size;
          let approved = 0;

          reqSnap.forEach((reqDoc) => {
            const key = `${item.id}|${reqDoc.id}`;
            if (approvedMap[key]) approved++;
          });

          const percentage =
            total > 0 ? Math.round((approved / total) * 100) : 0;
          progressMap[item.id] = { total, approved, percentage };
        }

        setProgressByItem(progressMap);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError(
          "Fehler beim Laden der Standort-Daten. Bitte versuchen Sie es später noch einmal."
        );
        setLoading(false);
      }
    })();
  }, [partnerId, locationId]);

  if (loading) return <div>Loading location…</div>;
  if (!location) return <div>Location not found.</div>;

  const filtered = items.filter((i) => i.category === activeCategory);

  return (
    <div>
      <h1 className="text-2xl font-semibold">{location.name}</h1>
      <p className="text-slate-600 mb-4">{location.address}</p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`px-3 py-1 rounded-full text-sm ${
              activeCategory === c.id
                ? "bg-black text-white"
                : "bg-white border text-slate-700"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-sm text-slate-500">
          No items for this category yet.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((item) => {
          const prog = progressByItem[item.id] || {
            total: 0,
            approved: 0,
            percentage: 0,
          };

          return (
            <button
              key={item.id}
              onClick={() => setActiveItem(item)}
              className="bg-white border rounded-2xl p-4 text-left hover:shadow transition"
            >
              <div className="flex gap-4">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-20 h-20 rounded object-cover bg-slate-100"
                />
                <div className="flex-1">
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-slate-600">
                    {item.description || "JustSmashed Standard"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Category: {item.category}
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Approved photos: {prog.approved}/{prog.total}
                  </div>
                </div>
                <div className="ml-auto text-sm text-slate-700 flex items-center">
                  {prog.percentage}%
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {activeItem && brandId && (
        <VerifyModal
          brandId={brandId}
          partnerId={partnerId}
          locationId={locationId}
          item={activeItem}
          onClose={() => setActiveItem(null)}
        />
      )}
    </div>
  );
}
