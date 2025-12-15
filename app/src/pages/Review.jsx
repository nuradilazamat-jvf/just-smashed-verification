import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";

export default function Review() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [comments, setComments] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const user = auth.currentUser;
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }

        const userSnap = await getDoc(doc(db, "users", user.uid));
        const userData = userSnap.exists() ? userSnap.data() : {};
        const r = userData.role || null;

        if (cancelled) return;

        setRole(r);

        if (r !== "reviewer" && r !== "admin") {
          setLoading(false);
          return;
        }

        const qSub = query(
          collection(db, "submissions"),
          where("status", "==", "submitted")
        );

        const snap = await getDocs(qSub);

        const result = [];
        for (const d of snap.docs) {
          const s = { id: d.id, ...d.data() };

          const [itemSnap, reqSnap, locSnap] = await Promise.all([
            getDoc(doc(db, "brands", s.brandId, "menuItems", s.itemId)),
            getDoc(
              doc(
                db,
                "brands",
                s.brandId,
                "menuItems",
                s.itemId,
                "requirements",
                s.requirementId
              )
            ),
            getDoc(doc(db, "partners", s.partnerId, "locations", s.locationId)),
          ]);

          const itemData = itemSnap.exists() ? itemSnap.data() : {};
          const reqData = reqSnap.exists() ? reqSnap.data() : {};
          const locData = locSnap.exists() ? locSnap.data() : {};

          result.push({
            ...s,
            itemName: itemData.name || s.itemId,
            itemCategory: itemData.category || "",
            requirementTitle: reqData.title || s.requirementId,
            exampleImageUrl: reqData.exampleImageUrl || "",
            locationName: locData.name || s.locationId,
            locationAddress: locData.address || "",
          });
        }

        if (cancelled) return;

        setSubmissions(result);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load review data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCommentChange = (id, value) => {
    setComments((prev) => ({ ...prev, [id]: value }));
  };

  const handleDecision = async (submission, newStatus) => {
    const user = auth.currentUser;
    if (!user) return;

    const comment = (comments[submission.id] || "").trim();

    if (newStatus === "rejected" && !comment) {
      alert("Please indicate the reason for the refusal in the comment.");
      return;
    }

    try {
      await updateDoc(doc(db, "submissions", submission.id), {
        status: newStatus,
        reviewComment: comment,
        reviewerUserId: user.uid,
        reviewedAt: serverTimestamp(),
      });

      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
    } catch (e) {
      console.error(e);
      alert("Failed to update submission.");
    }
  };

  if (loading) return <div>Loading…</div>;

  if (role !== "reviewer" && role !== "admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-2">Review</h1>
        <p className="text-slate-600">
          You don't have access to the review panel.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Pending checks</h1>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {submissions.length === 0 && !error && (
        <p className="text-sm text-slate-500">
          There are no applications with the status <code>submitted</code>.
        </p>
      )}

      <div className="space-y-4">
        {submissions.map((s) => (
          <div
            key={s.id}
            className="bg-white border rounded-2xl p-4 flex flex-col gap-3 md:flex-row md:gap-6"
          >
            <div className="md:w-1/3">
              <div className="text-xs text-slate-500 mb-1">{s.brandId}</div>
              <div className="font-semibold">{s.itemName}</div>

              <div className="text-xs text-slate-500 mb-2">
                Category: {s.itemCategory}
              </div>

              <div className="text-sm text-slate-600 mb-2">
                Restaurant: <span className="font-medium">{s.locationName}</span>
                <br />
                <span className="text-xs">{s.locationAddress}</span>
              </div>

              <div className="text-xs text-slate-500">
                Requirement: {s.requirementTitle}
              </div>

              {s.fileName && (
                <div className="mt-2 text-xs text-slate-500">
                  Uploaded file: <code>{s.fileName}</code>
                </div>
              )}

              {!s.fileName && s.fakeFileName && (
                <div className="mt-2 text-xs text-slate-500">
                  Uploaded file: <code>{s.fakeFileName}</code>
                </div>
              )}
            </div>

            <div className="md:w-1/3">
              <div className="text-xs text-slate-500 mb-1">Example</div>
              {s.exampleImageUrl ? (
                <img
                  src={s.exampleImageUrl}
                  alt="example"
                  className="rounded w-full object-cover bg-slate-100"
                />
              ) : (
                <div className="h-32 rounded bg-slate-100 grid place-items-center text-xs text-slate-500">
                  There is no reference image
                </div>
              )}

              {s.photoUrl && (
                <div className="mt-2">
                  <div className="text-xs text-slate-500 mb-1">Partner photo</div>
                  <img
                    src={s.photoUrl}
                    alt="partner"
                    className="rounded w-full object-cover bg-slate-100"
                  />
                </div>
              )}

              {!s.photoUrl && (
                <div className="mt-2 text-xs text-slate-500">
                  No partner photo URL in this submission.
                </div>
              )}
            </div>

            <div className="md:w-1/3 flex flex-col gap-2">
              <label className="text-xs text-slate-500">Comment for partner</label>
              <textarea
                className="border rounded-lg p-2 text-sm min-h-[80px]"
                value={comments[s.id] || ""}
                onChange={(e) => handleCommentChange(s.id, e.target.value)}
              />

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleDecision(s, "approved")}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded px-3 py-2"
                >
                  Approve
                </button>

                <button
                  onClick={() => handleDecision(s, "rejected")}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded px-3 py-2"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
