import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) nav("/");
    });
    return () => unsub();
  }, [nav]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      nav("/");
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
      <form
        onSubmit={submit}
        className="bg-white border rounded-2xl p-6 w-full max-w-sm space-y-4"
      >
        <h1 className="text-xl font-semibold">Login</h1>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border rounded px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button className="w-full bg-black text-white rounded py-2">
          Sign in
        </button>
      </form>
    </div>
  );
}
