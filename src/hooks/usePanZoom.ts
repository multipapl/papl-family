"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Bounds = {
  height: number;
  minX?: number;
  minY?: number;
  width: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getTouchDistance(left: React.Touch, right: React.Touch) {
  return Math.hypot(left.clientX - right.clientX, left.clientY - right.clientY);
}

function getTouchCenter(left: React.Touch, right: React.Touch) {
  return {
    x: (left.clientX + right.clientX) / 2,
    y: (left.clientY + right.clientY) / 2,
  };
}

export function usePanZoom(bounds: Bounds) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 });
  const didAutoFit = useRef(false);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);

  const fitToView = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || bounds.width <= 0 || bounds.height <= 0) return;

    const minX = bounds.minX ?? 0;
    const minY = bounds.minY ?? 0;
    const scale = clamp(Math.min(rect.width / bounds.width, rect.height / bounds.height) * 0.94, 0.14, 1.1);
    setTransform({
      scale,
      tx: (rect.width - bounds.width * scale) / 2 - minX * scale,
      ty: (rect.height - bounds.height * scale) / 2 - minY * scale,
    });
  }, [bounds.height, bounds.minX, bounds.minY, bounds.width]);

  useEffect(() => {
    if (didAutoFit.current) return;
    didAutoFit.current = true;
    const frame = window.requestAnimationFrame(fitToView);
    return () => window.cancelAnimationFrame(frame);
  }, [fitToView]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.08 : 0.92;

      setTransform((current) => {
        const scale = clamp(current.scale * factor, 0.1, 3);
        const ratio = scale / current.scale;
        return {
          scale,
          tx: cx - ratio * (cx - current.tx),
          ty: cy - ratio * (cy - current.ty),
        };
      });
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      panStart.current = { x: touch.clientX, y: touch.clientY, tx: transform.tx, ty: transform.ty };
      pinchStart.current = null;
    }

    if (event.touches.length === 2) {
      panStart.current = null;
      pinchStart.current = {
        dist: getTouchDistance(event.touches[0], event.touches[1]),
        scale: transform.scale,
      };
    }
  }, [transform.scale, transform.tx, transform.ty]);

  const onTouchMove = useCallback((event: React.TouchEvent) => {
    event.preventDefault();

    if (event.touches.length === 1 && panStart.current) {
      const touch = event.touches[0];
      const start = panStart.current;
      setTransform((current) => ({
        ...current,
        tx: start.tx + touch.clientX - start.x,
        ty: start.ty + touch.clientY - start.y,
      }));
    }

    if (event.touches.length === 2 && pinchStart.current) {
      const center = getTouchCenter(event.touches[0], event.touches[1]);
      const rect = containerRef.current?.getBoundingClientRect();
      const distance = getTouchDistance(event.touches[0], event.touches[1]);
      const scale = clamp(pinchStart.current.scale * (distance / pinchStart.current.dist), 0.1, 3);

      if (!rect) {
        setTransform((current) => ({ ...current, scale }));
        return;
      }

      const cx = center.x - rect.left;
      const cy = center.y - rect.top;

      setTransform((current) => {
        const ratio = scale / current.scale;
        return {
          scale,
          tx: cx - ratio * (cx - current.tx),
          ty: cy - ratio * (cy - current.ty),
        };
      });
    }
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    panStart.current = { x: event.clientX, y: event.clientY, tx: transform.tx, ty: transform.ty };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [transform.tx, transform.ty]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!panStart.current || event.pointerType === "touch") return;
    const start = panStart.current;
    setTransform((current) => ({
      ...current,
      tx: start.tx + event.clientX - start.x,
      ty: start.ty + event.clientY - start.y,
    }));
  }, []);

  const clearGesture = useCallback(() => {
    panStart.current = null;
    pinchStart.current = null;
  }, []);

  return {
    containerRef,
    fitToView,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: clearGesture,
      onTouchEnd: clearGesture,
      onTouchMove,
      onTouchStart,
    },
    transform,
  };
}
