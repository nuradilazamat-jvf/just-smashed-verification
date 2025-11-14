import { Outlet, Link, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setRole(null);
        nav("/login");
        return;
      }
      setUser(u);

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        setRole(snap.exists() ? snap.data().role || null : null);
      } catch (e) {
        console.error(e);
        setRole(null);
      }
    });
    return () => unsub();
  }, [nav]);

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        Loading…
      </div>
    );
  }

  const logout = async () => {
    await signOut(auth);
    nav("/login");
  };

  const isReviewerOrAdmin = role === "reviewer" || role === "admin";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="font-bold">Just Smashed – Verification</div>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            <Link to="/" className="hover:underline">
              Dashboard
            </Link>
            {isReviewerOrAdmin && (
              <Link to="/review" className="hover:underline">
                Review
              </Link>
            )}
            <span className="text-slate-600">{user.email}</span>
            <button
              onClick={logout}
              className="px-3 py-1 rounded border text-xs hover:bg-slate-100"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
