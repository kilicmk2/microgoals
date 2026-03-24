"use client";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-bold">micro</span>
      <span className="italic font-normal">goals</span>
    </span>
  );
}
