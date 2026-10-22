import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { TemplateListsAdmin } from "@/components/admin/TemplateListsAdmin";

export default function AdminTemplates() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-16 pt-5" data-testid="admin-templates-page">
      <Link to="/" className="btn-ghost self-start px-4" data-testid="admin-templates-back-btn"><ArrowLeft className="h-4 w-4" /> Back to lists</Link>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Template lists</h1>
      <TemplateListsAdmin />
    </main>
  );
}
