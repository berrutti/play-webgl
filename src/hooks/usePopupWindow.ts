import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface UsePopupWindowReturn {
  isPopupOpen: boolean;
  openPopupWindow: () => void;
  popupControlPanel: ReactNode;
}

export const usePopupWindow = (
  renderContent: (isPopupMode: boolean) => ReactNode
): UsePopupWindowReturn => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const popupWindowRef = useRef<Window | null>(null);

  const openPopupWindow = useCallback(() => {
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      popupWindowRef.current.focus();
      return;
    }

    const popup = window.open(
      "",
      "controlPanel",
      "width=450,height=700,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no,left=100,top=100"
    );

    if (popup) {
      popupWindowRef.current = popup;
      setIsPopupOpen(true);

      popup.document.title = "Play WebGL Controls";

      const styles = Array.from(document.styleSheets);
      styles.forEach((styleSheet) => {
        try {
          if (styleSheet.href) {
            const link = popup.document.createElement("link");
            link.rel = "stylesheet";
            link.href = styleSheet.href;
            popup.document.head.appendChild(link);
          } else if (styleSheet.cssRules) {
            const style = popup.document.createElement("style");
            const cssText = Array.from(styleSheet.cssRules)
              .map((rule) => rule.cssText)
              .join("\n");
            style.textContent = cssText;
            popup.document.head.appendChild(style);
          }
        } catch {
          // Ignore CORS errors
        }
      });

      const container = popup.document.createElement("div");
      container.id = "popup-root";
      popup.document.body.appendChild(container);

      popup.addEventListener("beforeunload", () => {
        setIsPopupOpen(false);
        popupWindowRef.current = null;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (popupWindowRef.current && !popupWindowRef.current.closed) {
        popupWindowRef.current.close();
      }
    };
  }, []);

  const popupControlPanel = useMemo(() => {
    if (
      !isPopupOpen ||
      !popupWindowRef.current ||
      popupWindowRef.current.closed
    ) {
      return null;
    }

    const popupContainer =
      popupWindowRef.current.document.getElementById("popup-root");
    if (!popupContainer) return null;

    return createPortal(renderContent(true), popupContainer);
  }, [isPopupOpen, renderContent]);

  return {
    isPopupOpen,
    openPopupWindow,
    popupControlPanel,
  };
};
