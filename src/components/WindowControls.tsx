import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Copy,
  Maximize,
  Minimize,
  Minus,
  Radio,
  Square,
  X,
} from "lucide-react";
import { usePlayerChromeSettingsStore } from "../stores/usePlayerChromeSettingsStore";
import { useAppChromeStore } from "../stores/useAppChromeStore";
import { useGlass } from "@/shinoinject/useGlass";

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
  // 触摸屏上第一次点窗口控制按钮只进入 touch 模式并放大 1.5x，不执行按钮动作；
  // 放大后再点才真正触发，触发后保持放大，只有点到别处才恢复正常状态。鼠标点击不进入 touch 模式，也不被拦截。
  const [isTouchMode, setIsTouchMode] = useState(false);
  // 用 ref 同步判定，避免同一帧内 state 还没更新就被 onClick 读到旧值。
  const isTouchModeRef = useRef(false);
  // 本次点击是否已经在 pointerdown 时被吞掉，避免同一次点击的 onClick 重复执行动作。
  const swallowNextClickRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const useNativeMacFullscreenButton = usePlayerChromeSettingsStore(
    (state) => state.useNativeMacFullscreenButton,
  );
  const setIsTitlebarRevealed = useAppChromeStore(
    (state) => state.setIsTitlebarRevealed,
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

  const exitTouchMode = () => {
    isTouchModeRef.current = false;
    swallowNextClickRef.current = false;
    setIsTouchMode(false);
  };

  // 点到别处（窗口控制区以外）就恢复正常状态，包括触摸和鼠标。
  useEffect(() => {
    if (!isTouchMode) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      exitTouchMode();
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutsidePointerDown,
        true,
      );
    };
  }, [isTouchMode]);

  // 按钮被收起（标题栏隐藏或进入点击穿透）时一并恢复正常状态，避免下次出现时仍是放大的。
  useEffect(() => {
    if (!revealed) exitTouchMode();
  }, [revealed]);

  // 控件隐藏时，落在按钮区域上的触摸不穿透、也不一次性操作下面的界面：
  // 只把标题栏叫出来、把按钮直接放大到 touch 模式，等用户看清后再点。
  // 用坐标判定而不是盖一层热区，鼠标完全不受影响。
  useEffect(() => {
    if (revealed || isMainWindowClickThroughEnabled) return;
    const handleHiddenTouch = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        return;
      }
      // 拦下这次触摸，避免它落到下面的页面上触发别的操作。
      event.stopPropagation();
      event.preventDefault();
      setIsTitlebarRevealed(true);
      isTouchModeRef.current = true;
      setIsTouchMode(true);
      // 手指抬起后浏览器仍会补一个 click，它会落到刚出现的按钮或下面的页面上；
      // 这里一次性吞掉它，保证这一次触摸只负责“显示并放大”，不执行任何操作。
      const swallowClick = (clickEvent: MouseEvent) => {
        clickEvent.stopPropagation();
        clickEvent.preventDefault();
        document.removeEventListener("click", swallowClick, true);
      };
      document.addEventListener("click", swallowClick, true);
      window.setTimeout(() => {
        document.removeEventListener("click", swallowClick, true);
      }, 500);
    };
    document.addEventListener("pointerdown", handleHiddenTouch, true);
    return () => {
      document.removeEventListener("pointerdown", handleHiddenTouch, true);
    };
  }, [revealed, isMainWindowClickThroughEnabled, setIsTitlebarRevealed]);

  if (!electron) return null;

  const remoteControlVisible = revealed && !isMainWindowClickThroughEnabled;
  const standardControlsVisible = revealed && !isMainWindowClickThroughEnabled;
  const remoteBtnClass = `flex items-center justify-center w-9 h-[calc(100% - 6px)] mb-[6px] mr-[1px] transition-all bg-[linear-gradient(135deg,#fffa_20%,transparent)] hover:bg-[#307aa9] border-[1px] border-[#fffa] border-solid duration-200 text-white outline outline-1 outline-solid outline-[rgba(40,40,40,0.5)] shadow-[2px_2px_8px_2px_rgba(40,40,40,0.4)] ${
    remoteControlVisible
      ? isDaylight
        ? "pointer-events-auto translate-y-0"
        : "pointer-events-auto translate-y-0"
      : "pointer-events-none opacity-0 -translate-y-1"
  }`;
  const btnClass = `flex items-center justify-center w-9 h-[calc(100% - 6px)] mb-[6px] mr-[1px] bg-[linear-gradient(135deg,#fffa_20%,transparent)] hover:bg-[#307aa9] transition-all border-[1px] border-[#fffa] border-solid duration-200 text-white outline outline-1 outline-solid outline-[rgba(40,40,40,0.5)] shadow-[2px_2px_8px_2px_rgba(40,40,40,0.4)] ${
    standardControlsVisible
      ? isDaylight
        ? "pointer-events-auto translate-y-0"
        : "pointer-events-auto translate-y-0"
      : "pointer-events-none opacity-0 -translate-y-1"
  }`;
  const closeBtnClass = `flex items-center justify-center w-9 h-[calc(100% - 6px)] mb-[6px] mr-[3px] bg-[linear-gradient(135deg,#a97874aa_20%,#cc361ccc)] hover:bg-[#cc361c] transition-all border-[1px] border-[#fffa] border-solid duration-200 text-white outline outline-1 outline-solid outline-[rgba(40,40,40,0.5)] shadow-[2px_2px_8px_2px_rgba(40,40,40,0.4)] ${
    standardControlsVisible
      ? isDaylight
        ? "pointer-events-auto translate-y-0"
        : "pointer-events-auto translate-y-0"
      : "pointer-events-none opacity-0 -translate-y-1"
  }`;

  // 只在 pointerdown 阶段判定：touch 进入 touch 模式并吞掉本次点击，mouse 点击既不进入也不退出。
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    swallowNextClickRef.current = false;
    if (event.pointerType !== "touch") return;
    if (isTouchModeRef.current) return;
    isTouchModeRef.current = true;
    setIsTouchMode(true);
    // 这一次点击只用来进入 touch 模式，不执行按钮动作。
    swallowNextClickRef.current = true;
  };

  // 捕获阶段拦下被吞掉的那次点击，按钮自己的 onClick 不会再执行。
  // 放行的那次点击是真实操作，动作照常执行；执行完不缩小，保持放大状态直到点到别处。
  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!swallowNextClickRef.current) return;
    swallowNextClickRef.current = false;
    event.stopPropagation();
    event.preventDefault();
  };

  // 手势被系统取消（如触摸后滑走、变成滚动）时不会产生 click，别把吞点击的标记留给下一次。
  const handlePointerCancel = () => {
    swallowNextClickRef.current = false;
  };
  useGlass();
  return (
    <div
      ref={rootRef}
      className={`flex h-full origin-top-right transition-transform duration-200 ${
        isDaylight ? "text-zinc-800" : "text-[var(--text-primary)]"
      }`}
      onPointerDown={handlePointerDown}
      onPointerCancel={handlePointerCancel}
      onClickCapture={handleClickCapture}
      style={
        {
          WebkitAppRegion: "no-drag",
          pointerEvents: "none",
          transform: isTouchMode ? "scale(1.5)" : undefined,
        } as React.CSSProperties
      }
    >
      <button
        data-glass data-glass-strength="1" data-glass-blur="1" data-glass-bend="10"
        className={remoteBtnClass}
        title={t("ui.remoteControl")}
        tabIndex={remoteControlVisible ? 0 : -1}
        onClick={() => void electron.openRemoteControl?.()}
      >
        <Radio className="drop-shadow-[0_0_1px_#000]" size={15} />
      </button>
      {!hideFullscreenButton && (
        <button
          data-glass data-glass-strength="1" data-glass-blur="1" data-glass-bend="10"
          className={btnClass}
          tabIndex={standardControlsVisible ? 0 : -1}
          title={t(isFullscreen ? "ui.exitFullscreen" : "ui.enterFullscreen")}
          aria-label={t(
            isFullscreen ? "ui.exitFullscreen" : "ui.enterFullscreen",
          )}
          onClick={() => void electron.toggleFullscreenWindow()}
        >
          {isFullscreen ? <Minimize className="drop-shadow-[0_0_1px_#000]" size={13} /> : <Maximize className="drop-shadow-[0_0_1px_#000]" size={13} />}
        </button>
      )}
      <button
        data-glass data-glass-strength="1" data-glass-blur="1" data-glass-bend="10"
        className={btnClass}
        tabIndex={standardControlsVisible ? 0 : -1}
        onClick={() => electron.minimizeWindow()}
      >
        <Minus className="drop-shadow-[0_0_1px_#000]" size={16} />
      </button>
      <button
        data-glass data-glass-strength="1" data-glass-blur="1" data-glass-bend="10"
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
        data-glass data-glass-strength="1" data-glass-blur="1" data-glass-bend="10"
        className={closeBtnClass}
        tabIndex={standardControlsVisible ? 0 : -1}
        onClick={() => electron.closeWindow()}
      >
        <X className="drop-shadow-[0_0_1px_#000]" size={16} />
      </button>
    </div>
  );
}
