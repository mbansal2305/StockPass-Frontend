import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Position {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  arrowLeft: number;
  above: boolean;
}

export function getAssignmentPopoverPosition(
  anchor: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  viewport: { width: number; height: number; left?: number; top?: number },
  contentHeight: number
): Position {
  const margin = 8;
  const gap = 10;
  const viewportLeft = viewport.left ?? 0;
  const viewportTop = viewport.top ?? 0;
  const width = Math.min(352, Math.max(0, viewport.width - margin * 2));
  const left = Math.max(viewportLeft + margin, Math.min(anchor.left, viewportLeft + viewport.width - width - margin));
  const below = Math.max(0, viewportTop + viewport.height - anchor.bottom - gap - margin);
  const above = Math.max(0, anchor.top - viewportTop - gap - margin);
  const placeAbove = contentHeight > below && above > below;
  const maxHeight = Math.min(Math.max(0, viewport.height - margin * 2), placeAbove ? above : below);
  const height = Math.min(contentHeight, maxHeight);
  const preferredTop = placeAbove ? anchor.top - gap - height : anchor.bottom + gap;
  const top = Math.max(viewportTop + margin, Math.min(preferredTop, viewportTop + viewport.height - margin - height));
  const arrowLeft = Math.max(12, Math.min(width - 12, (anchor.left + anchor.right) / 2 - left));
  return { left, top, width, maxHeight, arrowLeft, above: placeAbove };
}

interface AssignmentPopoverProps {
  anchor: HTMLElement;
  mode: 'picker' | 'editor';
  onDismiss: () => void;
  children: React.ReactNode;
}

export const AssignmentPopover: React.FC<AssignmentPopoverProps> = ({ anchor, mode, onDismiss, children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (!contentRef.current) return;
      const viewport = window.visualViewport;
      const next = getAssignmentPopoverPosition(anchor.getBoundingClientRect(), {
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
        left: viewport?.offsetLeft ?? 0,
        top: viewport?.offsetTop ?? 0
      }, contentRef.current.scrollHeight + 2);
      setPosition(current => current && Object.keys(next).every(key => current[key as keyof Position] === next[key as keyof Position]) ? current : next);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    const observer = new ResizeObserver(updatePosition);
    if (contentRef.current) observer.observe(contentRef.current);
    observer.observe(anchor);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [anchor, mode]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (window.innerWidth < 640) panel.focus();
    else (panel.querySelector<HTMLInputElement>('input') || panel).focus();
  }, [mode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        dismissRef.current();
      } else if (event.key === 'Tab' && panelRef.current) {
        const elements = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'));
        if (!elements.length) {
          event.preventDefault();
          return;
        }
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (anchor.isConnected) anchor.focus();
    };
  }, [anchor]);

  const style: React.CSSProperties = position
    ? { left: position.left, top: position.top, width: position.width }
    : { visibility: 'hidden' };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100] bg-transparent" onClick={() => dismissRef.current()} />
      <div ref={panelRef} id="wagon-assignment-dialog" role="dialog" aria-modal="true" aria-label={mode === 'picker' ? 'Select vehicle' : 'Vehicle assignment'} tabIndex={-1}
        style={style} className="fixed z-[101] rounded-xl bg-white shadow-xl outline-none">
        {position && (
          <span aria-hidden="true" style={{ left: position.arrowLeft - 6, ...(position.above ? { bottom: -6 } : { top: -6 }) }}
            className={`absolute h-3 w-3 rotate-45 border-blue-200 bg-white ${position.above ? 'border-b border-r' : 'border-l border-t'}`} />
        )}
        <div ref={contentRef} style={{ maxHeight: position?.maxHeight }}
          className="relative overflow-y-auto overscroll-contain rounded-xl border border-blue-200 bg-white">
          {children}
        </div>
      </div>
    </>,
    document.body
  );
};
