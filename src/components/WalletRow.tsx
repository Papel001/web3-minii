// src/components/WalletRow.tsx
"use client";

import React from "react";

type Props = {
  name: string;
  subtitle?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  right?: React.ReactNode;
};

export default function WalletRow({
  name,
  subtitle,
  onClick,
  disabled,
  right,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-full text-left rounded-xl border px-4 py-3",
        "hover:bg-gray-50 active:bg-gray-100 transition",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "flex items-center justify-between gap-3",
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="font-medium text-gray-900">{name}</div>
        {subtitle ? (
          <div className="text-sm text-gray-500 truncate">{subtitle}</div>
        ) : null}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </button>
  );
}
