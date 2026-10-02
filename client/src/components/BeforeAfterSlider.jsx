import React, { useState, useRef, useEffect } from 'react';

export default function BeforeAfterSlider({ 
  originalUrl, 
  enhancedUrl, 
  leftLabel = 'ORIGINAL', 
  rightLabel = 'ENHANCED AI', 
  className = '' 
}) {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage (0 - 100)
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let position = (x / rect.width) * 100;
    if (position < 0) position = 0;
    if (position > 100) position = 100;
    setSliderPosition(position);
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    const handleGlobalMouseMove = (e) => {
      if (isDragging) {
        handleMove(e.clientX);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onTouchMove={handleTouchMove}
      className={`relative select-none overflow-hidden rounded-2xl cursor-ew-resize bg-navy-950 border border-white/[0.08] ${className}`}
      style={{ touchAction: 'none' }}
    >
      {/* 1. Enhanced Image (Full Background) */}
      <img
        src={enhancedUrl}
        alt="Enhanced Real Estate"
        className="w-full h-full object-contain pointer-events-none block"
      />
      <span className="absolute top-3.5 right-3.5 bg-khaki-500/95 text-navy-950 text-xs font-bold px-3 py-1 rounded-full shadow-lg backdrop-blur-sm z-10 pointer-events-none tracking-wider">
        {rightLabel}
      </span>

      {/* 2. Original Image (Clipped with slider width) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ width: `${sliderPosition}%` }}
      >
        <img
          src={originalUrl}
          alt="Original Real Estate"
          className="absolute inset-0 w-full h-full object-contain max-w-none"
          style={{ width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%' }}
        />
        <span className="absolute top-3.5 left-3.5 bg-navy-950/90 text-bone-100 text-xs font-bold px-3 py-1 rounded-full shadow-lg backdrop-blur-sm z-10 pointer-events-none tracking-wider border border-white/[0.1]">
          {leftLabel}
        </span>
      </div>

      {/* 3. Draggable Divider Line & Handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-khaki-400 shadow-[0_0_12px_rgba(183,169,144,0.8)] z-20 pointer-events-none"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-navy-900 text-khaki-400 shadow-2xl flex items-center justify-center border-2 border-khaki-500 transition-transform hover:scale-110">
          <svg className="w-4 h-4 fill-current text-khaki-400" viewBox="0 0 24 24">
            <path d="M8.5 7l-5 5 5 5V7zm7 10l5-5-5-5v10z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
