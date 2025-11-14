import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

function StatusBadge({ status }) {
  let text = "Not submitted";
  let className = "bg-slate-200 text-slate-700";

  if (status === "submitted") {
    text = "Pending review";
    className = "bg-amber-100 text-amber-800";
  } else if (status === "approved") {
    text = "Approved";
    className = "bg-emerald-100 text-emerald-800";
  } else if (status === "rejected") {
    text = "Rejected";
    className = "bg-red-100 text-red-700";
  }

  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " +
        className
      }
    >
      {text}
    </span>
  );
}

export default function VerifyModal({
  brandId,
  partnerId,
  locationId,
  item,
  onClose,
}) {
  const [requirements, setRequirements] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const reqSnap = await getDocs(
        collection(db, "brands", brandId, "menuItems", item.id, "requirements")
      );
      const reqList = reqSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRequirements(reqList);

      const qSub = query(
        collection(db, "submissions"),
        where("brandId", "==", brandId),
        where("partnerId", "==", partnerId),
        where("locationId", "==", locationId),
        where("itemId", "==", item.id)
      );
      const subSnap = await getDocs(qSub);

      const map = {};
      subSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const rId = data.requirementId;
        const prev = map[rId];

        const prevTs = prev?.createdAt?.seconds || 0;
        const curTs = data.createdAt?.seconds || 0;

        if (!prev || curTs >= prevTs) {
          map[rId] = { id: docSnap.id, ...data };
        }
      });

      setStatuses(map);
    })();
  }, [brandId, partnerId, locationId, item.id]);

  const handleFakeUpload = async (file, req) => {
    if (!file) return;

    setBusy(true);
    try {
      const docRef = await addDoc(collection(db, "submissions"), {
        partnerId,
        locationId,
        brandId,
        itemId: item.id,
        requirementId: req.id,
        status: "submitted",
        createdAt: serverTimestamp(),
        fakeFileName: file.name,
        photoUrl: "",
      });

      setStatuses((prev) => ({
        ...prev,
        [req.id]: {
          ...(prev[req.id] || {}),
          id: docRef.id,
          status: "submitted",
          fakeFileName: file.name,
        },
      }));

      alert("Photo registered (without actual file storage).");
    } catch (e) {
      console.error(e);
      alert("Failed to save submission");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center gap-3">
          <img
            src={item.image}
            alt={item.name}
            className="w-14 h-14 rounded object-cover bg-slate-100"
          />
          <div>
            <div className="font-semibold">{item.name}</div>
            <div className="text-xs text-slate-500">
              Brand: {brandId} · Location: {locationId}
            </div>
          </div>
          <button
            className="ml-auto px-3 py-1 text-sm rounded hover:bg-slate-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-auto space-y-6">
          {requirements.map((req) => {
            const statusInfo = statuses[req.id];

            return (
              <div key={req.id} className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="font-semibold">{req.title}</div>
                  <StatusBadge status={statusInfo?.status} />
                </div>

                <div className="text-xs text-slate-500 mb-3">
                  {req.angleHint}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Example</div>
                    <img
                      src={req.exampleImageUrl}
                      alt="example"
                      className="rounded w-full object-cover bg-white"
                    />
                    {req.verifyingDetails?.length > 0 && (
                      <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
                        {req.verifyingDetails.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    )}

                    {statusInfo?.reviewComment && (
                      <div className="mt-3 text-xs text-slate-700 bg-white/70 rounded p-2">
                        <div className="font-medium mb-1">
                          Reviewer comment:
                        </div>
                        <div>{statusInfo.reviewComment}</div>
                      </div>
                    )}
                  </div>

                  <label
                    className={`border-2 border-dashed rounded-lg grid place-items-center p-6 cursor-pointer text-sm ${
                      busy ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    <span className="mb-1 font-medium">Upload photo</span>
                    <span className="text-xs text-slate-500 text-center">
                      Currently we only save file info without actual storage.
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFakeUpload(e.target.files?.[0] || null, req)
                      }
                    />
                    {statusInfo?.fakeFileName && (
                      <div className="mt-2 text-xs text-slate-500">
                        Last file: <code>{statusInfo.fakeFileName}</code>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            );
          })}

          {requirements.length === 0 && (
            <div className="text-sm text-slate-500">
              No requirements configured for this item yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
