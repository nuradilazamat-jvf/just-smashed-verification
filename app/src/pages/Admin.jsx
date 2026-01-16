import { useEffect, useState } from "react";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { sendPasswordResetEmail } from "firebase/auth";
import { db, functions, auth } from "../firebase";

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [locationsByPartner, setLocationsByPartner] = useState({});
  const [users, setUsers] = useState([]);

  const [partnerForm, setPartnerForm] = useState({
    id: "",
    name: "",
    shortName: "",
  });

  const [locationForm, setLocationForm] = useState({
    partnerId: "",
    id: "",
    name: "",
    address: "",
  });

  const [userForm, setUserForm] = useState({
    uid: "",
    email: "",
    role: "partner",
    partnerId: "",
    locationIdsText: "",
  });

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("partner");
  const [newUserPartnerId, setNewUserPartnerId] = useState("");
  const [newUserLocationIds, setNewUserLocationIds] = useState([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserMessage, setCreateUserMessage] = useState("");
  const [createUserError, setCreateUserError] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadPartnersAndLocations = async () => {
    const partnersSnap = await getDocs(collection(db, "partners"));

    const ps = [];
    const locMap = {};

    for (const docSnap of partnersSnap.docs) {
      const pId = docSnap.id;
      ps.push({ id: pId, ...docSnap.data() });

      const locSnap = await getDocs(collection(db, "partners", pId, "locations"));
      locMap[pId] = locSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    setPartners(ps);
    setLocationsByPartner(locMap);

    if (!newUserPartnerId && ps.length > 0) {
      setNewUserPartnerId(ps[0].id);
    }
  };

  const loadUsers = async () => {
    const usersSnap = await getDocs(collection(db, "users"));
    const u = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setUsers(u);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        await Promise.all([loadPartnersAndLocations(), loadUsers()]);
      } catch (e) {
        console.error(e);
        setError("Fehler beim Laden der Admin-Daten. Bitte später noch einmal versuchen.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleNewUserLocation = (locId) => {
    setNewUserLocationIds((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]
    );
  };

  const handleCreatePartner = async (e) => {
    e.preventDefault();
    setError("");

    const { id, name, shortName } = partnerForm;
    if (!id || !name) {
      setError("Bitte Partner-ID und Name ausfüllen.");
      return;
    }

    try {
      setSaving(true);
      const partnerId = id.trim();

      await setDoc(doc(db, "partners", partnerId), {
        name: name.trim(),
        shortName: (shortName || "").trim() || name.trim(),
        isActive: true,
        brands: ["justsmashed"],
        createdAt: serverTimestamp(),
      });

      await loadPartnersAndLocations();
      setPartnerForm({ id: "", name: "", shortName: "" });
    } catch (e2) {
      console.error(e2);
      setError("Fehler beim Anlegen des Partners.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    setError("");

    const { partnerId, id, name, address } = locationForm;
    if (!partnerId || !id || !name) {
      setError("Bitte Partner-ID, Location-ID und Name ausfüllen.");
      return;
    }

    try {
      setSaving(true);
      const pId = partnerId.trim();
      const locId = id.trim();

      await setDoc(doc(db, "partners", pId, "locations", locId), {
        name: name.trim(),
        address: (address || "").trim(),
        brandIds: ["justsmashed"],
        isActive: true,
        createdAt: serverTimestamp(),
      });

      await loadPartnersAndLocations();

      setLocationForm({
        partnerId,
        id: "",
        name: "",
        address: "",
      });
    } catch (e2) {
      console.error(e2);
      setError("Fehler beim Anlegen der Location.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUserAndProfile = async () => {
    setCreateUserError("");
    setCreateUserMessage("");

    const email = newUserEmail.trim().toLowerCase();
    if (!email) {
      setCreateUserError("Bitte eine E-Mail angeben.");
      return;
    }

    if (!["partner", "reviewer", "admin"].includes(newUserRole)) {
      setCreateUserError("Ungültige Rolle.");
      return;
    }

    if (newUserRole === "partner" && !newUserPartnerId) {
      setCreateUserError("Bitte einen Partner auswählen.");
      return;
    }

    if (newUserRole === "partner" && newUserLocationIds.length === 0) {
      setCreateUserError("Bitte mindestens eine Location auswählen.");
      return;
    }

    try {
      setCreatingUser(true);

      const createFn = httpsCallable(functions, "adminCreateUser");
      const res = await createFn({
        email,
        role: newUserRole,
        partnerId: newUserRole === "partner" ? newUserPartnerId : null,
        locationIds: newUserRole === "partner" ? newUserLocationIds : [],
      });

      const { uid } = res.data || {};

      try {
        await sendPasswordResetEmail(auth, email);
      } catch (err) {
        console.error("sendPasswordResetEmail failed:", err);
      }

      await loadUsers();

      setCreateUserMessage(
        `User created (UID: ${uid || "?"}). Passwort-Reset-E-Mail wurde an ${email} gesendet.`
      );

      setNewUserEmail("");
      setNewUserRole("partner");
      setNewUserPartnerId(partners?.[0]?.id || "");
      setNewUserLocationIds([]);
    } catch (e2) {
      console.error("handleCreateUserAndProfile error:", e2);
      const msg = e2?.message || "Fehler beim Erstellen des Users.";
      setCreateUserError(msg);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateUserProfile = async (e) => {
    e.preventDefault();
    setError("");

    const { uid, email, role, partnerId, locationIdsText } = userForm;

    if (!uid || !role) {
      setError("Bitte UID und Rolle ausfüllen.");
      return;
    }

    const locIds =
      role === "partner"
        ? (locationIdsText || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    try {
      setSaving(true);

      const data = {
        email: (email || "").trim() || null,
        role,
        isActive: true,
        createdAt: serverTimestamp(),
      };

      if (role === "partner") {
        data.partnerId = (partnerId || "").trim() || null;
        data.locationIds = locIds;
      } else {
        data.partnerId = null;
        data.locationIds = [];
      }

      if (role === "reviewer") {
        data.brands = ["justsmashed"];
      }

      await setDoc(doc(db, "users", uid.trim()), data, { merge: true });

      await loadUsers();

      setUserForm({
        uid: "",
        email: "",
        role: "partner",
        partnerId: "",
        locationIdsText: "",
      });
    } catch (e2) {
      console.error(e2);
      setError("Fehler beim Anlegen/Aktualisieren des Benutzerprofils.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Loading admin data…</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold mb-2">Admin – Management</h1>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <section className="bg-white border rounded-2xl p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-3">Partners &amp; Locations</h2>

          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Existing partners</h3>
            <ul className="text-sm space-y-1 max-h-40 overflow-auto">
              {partners.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                    {p.id}
                  </span>
                  <span className="flex-1 text-right">
                    {p.name} {p.isActive === false && "(inactive)"}
                  </span>
                </li>
              ))}
              {!partners.length && (
                <li className="text-xs text-slate-500">Noch keine Partner angelegt.</li>
              )}
            </ul>
          </div>

          <form onSubmit={handleCreatePartner} className="space-y-2 mb-6">
            <h3 className="text-sm font-semibold">Create new partner</h3>
            <input
              type="text"
              placeholder="Partner ID (e.g. p_justfood_gmbh)"
              value={partnerForm.id}
              onChange={(e) => setPartnerForm((f) => ({ ...f, id: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Partner name"
              value={partnerForm.name}
              onChange={(e) => setPartnerForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Short name (optional)"
              value={partnerForm.shortName}
              onChange={(e) => setPartnerForm((f) => ({ ...f, shortName: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="mt-1 px-3 py-1.5 rounded bg-black text-white text-xs hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Create partner"}
            </button>
          </form>

          <form onSubmit={handleCreateLocation} className="space-y-2">
            <h3 className="text-sm font-semibold">Create new location</h3>
            <input
              type="text"
              placeholder="Partner ID (e.g. p_justfood_gmbh)"
              value={locationForm.partnerId}
              onChange={(e) => setLocationForm((f) => ({ ...f, partnerId: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Location ID (e.g. loc_berlin_mitte)"
              value={locationForm.id}
              onChange={(e) => setLocationForm((f) => ({ ...f, id: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Location name"
              value={locationForm.name}
              onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Address"
              value={locationForm.address}
              onChange={(e) => setLocationForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="mt-1 px-3 py-1.5 rounded bg-black text-white text-xs hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Create location"}
            </button>
          </form>
        </section>

        <section className="bg-white border rounded-2xl p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-3">Users (profiles)</h2>

          <div className="mb-4 max-h-40 overflow-auto text-sm">
            {users.length === 0 && (
              <div className="text-xs text-slate-500">
                Noch keine Benutzerprofile in der Collection &quot;users&quot;.
              </div>
            )}
            {users.map((u) => (
              <div key={u.id} className="flex flex-col border-b last:border-b-0 py-1">
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                    {u.id}
                  </span>
                  <span className="text-xs text-slate-600">{u.email || "no email"}</span>
                </div>
                <div className="text-xs text-slate-500">
                  role: {u.role || "-"}{" "}
                  {u.partnerId && <>· partnerId: {u.partnerId}</>}
                  {u.locationIds && u.locationIds.length > 0 && (
                    <> · locations: {u.locationIds.join(", ")}</>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold mb-1">Create / update user profile</h3>

            <p className="text-sm text-slate-600 mb-2">
              Option A (empfohlen): Neuen User erstellen und Profil automatisch anlegen. Der Benutzer erhält
              eine E-Mail, um sein Passwort selbst zu setzen.
            </p>

            <div className="border rounded-xl p-3 mb-4 bg-slate-50 space-y-2">
              <div className="text-sm font-medium">Create new user &amp; profile</div>

              <input
                type="email"
                placeholder="E-Mail"
                className="w-full border rounded px-2 py-1 text-sm"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />

              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={newUserRole}
                onChange={(e) => {
                  const r = e.target.value;
                  setNewUserRole(r);
                  if (r !== "partner") {
                    setNewUserLocationIds([]);
                  }
                }}
              >
                <option value="partner">partner</option>
                <option value="reviewer">reviewer</option>
                <option value="admin">admin</option>
              </select>

              {newUserRole === "partner" && (
                <>
                  <select
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={newUserPartnerId}
                    onChange={(e) => {
                      setNewUserPartnerId(e.target.value);
                      setNewUserLocationIds([]);
                    }}
                  >
                    <option value="">-- Partner auswählen --</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} · {p.name}
                      </option>
                    ))}
                  </select>

                  <div className="text-xs text-slate-500 mt-1">
                    Locations (mindestens eine auswählen):
                  </div>

                  {newUserPartnerId &&
                  locationsByPartner[newUserPartnerId] &&
                  locationsByPartner[newUserPartnerId].length > 0 ? (
                    <div className="border rounded px-2 py-2 max-h-40 overflow-y-auto text-xs space-y-1 bg-white">
                      {locationsByPartner[newUserPartnerId].map((loc) => (
                        <label key={loc.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newUserLocationIds.includes(loc.id)}
                            onChange={() => toggleNewUserLocation(loc.id)}
                          />
                          <span>
                            {loc.name} ({loc.id}) {loc.address ? `– ${loc.address}` : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400">
                      Keine Locations für diesen Partner vorhanden.
                    </div>
                  )}
                </>
              )}

              {createUserError && <div className="text-xs text-red-600">{createUserError}</div>}
              {createUserMessage && (
                <div className="text-xs text-emerald-700 whitespace-pre-wrap">{createUserMessage}</div>
              )}

              <button
                type="button"
                onClick={handleCreateUserAndProfile}
                disabled={creatingUser}
                className="px-3 py-1.5 rounded bg-black text-white text-xs hover:bg-slate-800 disabled:opacity-60"
              >
                {creatingUser ? "Creating…" : "Create user & profile"}
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-2">
              Option B (Legacy): Vorhandenen Auth-User mit Profil verknüpfen (UID eintragen).
            </p>

            <form onSubmit={handleCreateUserProfile} className="space-y-2">
              <p className="text-[11px] text-slate-500 mb-1">
                Schritt 1: User in Firebase Authentication anlegen (E-Mail + Passwort). Schritt 2: UID hier
                eintragen und Profil mit Rolle / Partner verbinden. Schritt 3: Custom Claims mit
                admin-scripts setzen.
              </p>

              <input
                type="text"
                placeholder="Auth UID"
                value={userForm.uid}
                onChange={(e) => setUserForm((f) => ({ ...f, uid: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm"
              />
              <input
                type="email"
                placeholder="E-Mail (optional)"
                value={userForm.email}
                onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm"
              />

              <select
                value={userForm.role}
                onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm"
              >
                <option value="partner">partner</option>
                <option value="reviewer">reviewer</option>
                <option value="admin">admin</option>
              </select>

              {userForm.role === "partner" && (
                <>
                  <input
                    type="text"
                    placeholder="partnerId (z.B. p_justfood_gmbh)"
                    value={userForm.partnerId}
                    onChange={(e) => setUserForm((f) => ({ ...f, partnerId: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="locationIds, comma separated (loc_...)"
                    value={userForm.locationIdsText}
                    onChange={(e) => setUserForm((f) => ({ ...f, locationIdsText: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </>
              )}

              <button
                type="submit"
                disabled={saving}
                className="mt-1 px-3 py-1.5 rounded bg-black text-white text-xs hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save user profile"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
