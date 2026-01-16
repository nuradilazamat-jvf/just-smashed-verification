import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import VerifyModal from "../ui/VerifyModal";

const CATEGORIES = [
  { id: "burgers", label: "Burgers" },
  { id: "wings", label: "Wings" },
  { id: "fries", label: "Fries" },
];

function ProgressBar({ value }) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-2 bg-black" style={{ width: `${v}%` }} />
    </div>
  );
}

function ItemImage({ src, alt }) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className="w-20 h-20 rounded bg-slate-100 border grid place-items-center text-[10px] text-slate-500">
        No image
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className="w-20 h-20 rounded object-cover bg-slate-100 border"
    />
  );
}

function Skeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 w-full">
          <div className="h-7 w-64 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-80 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="h-8 w-28 bg-slate-200 rounded animate-pulse" />
      </div>

      <div className="h-16 bg-white border rounded-2xl p-4">
        <div className="h-4 w-44 bg-slate-200 rounded animate-pulse" />
        <div className="mt-2 h-2 w-full bg-slate-200 rounded animate-pulse" />
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-slate-200 rounded-full animate-pulse" />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border rounded-2xl p-4">
            <div className="flex gap-4">
              <div className="w-20 h-20 bg-slate-200 rounded animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-56 bg-slate-200 rounded animate-pulse" />
                <div className="h-2 w-full bg-slate-200 rounded animate-pulse" />
              </div>
              <div className="h-4 w-10 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const [refreshing, setRefreshing] = useState(false);
  const [progressByItem, setProgressByItem] = useState({});
  const [error, setError] = useState("");

  const filtered = useMemo(
    () => items.filter((i) => i.category === activeCategory),
    [items, activeCategory]
  );

  const overallProgress = useMemo(() => {
    const entries = Object.values(progressByItem || {});
    if (!entries.length) return { total: 0, approved: 0, percentage: 0 };

    const total = entries.reduce((acc, x) => acc + (x.total || 0), 0);
    const approved = entries.reduce((acc, x) => acc + (x.approved || 0), 0);
    const percentage = total > 0 ? Math.round((approved / total) * 100) : 0;

    return { total, approved, percentage };
  }, [progressByItem]);

  const loadData = async ({ keepActiveItem = true } = {}) => {
    if (!partnerId || !locationId) return;

    setError("");
    const prevActiveItemId = keepActiveItem ? activeItem?.id : null;

    try {
      const locSnap = await getDoc(doc(db, "partners", partnerId, "locations", locationId));
      if (!locSnap.exists()) {
        setLocation(null);
        setBrandId(null);
        setItems([]);
        setProgressByItem({});
        setActiveItem(null);
        return;
      }

      const loc = { id: locSnap.id, ...locSnap.data() };
      setLocation(loc);

      const bId = loc.brandIds?.[0];
      if (!bId) {
        setBrandId(null);
        setItems([]);
        setProgressByItem({});
        setActiveItem(null);
        return;
      }
      setBrandId(bId);

      const itemsSnap = await getDocs(collection(db, "brands", bId, "menuItems"));
      const allItems = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(allItems);

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

      const progressMap = {};
      for (const item of allItems) {
        const reqSnap = await getDocs(collection(db, "brands", bId, "menuItems", item.id, "requirements"));
        const total = reqSnap.size;

        let approved = 0;
        reqSnap.forEach((reqDoc) => {
          const key = `${item.id}|${reqDoc.id}`;
          if (approvedMap[key]) approved++;
        });

        const percentage = total > 0 ? Math.round((approved / total) * 100) : 0;
        progressMap[item.id] = { total, approved, percentage };
      }

      setProgressByItem(progressMap);

      if (prevActiveItemId) {
        const updated = allItems.find((x) => x.id === prevActiveItemId);
        setActiveItem(updated || null);
      }
    } catch (e) {
      console.error(e);
      setError("Fehler beim Laden der Standort-Daten. Bitte versuchen Sie es später noch einmal.");
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!partnerId || !locationId) return;

      setLoading(true);
      await loadData({ keepActiveItem: true });

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId, locationId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData({ keepActiveItem: true });
    setRefreshing(false);
  };

  if (loading) return <Skeleton />;

  if (!location) {
    return (
      <div className="bg-white border rounded-2xl p-4">
        <div className="font-semibold">Location not found.</div>
        <div className="text-sm text-slate-600 mt-1">
          Prüfe bitte die URL-Parameter <span className="font-mono">partnerId</span> und{" "}
          <span className="font-mono">locationId</span>.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{location.name}</h1>
          <p className="text-slate-600">{location.address}</p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-slate-50 disabled:opacity-60"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Overall progress</div>
          <div className="text-sm text-slate-700">
            <span className="font-semibold">{overallProgress.percentage}%</span>{" "}
            <span className="text-slate-500">
              ({overallProgress.approved}/{overallProgress.total})
            </span>
          </div>
        </div>
        <div className="mt-2">
          <ProgressBar value={overallProgress.percentage} />
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
          <div>{error}</div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded bg-black text-white text-xs hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`px-3 py-1 rounded-full text-sm ${
              activeCategory === c.id ? "bg-black text-white" : "bg-white border text-slate-700"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white border rounded-2xl p-4 text-sm text-slate-600">
          No items for this category yet.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((item) => {
          const prog = progressByItem[item.id] || { total: 0, approved: 0, percentage: 0 };

          return (
            <button
              key={item.id}
              onClick={() => setActiveItem(item)}
              className="bg-white border rounded-2xl p-4 text-left hover:shadow transition"
            >
              <div className="flex gap-4">
                <ItemImage src={item.image} alt={item.name} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{item.name}</div>
                      <div className="text-sm text-slate-600 truncate">
                        {item.description || "JustSmashed Standard"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Category: {item.category}
                      </div>
                    </div>

                    <div className="text-sm text-slate-700 flex items-center">
                      {prog.percentage}%
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <ProgressBar value={prog.percentage} />
                    <div className="text-xs text-slate-600">
                      Approved photos: {prog.approved}/{prog.total}
                    </div>
                  </div>
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
