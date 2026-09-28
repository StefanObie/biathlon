"use client";

import { useCallback, useEffect, useReducer } from "react";

import { nextCameraState, wokenAt } from "@/lib/scan/camera-sleep";

/**
 * Whether the Position screen's camera should be on (#17). The camera
 * starts awake, sleeps after a while with no scan or manual entry and
 * whenever the page is hidden, and wakes on `wake`. `markUsed` is called for
 * each scan or manual entry of an accepted athlete to keep it awake.
 */
export function useCameraSleep(): {
  awake: boolean;
  wake: () => void;
  markUsed: () => void;
} {
  const [state, dispatch] = useReducer(nextCameraState, undefined, () =>
    wokenAt(Date.now()),
  );

  // A coarse tick is enough: the camera sleeping a second late doesn't
  // matter, and it only runs while the camera is on.
  useEffect(() => {
    if (!state.awake) return;
    const interval = setInterval(
      () => dispatch({ type: "tick", at: Date.now() }),
      1000,
    );
    return () => clearInterval(interval);
  }, [state.awake]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) dispatch({ type: "hidden" });
    }
    // The page may have opened in a background tab.
    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const wake = useCallback(
    () => dispatch({ type: "wake", at: Date.now() }),
    [],
  );
  const markUsed = useCallback(
    () => dispatch({ type: "used", at: Date.now() }),
    [],
  );

  return { awake: state.awake, wake, markUsed };
}
