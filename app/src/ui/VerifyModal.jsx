import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage, auth } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function VerifyModal({
  brandId,
  partnerId,
  locationId,
  item,
  onClose,
}) {
  const [requirements, setRequirements] = useState([]);
  const [submissionsMap, setSubmissionsMap] = useState({});
  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploadState, setUploadState] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!brandId || !partnerId || !locationId || !item?.id) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const reqSnap = await getDocs(
          collection(
            db,
            "brands",
            brandId,
            "menuItems",
            item.id,
            "requirements"
          )
        );
        const reqs = reqSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const qSubs = query(
          collection(db, "submissions"),
          where("brandId", "==", brandId),
          where("partnerId", "==", partnerId),
          where("locationId", "==", locationId),
          where("itemId", "==", item.id)
        );
        const subsSnap = await getDocs(qSubs);

        const map = {};
        subsSnap.forEach((docSnap) => {
          const s = docSnap.data();
          const key = s.requirementId;
          const createdAt = s.createdAt?.toMillis ? s.createdAt.toMillis() : 0;

          if (!map[key] || (map[key].createdAtMs || 0) < createdAt) {
            map[key] = {
              id: docSnap.id,
              ...s,
              createdAtMs: createdAt,
            };
          }
        });

        if (cancelled) return;
        setRequirements(reqs);
        setSubmissionsMap(map);
      } catch (e) {
        console.error("Error loading requirements/submissions:", e);
        if (cancelled) return;
        setError(
          "Fehler beim Laden der Anforderungen. Bitte versuchen Sie es später noch einmal."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brandId, partnerId, locationId, item?.id]);

  const handleFileChange = (reqId, file) => {
    setSelectedFiles((prev) => ({
      ...prev,
      [reqId]: file || null,
    }));
    setUploadState((prev) => ({
      ...prev,
      [reqId]: { uploading: false, error: "" },
    }));
  };

  const handleUpload = async (reqId) => {
    const file = selectedFiles[reqId];
    if (!file) {
      setUploadState((prev) => ({
        ...prev,
        [reqId]: { uploading: false, error: "Bitte eine Datei auswählen." },
      }));
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setUploadState((prev) => ({
        ...prev,
        [reqId]: { uploading: false, error: "Bitte zuerst einloggen." },
      }));
      return;
    }

    setUploadState((prev) => ({
      ...prev,
      [reqId]: { uploading: true, error: "" },
    }));

    try {
      await currentUser.getIdToken(true);

      console.log("AUTH uid:", currentUser.uid);
      console.log("SDK projectId:", storage.app.options.projectId);
      console.log("SDK bucket:", storage.app.options.storageBucket);

      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const fileName = `${Date.now()}_${currentUser.uid}.${ext}`;

      const storagePath = `brands/${brandId}/items/${item.id}/requirements/${reqId}/partners/${partnerId}/locations/${locationId}/${fileName}`;
      const storageRef = ref(storage, storagePath);

      console.log("Uploading file to:", storagePath);
      await uploadBytes(storageRef, file);

      const downloadUrl = await getDownloadURL(storageRef);
      console.log("Download URL:", downloadUrl);

      const docRef = await addDoc(collection(db, "submissions"), {
        brandId,
        partnerId,
        locationId,
        itemId: item.id,
        requirementId: reqId,
        status: "submitted",
        createdAt: serverTimestamp(),
        submittedBy: currentUser.uid,
        storagePath,
        photoUrl: downloadUrl,
        fileName: file.name,
      });

      const newSubmission = {
        id: docRef.id,
        brandId,
        partnerId,
        locationId,
        itemId: item.id,
        requirementId: reqId,
        status: "submitted",
        photoUrl: downloadUrl,
        fileName: file.name,
        createdAtMs: Date.now(),
      };

      setSubmissionsMap((prev) => ({
        ...prev,
        [reqId]: newSubmission,
      }));

      setUploadState((prev) => ({
        ...prev,
        [reqId]: { uploading: false, error: "" },
      }));
    } catch (e) {
      console.error("Upload failed:", e);
      console.log("code:", e?.code);
      console.log("message:", e?.message);
      console.log("serverResponse:", e?.serverResponse);

      setUploadState((prev) => ({
        ...prev,
        [reqId]: {
          uploading: false,
          error:
            e?.code === "storage/unauthorized"
              ? "Kein Zugriff auf Storage (Rules). Bitte einloggen / Rechte prüfen."
              : "Upload fehlgeschlagen. Bitte versuchen Sie es später noch einmal.",
        },
      }));
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 w-full max-w-3xl">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl mt-10 mb-10 w-full max-w-4xl shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <div className="text-sm text-slate-500 mb-1">
              {item.category?.toUpperCase()}
            </div>
            <div className="text-xl font-semibold">{item.name}</div>
            <div className="text-xs text-slate-500 mt-1">
              Brand: {brandId} · Location: {locationId}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-black text-xl"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="px-6 pt-4 text-sm text-red-600 bg-red-50 border-b border-red-200">
            {error}
          </div>
        )}

        <div className="p-6 space-y-6">
          {requirements.map((req) => {
            const sub = submissionsMap[req.id];
            const upload = uploadState[req.id] || {
              uploading: false,
              error: "",
            };

            let statusLabel = "No photo";
            let statusColor = "bg-slate-200 text-slate-700";
            if (sub?.status === "submitted") {
              statusLabel = "Submitted";
              statusColor = "bg-amber-100 text-amber-800";
            } else if (sub?.status === "approved") {
              statusLabel = "Approved";
              statusColor = "bg-emerald-100 text-emerald-800";
            } else if (sub?.status === "rejected") {
              statusLabel = "Rejected";
              statusColor = "bg-red-100 text-red-800";
            }

            return (
              <div
                key={req.id}
                className="border rounded-2xl p-4 md:p-6 flex flex-col gap-4 bg-slate-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">
                      {req.title || req.id.replace(/_/g, " ").toUpperCase()}
                    </div>
                    {req.angleHint && (
                      <div className="text-xs text-slate-500 mt-1">
                        PICTURE ANGLE: {req.angleHint.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div
                    className={`text-xs px-3 py-1 rounded-full ${statusColor}`}
                  >
                    {statusLabel}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Example</div>
                    {req.exampleImageUrl ? (
                      <img
                        src={req.exampleImageUrl}
                        alt="example"
                        className="w-full rounded-lg bg-slate-100 object-cover"
                      />
                    ) : (
                      <div className="text-xs text-slate-400">
                        No example image configured.
                      </div>
                    )}

                    {Array.isArray(req.checklist) && req.checklist.length > 0 && (
                      <ul className="mt-3 text-xs text-slate-700 list-disc list-inside space-y-1">
                        {req.checklist.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    )}

                    {sub?.reviewComment && (
                      <div className="mt-3 text-xs text-slate-700 bg-white rounded-lg px-3 py-2 border">
                        <div className="font-semibold mb-1">
                          Reviewer comment:
                        </div>
                        <div>{sub.reviewComment}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="border border-dashed rounded-xl px-4 py-4 bg-white text-center text-sm text-slate-600">
                      <div className="font-medium mb-2">Upload photo</div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleFileChange(req.id, e.target.files?.[0] || null)
                        }
                        className="text-xs"
                      />
                      {upload.error && (
                        <div className="mt-2 text-xs text-red-600">
                          {upload.error}
                        </div>
                      )}
                      <button
                        onClick={() => handleUpload(req.id)}
                        disabled={upload.uploading}
                        className="mt-3 inline-flex items-center justify-center px-3 py-1.5 rounded bg-black text-white text-xs hover:bg-slate-800 disabled:opacity-60"
                      >
                        {upload.uploading ? "Uploading…" : "Save & submit"}
                      </button>

                      {sub?.fileName && (
                        <div className="mt-2 text-xs text-slate-500">
                          Last file:{" "}
                          <span className="font-mono">{sub.fileName}</span>
                        </div>
                      )}
                    </div>

                    {sub?.photoUrl && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">
                          Your last uploaded photo
                        </div>
                        <img
                          src={sub.photoUrl}
                          alt="uploaded"
                          className="w-full rounded-lg bg-slate-100 object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
