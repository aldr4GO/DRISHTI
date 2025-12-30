'use client';

import { useEffect, useRef } from 'react';

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    // Star properties
    interface Star {
      x: number;
      y: number;
      size: number;
      speed: number;
      opacity: number;
      twinkleSpeed: number;
      twinklePhase: number;
      color: string;
    }

    const stars: Star[] = [];
    const numStars = 250;

    // Create stars with cyan/white mix
    for (let i = 0; i < numStars; i++) {
      const isCyan = Math.random() > 0.85; // 15% cyan stars
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.3,
        speed: Math.random() * 0.03 + 0.005,
        opacity: Math.random() * 0.6 + 0.3,
        twinkleSpeed: Math.random() * 0.015 + 0.01,
        twinklePhase: Math.random() * Math.PI * 2,
        color: isCyan ? '#00f0ff' : '#ffffff',
      });
    }

    // Animation
    let animationId: number;
    const animate = () => {
      ctx.fillStyle = 'rgba(2, 8, 23, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      stars.forEach((star) => {
        // Twinkle effect
        star.twinklePhase += star.twinkleSpeed;
        const twinkle = Math.sin(star.twinklePhase) * 0.4 + 0.6;
        
        // Parse color
        const r = star.color === '#00f0ff' ? 0 : 255;
        const g = star.color === '#00f0ff' ? 240 : 255;
        const b = 255;
        
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${star.opacity * twinkle})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Add glow for larger cyan stars
        if (star.size > 1.2 && star.color === '#00f0ff') {
          ctx.fillStyle = `rgba(0, 240, 255, ${star.opacity * twinkle * 0.4})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Slow drift
        star.y += star.speed;
        star.x += Math.sin(star.twinklePhase) * 0.1;

        // Wrap around
        if (star.y > canvas.height) star.y = 0;
        if (star.x > canvas.width) star.x = 0;
        if (star.x < 0) star.x = canvas.width;
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', setCanvasSize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
