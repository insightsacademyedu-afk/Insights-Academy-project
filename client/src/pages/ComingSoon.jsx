import AppLayout from "../components/AppLayout";
import { Hammer } from "lucide-react";

export default function ComingSoon({ title, phase }) {
  return (
    <AppLayout title={title}>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-300 bg-paper-50 py-24 text-center">
        <Hammer size={22} className="text-brass-500 mb-3" strokeWidth={1.75} />
        <p className="font-display text-lg text-ink-900">{title} arrives in build phase {phase}</p>
        <p className="mt-1 text-sm text-ink-500 max-w-sm">
          The backend for this module is already in place — this screen just hasn't been built yet.
        </p>
      </div>
    </AppLayout>
  );
}
