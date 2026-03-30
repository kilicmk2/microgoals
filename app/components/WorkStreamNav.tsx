"use client";

import { WorkStream, WORK_STREAMS, WORK_STREAM_SHORT, Goal } from "../lib/store";

interface Props {
  active: WorkStream | null;
  onChange: (ws: WorkStream | null) => void;
  goals: Goal[];
}

export default function WorkStreamNav({ active, onChange, goals }: Props) {
  function countForStream(ws: WorkStream) {
    return goals.filter((g) => g.workstream === ws).length;
  }

  return (
    <div className="flex flex-wrap gap-1.5 px-6 py-3">
      <button
        onClick={() => onChange(null)}
        className={`text-[10px] font-mono px-2.5 py-1 rounded-full border transition-colors ${
          active === null
            ? "bg-black text-white border-black"
            : "bg-transparent text-neutral-500 border-neutral-200 hover:border-neutral-400"
        }`}
      >
        ALL
      </button>
      {WORK_STREAMS.map((ws) => {
        const count = countForStream(ws.key);
        return (
          <button
            key={ws.key}
            onClick={() => onChange(ws.key)}
            title={ws.label}
            className={`text-[10px] font-mono px-2.5 py-1 rounded-full border transition-colors ${
              active === ws.key
                ? "bg-black text-white border-black"
                : "bg-transparent text-neutral-500 border-neutral-200 hover:border-neutral-400"
            }`}
          >
            {WORK_STREAM_SHORT[ws.key]}
            {count > 0 && (
              <span className="ml-1 text-[9px] opacity-60">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
