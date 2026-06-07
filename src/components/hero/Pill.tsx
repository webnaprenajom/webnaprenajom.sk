import React from "react";

interface PillProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const Pill = ({ active, onClick, children }: PillProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
      active
        ? "bg-primary text-primary-foreground shadow-md"
        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
    }`}
  >
    {children}
  </button>
);

export default Pill;
