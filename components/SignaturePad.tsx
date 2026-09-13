"use client";

import { useEffect, useRef, useState } from "react";

export default function SignaturePad({ onSave }: { onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
  }, []);

  const getXY = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const nativeEvent = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: nativeEvent.clientX - rect.left, y: nativeEvent.clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const { x, y } = getXY(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    if ("cancelable" in e.nativeEvent && e.nativeEvent.cancelable) e.preventDefault();
    const { x, y } = getXY(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stop = () => {
    if (isDrawing) {
      setIsDrawing(false);
      onSave(canvasRef.current!.toDataURL());
    }
  };

  const clear = () => {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.clearRect(0, 0, 500, 200);
    onSave("");
  };

  return (
    <div className="relative bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden group hover:border-indigo-300 transition-colors">
      <canvas
        ref={canvasRef}
        width={500}
        height={200}
        className="w-full h-44 signature-canvas"
        onMouseDown={start}
        onMouseMove={draw}
        onMouseUp={stop}
        onMouseOut={stop}
        onTouchStart={start}
        onTouchMove={draw}
        onTouchEnd={stop}
      />
      <button
        type="button"
        onClick={clear}
        className="absolute top-3 right-3 px-4 py-2 bg-white/90 border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 hover:text-indigo-600 shadow-sm"
      >
        Clear Pad
      </button>
      <div className="absolute bottom-3 left-0 w-full text-center text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] pointer-events-none">
        Digital Signature Space
      </div>
    </div>
  );
}
