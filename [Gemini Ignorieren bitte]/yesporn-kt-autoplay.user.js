// ==UserScript==
// @name         YesPorn Autoplay
// @namespace    YesPorn Autoplay
// @version      1.1
// @description  Starts the KT/Flowplayer video automatically, then unmutes after playback begins.
// @include      https://yesporn.vip/video/*/*/
// @run-at       document-idle
// @grant        none
// @icon         https://i.imgur.com/Vuowt2C.png
// ==/UserScript==

(function () {
  "use strict";

  const PLAYER_SELECTOR = "#kt_player";
  const VIDEO_SELECTOR = "#kt_player video.fp-engine";
  const PLAY_BUTTON_SELECTOR = "#kt_player .fp-play";
  const RETRY_DELAYS_MS = [0, 150, 350, 700, 1200, 2000, 3200, 5000];
  const UNMUTE_DELAY_MS = 250;
  const UNMUTE_VOLUME = 0.5;

  const attemptsBySource = new Map();
  let observedVideo = null;
  let lastScheduledSource = "";

  function getSourceKey(video) {
    return video.currentSrc || video.src || video.getAttribute("src") || "pending-src";
  }

  function getState(sourceKey) {
    let state = attemptsBySource.get(sourceKey);

    if (!state) {
      state = {
        retryIndex: 0,
        started: false,
        clickedFallback: false,
        unmuted: false,
        firstUserPauseClickArmed: false,
        firstUserPauseClickUsed: false,
      };
      attemptsBySource.set(sourceKey, state);
    }

    return state;
  }

  function prepareVideoForAutoplay(video) {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "true");
    video.preload = "auto";
  }

  function restoreAudio(video, state) {
    if (state.unmuted) {
      return;
    }

    state.unmuted = true;

    window.setTimeout(function () {
      const player = document.querySelector(PLAYER_SELECTOR);
      const api = getFlowplayerApi(player);

      video.muted = false;
      video.defaultMuted = false;
      video.removeAttribute("muted");

      if (video.volume === 0) {
        video.volume = UNMUTE_VOLUME;
      }

      if (api && typeof api.volume === "function") {
        try {
          api.volume(video.volume);
        } catch (error) {
          // The native video element has already been unmuted.
        }
      }
    }, UNMUTE_DELAY_MS);
  }

  function getFlowplayerApi(player) {
    if (!player || typeof window.flowplayer !== "function") {
      return null;
    }

    try {
      return window.flowplayer(player);
    } catch (error) {
      return null;
    }
  }

  function tryFlowplayerStart(player, video) {
    const api = getFlowplayerApi(player);

    if (!api) {
      return false;
    }

    try {
      if (api.ready && api.paused && typeof api.resume === "function") {
        api.resume();
        return true;
      }

      if (typeof api.load === "function" && !api.ready) {
        api.load(null, function () {
          if (typeof api.resume === "function") {
            api.resume();
          }
        });
        return true;
      }

      if (typeof api.play === "function") {
        api.play();
        return true;
      }
    } catch (error) {
      return false;
    }

    return false;
  }

  function syncPlayerUiForPlayback(player, video) {
    const api = getFlowplayerApi(player);

    if (api) {
      api.paused = false;
      api.playing = true;
    }

    if (player && !video.paused) {
      player.classList.remove("is-paused", "is-poster");
      player.classList.add("is-playing");
    }
  }

  function syncPlayerUiForPause(player) {
    const api = getFlowplayerApi(player);

    if (api) {
      api.paused = true;
      api.playing = false;
    }

    if (player) {
      player.classList.remove("is-playing");
      player.classList.add("is-paused");
    }
  }

  function pauseThroughPlayer(player, video) {
    const api = getFlowplayerApi(player);

    try {
      if (api && typeof api.pause === "function") {
        api.pause();
      } else {
        video.pause();
      }
    } catch (error) {
      video.pause();
    }

    syncPlayerUiForPause(player);
  }

  function isMainVideoClick(event, player) {
    if (!event.isTrusted || event.button !== 0 || !player.contains(event.target)) {
      return false;
    }

    if (
      event.target.closest(
        ".fp-controls, .fp-timeline, .fp-progress, .fp-buffer, .fp-settings-list, .fp-speed-list, .fp-dropdown, a, button"
      )
    ) {
      return false;
    }

    const controls = player.querySelector(".fp-controls");
    if (controls) {
      const controlsRect = controls.getBoundingClientRect();

      if (
        event.clientX >= controlsRect.left &&
        event.clientX <= controlsRect.right &&
        event.clientY >= controlsRect.top &&
        event.clientY <= controlsRect.bottom
      ) {
        return false;
      }
    }

    const playerRect = player.getBoundingClientRect();
    const bottomControlZone = Math.max(72, playerRect.height * 0.18);

    return event.clientY < playerRect.bottom - bottomControlZone;
  }

  function armFirstUserPauseClick(video, state) {
    const player = document.querySelector(PLAYER_SELECTOR);

    if (!player || state.firstUserPauseClickArmed || state.firstUserPauseClickUsed) {
      return;
    }

    state.firstUserPauseClickArmed = true;

    player.addEventListener(
      "click",
      function handleFirstUserPauseClick(event) {
        if (state.firstUserPauseClickUsed || !isMainVideoClick(event, player)) {
          return;
        }

        if (video.paused) {
          state.firstUserPauseClickUsed = true;
          return;
        }

        state.firstUserPauseClickUsed = true;
        event.preventDefault();
        event.stopImmediatePropagation();
        pauseThroughPlayer(player, video);
      },
      true
    );
  }

  function clickVisiblePlayButton(state) {
    if (state.clickedFallback) {
      return;
    }

    const button = document.querySelector(PLAY_BUTTON_SELECTOR);
    const player = document.querySelector(PLAYER_SELECTOR);

    if (!button || !player || !player.classList.contains("is-paused")) {
      return;
    }

    state.clickedFallback = true;
    button.click();
  }

  function clickPlayButtonForAutoplay(player, state) {
    const button = document.querySelector(PLAY_BUTTON_SELECTOR);

    if (!button || !player || !player.classList.contains("is-paused")) {
      return false;
    }

    state.clickedFallback = true;
    button.click();
    return true;
  }

  function markStarted(video, state) {
    if (!video.paused || video.currentTime > 0) {
      state.started = true;
      restoreAudio(video, state);
      armFirstUserPauseClick(video, state);
    }
  }

  function tryNativeStart(video, state) {
    if (typeof video.play !== "function") {
      return Promise.resolve(false);
    }

    try {
      const result = video.play();

      if (result && typeof result.then === "function") {
        return result
          .then(function () {
            state.started = true;
            syncPlayerUiForPlayback(document.querySelector(PLAYER_SELECTOR), video);
            return true;
          })
          .catch(function () {
            return false;
          });
      }

      markStarted(video, state);
      return Promise.resolve(state.started);
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  function scheduleAutoplay(video) {
    const sourceKey = getSourceKey(video);
    const state = getState(sourceKey);

    if (state.started || state.retryIndex >= RETRY_DELAYS_MS.length) {
      return;
    }

    const delay = RETRY_DELAYS_MS[state.retryIndex];
    state.retryIndex += 1;

    window.setTimeout(function () {
      const currentVideo = document.querySelector(VIDEO_SELECTOR);
      const currentSourceKey = currentVideo ? getSourceKey(currentVideo) : "";

      if (!currentVideo || currentSourceKey !== sourceKey || state.started) {
        return;
      }

      const player = document.querySelector(PLAYER_SELECTOR);
      prepareVideoForAutoplay(currentVideo);

      const usedPlayerStart =
        tryFlowplayerStart(player, currentVideo) || clickPlayButtonForAutoplay(player, state);

      window.setTimeout(function () {
        markStarted(currentVideo, state);

        if (
          !state.started &&
          (!usedPlayerStart || state.retryIndex >= Math.ceil(RETRY_DELAYS_MS.length / 2))
        ) {
          tryNativeStart(currentVideo, state).then(function (started) {
            markStarted(currentVideo, state);

            if (started || state.started) {
              syncPlayerUiForPlayback(player, currentVideo);
              return;
            }

            if (state.retryIndex >= Math.ceil(RETRY_DELAYS_MS.length / 2)) {
              clickVisiblePlayButton(state);
            }

            scheduleAutoplay(currentVideo);
          });
          return;
        }

        if (state.started) {
          syncPlayerUiForPlayback(player, currentVideo);
          return;
        }

        if (state.retryIndex >= Math.ceil(RETRY_DELAYS_MS.length / 2)) {
          clickVisiblePlayButton(state);
        }

        scheduleAutoplay(currentVideo);
      }, 200);
    }, delay);
  }

  function bindVideoEvents(video) {
    if (video === observedVideo) {
      return;
    }

    observedVideo = video;

    ["play", "playing", "timeupdate"].forEach(function (eventName) {
      video.addEventListener(eventName, function () {
        const state = getState(getSourceKey(video));
        markStarted(video, state);
      });
    });

    ["loadedmetadata", "loadeddata", "canplay"].forEach(function (eventName) {
      video.addEventListener(eventName, function () {
        scheduleAutoplay(video);
      });
    });
  }

  function scanForVideo() {
    const video = document.querySelector(VIDEO_SELECTOR);

    if (!video) {
      return;
    }

    bindVideoEvents(video);

    const sourceKey = getSourceKey(video);
    if (sourceKey !== lastScheduledSource || !attemptsBySource.get(sourceKey)?.started) {
      lastScheduledSource = sourceKey;
      scheduleAutoplay(video);
    }
  }

  scanForVideo();

  new MutationObserver(scanForVideo).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "class"],
  });
})();
