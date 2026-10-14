import { useState } from "react";
import { toast } from "sonner";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function useEmailSender({ savedEmail, saveEmail, emailLog, localDate, position }) {
  const [sending, setSending] = useState(false);
  const [sentKey, setSentKey] = useState(null);
  const [prompt, setPrompt] = useState(null);

  const send = async ({ listIds, title }, email) => {
    setSending(true);
    try {
      const res = await emailLog({ localDate, listIds, position, email });
      setSentKey(listIds.join(","));
      toast.success(`${title} emailed to ${res.to}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Couldn't send the email. Check your signal and try again.");
    } finally {
      setSending(false);
    }
  };

  const requestSend = (listIds, title) => {
    const email = (savedEmail || "").trim();
    if (EMAIL_RE.test(email)) send({ listIds, title }, email);
    else setPrompt({ listIds, title, initial: email });
  };

  const confirmEmail = (value) => {
    if (!EMAIL_RE.test(value)) return "Please enter a valid email address";
    saveEmail(value);
    const job = prompt;
    setPrompt(null);
    send(job, value);
    return true;
  };

  return { sending, sentKey, prompt, requestSend, confirmEmail, closePrompt: () => setPrompt(null) };
}
