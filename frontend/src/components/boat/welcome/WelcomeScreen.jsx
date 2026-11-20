import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { WelcomeHelp } from "@/components/boat/welcome/WelcomeHelp";
import { WelcomeQuestions } from "@/components/boat/welcome/WelcomeQuestions";

// The Welcome list: Home button and Model Vessel help, then the questions that trim the app to what the skipper wants.
export const WelcomeScreen = ({ online, welcomeHome, homeId, onMakeHome, onSwitchModel }) => {
  const { setUser } = useAuth();
  const [w, setW] = useState(null);
  useEffect(() => {
    if (!online) return;
    api.get("/welcome").then(({ data }) => setW(data)).catch(() => setW(null));
  }, [online]);
  if (!w) return <p className="text-sm text-[var(--muted)]" data-testid="welcome-loading">{online ? "Loading the Welcome screen..." : "The Welcome screen needs a signal."}</p>;
  const save = (patch) => api.put("/welcome", patch).then(() => api.get("/auth/me")).then(({ data }) => setUser(data)).catch(() => {});
  const answer = (key, v) => { setW((s) => ({ ...s, answers: { ...s.answers, [key]: v } })); save({ answers: { [key]: v } }); };
  const ack = () => { setW((s) => ({ ...s, mv_ack: true })); save({ mv_ack: true }); };
  return (
    <div className="flex flex-col gap-4" data-testid="welcome-screen">
      <WelcomeHelp welcomeHome={welcomeHome} ack={w.mv_ack} onAck={ack} onSwitchModel={onSwitchModel} />
      {w.mv_ack && <WelcomeQuestions questions={w.questions} answers={w.answers} onAnswer={answer} homeId={homeId} onMakeHome={onMakeHome} />}
    </div>
  );
};
