import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Copy,
  Maximize,
  Minimize,
  Minus,
  Pin,
  PinOff,
  Radio,
  Square,
  X,
} from "lucide-react";
import { usePlayerChromeSettingsStore } from "../stores/usePlayerChromeSettingsStore";
import { useAppChromeStore } from "../stores/useAppChromeStore";
import { useGlass } from "@/shinoinject/useGlass";

// 与 AppShell 的 TITLEBAR_REVEAL_HEIGHT、播放桥的 revealThreshold 一致：顶部 56px 是标题栏热区。
const TITLEBAR_REVEAL_HEIGHT = 56;

export default function WindowControls({
  revealed,
  isDaylight = false,
  isMainWindowClickThroughEnabled = false,
  hideFullscreenButton,
}: {
  revealed: boolean;
  isDaylight?: boolean;
  isMainWindowClickThroughEnabled?: boolean;
  hideFullscreenButton: boolean;
}) {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // 指针是否停在控制栏上：没固定时靠它把按钮留在可见状态，移开就随标题栏一起收起。
  const [isPointerInside, setIsPointerInside] = useState(false);
  // 触控按压中：整条控制栏一起放大到 1.5 倍，抬手或手势被取消就还原。
  const [isTouchPressed, setIsTouchPressed] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const useNativeMacFullscreenButton = usePlayerChromeSettingsStore(
    (state) => state.useNativeMacFullscreenButton,
  );
  const setIsTitlebarHeld = useAppChromeStore(
    (state) => state.setIsTitlebarHeld,
  );
  // 复用「始终显示标题栏控制按钮」作为固定开关：固定后常驻并写入设置，重启仍然生效。
  const isTitlebarPinned = usePlayerChromeSettingsStore(
    (state) => state.alwaysShowMainWindowTitlebar,
  );
  const handleToggleAlwaysShowMainWindowTitlebar = usePlayerChromeSettingsStore(
    (state) => state.handleToggleAlwaysShowMainWindowTitlebar,
  );
  const electron = window.electron;
  const isMac = electron?.platform === "darwin";
  const usesNativeFullscreen =
    isMac && (useNativeMacFullscreenButton || isFullscreen);
  const isExpanded = usesNativeFullscreen ? isFullscreen : isMaximized;

  useEffect(() => {
    if (!electron) return;
    let active = true;
    let fullscreenEventReceived = false;
    const unsubscribe = electron.onWindowFullscreenChanged((fullscreen) => {
      fullscreenEventReceived = true;
      if (active) setIsFullscreen(fullscreen);
    });
    const checkMaximized = async () => {
      const maximized = await electron.isWindowMaximized();
      if (active) setIsMaximized(maximized);
    };
    const checkFullscreen = async () => {
      const fullscreen = await electron.isWindowFullscreen();
      if (active && !fullscreenEventReceived) setIsFullscreen(fullscreen);
    };
    void checkMaximized();
    void checkFullscreen();
    window.addEventListener("resize", checkMaximized);
    return () => {
      active = false;
      unsubscribe?.();
      window.removeEventListener("resize", checkMaximized);
    };
  }, [electron]);

  // 三个可见性开关统一由这一处决定：固定时始终可见；没固定时看标题栏是否被叫出、或指针是否停在按钮上。
  // 触控按住期间也算可见：手指拖动会离开控制栏矩形，不能因此在按住的中途把按钮收起来。
  const controlsVisible =
    !isMainWindowClickThroughEnabled &&
    (isTitlebarPinned || revealed || isPointerInside || isTouchPressed);


  // 没固定时，光标进入控制栏所在的矩形就显示按钮（按钮此刻是透明的、不可点，所以不能用元素事件），
  // 移开就收起。用坐标判定而不是依赖 pointer-events，隐藏状态下也能被叫出来。
  useEffect(() => {
    if (isTitlebarPinned || isMainWindowClickThroughEnabled) {
      setIsPointerInside(false);
      return;
    }
    const handleMove = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      setIsPointerInside((prev) => (prev === inside ? prev : inside));
    };
    window.addEventListener("pointermove", handleMove);
    return () => {
      window.removeEventListener("pointermove", handleMove);
    };
  }, [isTitlebarPinned, isMainWindowClickThroughEnabled]);



  // 控件隐藏时，落在按钮区域上的触摸不穿透、也不一次性操作下面的界面：
  // 只把标题栏叫出来、把按钮直接放大到 touch 模式，等用户看清后再点。
  // 用坐标判定而不是盖一层热区，鼠标完全不受影响。
  useEffect(() => {
    if (controlsVisible || isMainWindowClickThroughEnabled) return;
  }, [controlsVisible, isMainWindowClickThroughEnabled]);

  if (!electron) return null;

  const remoteControlVisible = controlsVisible;
  const standardControlsVisible = controlsVisible;
  const remoteBtnClass = `flex items-center justify-center w-9 h-[calc(100% - 6px)] mb-[6px] mr-[1px] transition-all bg-[linear-gradient(135deg,#fffa_20%,transparent)] hover:bg-[#307aa9] border-[1px] border-[#fff7] border-solid duration-200 text-white outline outline-1 outline-solid outline-[rgba(40,40,40,0.5)] shadow-[2px_2px_8px_2px_rgba(40,40,40,0.4)] ${
    remoteControlVisible
      ? isDaylight
        ? "pointer-events-auto translate-y-0"
        : "pointer-events-auto translate-y-0"
      : "pointer-events-none opacity-0 -translate-y-1"
  }`;
  const btnClass = `flex items-center justify-center w-9 h-[calc(100% - 6px)] mb-[6px] mr-[1px] bg-[linear-gradient(135deg,#fffa_20%,transparent)] hover:bg-[#307aa9] transition-all border-[1px] border-[#fff7] border-solid duration-200 text-white outline outline-1 outline-solid outline-[rgba(40,40,40,0.5)] shadow-[2px_2px_8px_2px_rgba(40,40,40,0.4)] ${
    standardControlsVisible
      ? isDaylight
        ? "pointer-events-auto translate-y-0"
        : "pointer-events-auto translate-y-0"
      : "pointer-events-none opacity-0 -translate-y-1"
  }`;
  const pinBtnClass = `${btnClass} ${
    isTitlebarPinned ? "bg-[#307aa9] shadow-[inset_0_0_0_1px_#fff8]" : ""
  }`;
  const closeBtnClass = `flex items-center justify-center w-9 h-[calc(100% - 6px)] mb-[6px] mr-[3px] bg-[linear-gradient(135deg,#a97874aa_20%,#cc361ccc)] hover:bg-[#cc361c] transition-all border-[1px] border-[#fff7] border-solid duration-200 text-white outline outline-1 outline-solid outline-[rgba(40,40,40,0.5)] shadow-[2px_2px_8px_2px_rgba(40,40,40,0.4)] ${
    standardControlsVisible
      ? isDaylight
        ? "pointer-events-auto translate-y-0"
        : "pointer-events-auto translate-y-0"
      : "pointer-events-none opacity-0 -translate-y-1"
  }`;

  // 触控按压时整条控制栏一起放大到 1.5 倍；鼠标按下不进入这个状态，保持原来的点击手感。
  // 按下和松手都只在 rootRef 这一层判定：按在哪个按钮、按钮之间的空隙上都算，整条控制栏一起放大。
  const handleTouchPressStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    setIsTouchPressed(true);
  };

  // 松手才缩小，拖动期间保持放大。触屏拖动时浏览器会接管手势（滚动 / 平移）并派发
  // pointercancel，那并不代表松手，所以松手同时挂在 pointerup 和 touchend / touchcancel 上：
  // 后两者的目标始终是触摸起点所在的元素，手指拖出控制栏再抬起也照样冒泡到 rootRef，不会漏掉。
  const handleTouchRelease = (event: React.SyntheticEvent<HTMLDivElement>) => {
    if ("pointerType" in event && event.pointerType !== "touch") return;
    setIsTouchPressed(false);
  };

  // 鼠标按在控制按钮上时告诉标题栏「按住中」：按住期间（哪怕指针滑出按钮、滑出顶部）
  // 都不自动收起，松手后按指针最后的位置重新判定，回到正常的自动显隐。
  const releaseHoldRef = useRef<(() => void) | null>(null);


  useEffect(
    () => () => {
      // 组件卸载（切页、标题栏整体消失）时别把「按住中」留在 store 里。
      releaseHoldRef.current?.();
      setIsTitlebarHeld(false);
    },
    [setIsTitlebarHeld],
  );

  useGlass();
  return (
    <div
      data-glass-jelly
      ref={rootRef}
      className={`flex h-full origin-top-right transition-transform duration-200 ${
        isDaylight ? "text-zinc-800" : "text-[var(--text-primary)]"
      }${isTouchPressed ? " scale-150" : ""}`}
      onPointerDown={handleTouchPressStart}
      onPointerUp={handleTouchRelease}
      onTouchEnd={handleTouchRelease}
      onTouchCancel={handleTouchRelease}
      style={
        {
          WebkitAppRegion: "no-drag",
          pointerEvents: "none",
        } as React.CSSProperties
      }
    >
      <button
        data-glass
        data-glass-light
        data-glass-strength="0.8"
        data-glass-blur="1"
        data-glass-bend="5"
        className={pinBtnClass}
        tabIndex={standardControlsVisible ? 0 : -1}
        title={t(
          isTitlebarPinned ? "ui.unpinWindowControls" : "ui.pinWindowControls",
        )}
        aria-label={t(
          isTitlebarPinned ? "ui.unpinWindowControls" : "ui.pinWindowControls",
        )}
        aria-pressed={isTitlebarPinned}
        onClick={() =>
          handleToggleAlwaysShowMainWindowTitlebar(!isTitlebarPinned)
        }
      >
        {isTitlebarPinned ? (
          <PinOff className="drop-shadow-[0_0_1px_#000]" size={14} />
        ) : (
          <Pin className="drop-shadow-[0_0_1px_#000]" size={14} />
        )}
      </button>
      <button
        data-glass
        data-glass-strength="0.8"
        data-glass-blur="1"
        data-glass-bend="5"
        className={remoteBtnClass}
        title={t("ui.remoteControl")}
        tabIndex={remoteControlVisible ? 0 : -1}
        onClick={() => void electron.openRemoteControl?.()}
      >
        <Radio className="drop-shadow-[0_0_1px_#000]" size={15} />
      </button>
      {!hideFullscreenButton && (
        <button
          data-glass
          data-glass-strength="0.8"
          data-glass-blur="1"
          data-glass-bend="5"
          className={btnClass}
          tabIndex={standardControlsVisible ? 0 : -1}
          title={t(isFullscreen ? "ui.exitFullscreen" : "ui.enterFullscreen")}
          aria-label={t(
            isFullscreen ? "ui.exitFullscreen" : "ui.enterFullscreen",
          )}
          onClick={() => void electron.toggleFullscreenWindow()}
        >
          {isFullscreen ? (
            <Minimize className="drop-shadow-[0_0_1px_#000]" size={13} />
          ) : (
            <Maximize className="drop-shadow-[0_0_1px_#000]" size={13} />
          )}
        </button>
      )}
      <button
        data-glass
        data-glass-strength="0.8"
        data-glass-blur="1"
        data-glass-bend="5"
        className={btnClass}
        tabIndex={standardControlsVisible ? 0 : -1}
        onClick={() => electron.minimizeWindow()}
      >
        <Minus className="drop-shadow-[0_0_1px_#000]" size={16} />
      </button>
      <button
        data-glass
        data-glass-strength="0.8"
        data-glass-blur="1"
        data-glass-bend="5"
        className={btnClass}
        tabIndex={standardControlsVisible ? 0 : -1}
        title={t(
          usesNativeFullscreen
            ? isExpanded
              ? "ui.exitFullscreen"
              : "ui.enterFullscreen"
            : isExpanded
              ? "ui.restoreWindow"
              : "ui.maximizeWindow",
        )}
        aria-label={t(
          usesNativeFullscreen
            ? isExpanded
              ? "ui.exitFullscreen"
              : "ui.enterFullscreen"
            : isExpanded
              ? "ui.restoreWindow"
              : "ui.maximizeWindow",
        )}
        onClick={async () => {
          if (usesNativeFullscreen) {
            await electron.toggleFullscreenWindow();
          } else {
            await electron.toggleMaximizeWindow();
            setIsMaximized(await electron.isWindowMaximized());
          }
        }}
      >
        {usesNativeFullscreen ? (
          isExpanded ? (
            <Minimize className="drop-shadow-[0_0_1px_#000]" size={13} />
          ) : (
            <Maximize className="drop-shadow-[0_0_1px_#000]" size={13} />
          )
        ) : isExpanded ? (
          <Copy className="drop-shadow-[0_0_1px_#000]" size={13} />
        ) : (
          <Square className="drop-shadow-[0_0_1px_#000]" size={13} />
        )}
      </button>
      <button
        data-glass
        data-glass-strength="0.8"
        data-glass-blur="1"
        data-glass-bend="5"
        className={closeBtnClass}
        tabIndex={standardControlsVisible ? 0 : -1}
        onClick={() => electron.closeWindow()}
      >
        <X className="drop-shadow-[0_0_1px_#000]" size={16} />
      </button>
    </div>
  );
}
