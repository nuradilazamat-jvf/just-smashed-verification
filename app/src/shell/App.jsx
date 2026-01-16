import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthReady(true);

      if (!u) {
        setUser(null);
        setRole(null);

        if (location.pathname !== "/login") {
          nav("/login", { replace: true });
        }
        return;
      }

      setUser(u);

      if (location.pathname === "/login") {
        nav("/", { replace: true });
      }

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        setRole(snap.exists() ? snap.data().role || null : null);
      } catch (e) {
        console.error(e);
        setRole(null);
      }
    });

    return () => unsub();
  }, [nav, location.pathname]);

  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        Loading…
      </div>
    );
  }

  if (!user) {
    if (location.pathname === "/login") {
      return (
        <div className="min-h-screen bg-slate-50">
          <Outlet />
        </div>
      );
    }

    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        Loading…
      </div>
    );
  }

  const logout = async () => {
    await signOut(auth);
    nav("/login", { replace: true });
  };

  const isReviewerOrAdmin = role === "reviewer" || role === "admin";
  const isAdmin = role === "admin";

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
            {isAdmin && (
              <Link to="/admin" className="hover:underline">
                Admin
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
