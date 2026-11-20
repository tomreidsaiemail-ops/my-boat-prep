import { useEffect, useState } from "react";

export default function useHomePreview() {
  const [p, setP] = useState(null);
  useEffect(() => {
    const f = (e) => setP(e.detail);
    window.addEventListener("mbp:home-preview", f);
    return () => window.removeEventListener("mbp:home-preview", f);
  }, []);
  return p;
}
