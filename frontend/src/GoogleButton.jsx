import { useEffect, useRef } from "react";

const ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Google's own "Sign in with Google" button. Renders nothing unless a client ID is configured.
export default function GoogleButton({ onCredential }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ID) return;
    const init = () => {
      window.google.accounts.id.initialize({ client_id: ID, callback: (r) => onCredential(r.credential) });
      window.google.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", width: 320 });
    };
    if (window.google?.accounts) init();
    else {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = init;
      document.head.appendChild(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!ID) return null;
  return (
    <div className="mt-4">
      <p className="mb-3 text-center text-sm text-mute">or</p>
      <div ref={ref} className="flex justify-center" />
    </div>
  );
}
