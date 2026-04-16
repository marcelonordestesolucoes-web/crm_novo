import { useMotionValue, useSpring, useTransform } from "framer-motion";

export const useTilt = () => {
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  // Configuração de mola para um movimento orgânico e "pesado"
  const springConfig = { damping: 30, stiffness: 120 };
  
  // Transformação de posição do mouse (0-1) para graus de rotação (-10 a 10)
  const rotateX = useSpring(useTransform(y, [0, 1], [8, -8]), springConfig);
  const rotateY = useSpring(useTransform(x, [0, 1], [-8, 8]), springConfig);

  // Posição do Glare (brilho especular) - Segue a luz inversamente
  const glareX = useSpring(useTransform(x, [0, 1], [100, 0]), springConfig);
  const glareY = useSpring(useTransform(y, [0, 1], [100, 0]), springConfig);

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    x.set(mouseX / width);
    y.set(mouseY / height);
  };

  const handleMouseLeave = () => {
    // Retorna suavemente ao centro
    x.set(0.5);
    y.set(0.5);
  };

  return { 
    rotateX, 
    rotateY, 
    glareX, 
    glareY, 
    handleMouseMove, 
    handleMouseLeave 
  };
};
