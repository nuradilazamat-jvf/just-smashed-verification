import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  collectionGroup,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export default function RestaurantViewer() {
  const [params] = useSearchParams();
  const id = params.get("id");

  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Parameter ?id is missing.");
      return;
    }

    (async () => {
      setLoading(true);
      setError("");

      try {
        const qLoc = query(
          collectionGroup(db, "locations"),
          where("id", "==", id)
        );
        const snap = await getDocs(qLoc);

        if (snap.empty) {
          setError("Restaurant (location) with this ID not found or access denied.");
          setLocation(null);
        } else {
          const docSnap = snap.docs[0];
          setLocation({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (e) {
        console.error(e);
        setError("Error loading restaurant data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div>Loading restaurant…</div>;

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-2">Restaurant Viewer</h1>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!location) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-2">Restaurant Viewer</h1>
        <p className="text-slate-600 text-sm">No restaurant data available.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">{location.name}</h1>
      <p className="text-slate-600 mb-3">{location.address}</p>

      <div className="text-sm text-slate-500 space-y-1">
        <div>
          ID: <code>{location.id}</code>
        </div>
        {location.city && (
          <div>
            City: {location.city}, {location.country}
          </div>
        )}
        {location.brandIds && (
          <div>Brands: {location.brandIds.join(", ")}</div>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        This viewer reads the location by its ID via <code>collectionGroup("locations")</code>.
        Access is controlled by Firestore Rules: partners see only their own locations,
        reviewers/admins see all.
      </p>
    </div>
  );
}
