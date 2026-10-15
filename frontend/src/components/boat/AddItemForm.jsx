import { useState } from "react";

export const AddItemForm = ({ placeholder, onAdd }) => {
  const [text, setText] = useState("");
  const [alert, setAlert] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const res = await onAdd(text.trim());
    if (res === true) { setText(""); setAlert(""); return; }
    if (res) {
      setAlert(res);
      setTimeout(() => setAlert(""), 4000);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg bg-[var(--panel)] p-3" data-testid="add-item-form">
      {alert && <div role="alert" data-testid="add-item-alert" className="mbp-pop rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm font-bold text-amber-900">{alert}</div>}
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder}
          className="field-input flex-1" data-testid="add-item-input" />
        <button type="submit" className="btn-solid px-6" data-testid="add-item-submit-btn">Add</button>
      </div>
    </form>
  );
};
