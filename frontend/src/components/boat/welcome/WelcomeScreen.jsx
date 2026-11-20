import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { WelcomeHelp } from "@/components/boat/welcome/WelcomeHelp";
import { WelcomeQuestions } from "@/components/boat/welcome/WelcomeQuestions";

// The Welcome list: Home button and Model Vessel help, then the questions that trim the app to what the skipper wants.
// The section the skipper was last on is remembered (on any device) and opened again.
export const WelcomeScreen = ({ online, welcomeHome, homeId, onMakeHome, onSwitchModel, onPreviewModel }) => {
  const { setUser } = useAuth();
  const [w, setW] = useState(null);
  const place = useRef("");
  useEffect(() => {
    if (!online) return;
    api.get("/welcome").then(({ data }) => { place.current = data.section; setW(data); }).catch(() => setW(null));
  }, [online]);
  useEffect(() => {
    if (!w || !place.current) return;
    const id = place.current === "help" ? "welcome-help" : `welcome-q-${place.current}`;
    setTimeout(() => document.querySelector(`[data-testid="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
  }, [!w]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w) return <p className="text-sm text-[var(--muted)]" data-testid="welcome-loading">{online ? "Loading the Welcome screen..." : "The Welcome screen needs a signal."}</p>;
  const save = (patch) => api.put("/welcome", patch).then(() => api.get("/auth/me")).then(({ data }) => setUser(data)).catch(() => {});
  const at = (section) => { if (section !== w.section) { setW((s) => ({ ...s, section })); api.put("/welcome", { section }).catch(() => {}); } };
  const answer = (key, v) => {
    const answers = { ...w.answers, [key]: v };
    const next = w.questions.find((q) => !answers[q.key])?.key || key;
    setW((s) => ({ ...s, answers, section: next }));
    save({ answers: { [key]: v }, section: next });
  };
  const ack = () => { setW((s) => ({ ...s, mv_ack: true, section: s.questions[0]?.key || "" })); save({ mv_ack: true, section: w.questions[0]?.key || "" }); };
  const complete = w.mv_ack && w.questions.every((q) => w.answers[q.key]);
  return (
    <div className="flex flex-col gap-4" data-testid="welcome-screen">
      <WelcomeHelp welcomeHome={welcomeHome} ack={w.mv_ack} onAck={ack} onSwitchModel={onSwitchModel} onPreviewModel={onPreviewModel} startOpen={place.current === "help"} onOpen={() => at("help")} />
      {w.mv_ack && <WelcomeQuestions questions={w.questions} answers={w.answers} onAnswer={answer} homeId={homeId} onMakeHome={onMakeHome} focus={place.current} onOpen={at} />}
      {complete && <p className="rounded-md border-[1.5px] border-emerald-600 bg-emerald-50 p-3 text-sm font-bold text-emerald-900" data-testid="welcome-complete-note">
        You&apos;ve been through every section. Welcome won&apos;t open by itself at sign-in any more: pick it from the list picker any time.</p>}
    </div>
  );
};
