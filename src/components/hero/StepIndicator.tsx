import { motion } from "framer-motion";

interface StepIndicatorProps {
  current: number;
  total: number;
}

const StepIndicator = ({ current, total }: StepIndicatorProps) => (
  <div className="flex items-center gap-1.5 mb-6">
    {Array.from({ length: total }, (_, i) => (
      <motion.div
        key={i}
        className={`h-1.5 rounded-full transition-all duration-300 ${
          i < current ? "bg-primary" : "bg-muted"
        }`}
        animate={{ width: i < current ? 32 : 12 }}
        transition={{ duration: 0.3 }}
      />
    ))}
    <span className="text-xs text-muted-foreground ml-2">
      {current}/{total}
    </span>
  </div>
);

export default StepIndicator;
