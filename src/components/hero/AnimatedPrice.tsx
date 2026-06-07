import { motion, AnimatePresence } from "framer-motion";

const AnimatedPrice = ({ value }: { value: number }) => (
  <AnimatePresence mode="wait">
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="inline-block"
    >
      {value.toLocaleString("sk-SK")}€
    </motion.span>
  </AnimatePresence>
);

export default AnimatedPrice;
