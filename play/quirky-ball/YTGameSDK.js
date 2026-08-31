/**
 * Adapted from Google's Apache-2.0 YouTube Playables Godot wrapper.
 * https://github.com/google/web-game-samples/tree/main/Godot
 */
(function () {
    "use strict";

    let callbacksInstalled = false;
    let localSave = "";

    function callbacks() {
        return window.GodotYTCallbacks || {};
    }

    function call(name, ...args) {
        const fn = callbacks()[name];
        if (typeof fn === "function") {
            fn(...args);
        }
    }

    function inEnvironment() {
        return typeof window.ytgame !== "undefined" && Boolean(window.ytgame.IN_PLAYABLES_ENV);
    }

    function reportSDKError(error) {
        console.error("[YouTubePlayables]", error);
        if (inEnvironment() && window.ytgame.health && typeof window.ytgame.health.logError === "function") {
            window.ytgame.health.logError();
        }
    }

    window.YTGameSDK_Godot = {
        inPlayablesEnv() {
            return inEnvironment();
        },

        getSDKVersion() {
            return inEnvironment() ? String(window.ytgame.SDK_VERSION) : "local-fallback";
        },

        firstFrameReady() {
            if (inEnvironment()) {
                window.ytgame.game.firstFrameReady();
            }
            window.__quirkyBallPlayablesFirstFrameReady = true;
        },

        gameReady() {
            if (inEnvironment()) {
                window.ytgame.game.gameReady();
            }
            window.__quirkyBallPlayablesGameReady = true;
        },

        loadData() {
            const operation = inEnvironment()
                ? window.ytgame.game.loadData()
                : Promise.resolve(localSave);
            operation.then(
                (data) => call("onLoadDataReceived", String(data || "")),
                (error) => {
                    reportSDKError(error);
                    call("onLoadDataFailed", String(error));
                }
            );
        },

        saveData(data) {
            const operation = inEnvironment()
                ? window.ytgame.game.saveData(String(data))
                : Promise.resolve().then(() => { localSave = String(data); });
            operation.then(
                () => call("onSaveSuccess"),
                (error) => {
                    reportSDKError(error);
                    call("onSaveFailed", String(error));
                }
            );
        },

        getLanguage() {
            const operation = inEnvironment()
                ? window.ytgame.system.getLanguage()
                : Promise.resolve("en");
            operation.then(
                (language) => call("onLanguageReceived", String(language || "en")),
                (error) => {
                    reportSDKError(error);
                    call("onLanguageReceived", "en");
                }
            );
        },

        isAudioEnabled() {
            return inEnvironment() ? Boolean(window.ytgame.system.isAudioEnabled()) : true;
        },

        sendScore(score) {
            if (inEnvironment()) {
                Promise.resolve(window.ytgame.engagement.sendScore({ value: Math.trunc(Number(score) || 0) }))
                    .catch(reportSDKError);
            }
            window.__quirkyBallPlayablesLastScore = Math.trunc(Number(score) || 0);
        },

        requestInterstitialAd() {
            const operation = inEnvironment()
                ? window.ytgame.ads.requestInterstitialAd()
                : Promise.resolve();
            operation.then(
                () => call("onInterstitialFinished", true, ""),
                (error) => call("onInterstitialFinished", false, String(error))
            );
        },

        requestRewardedAd(rewardId) {
            const operation = inEnvironment()
                ? window.ytgame.ads.requestRewardedAd(String(rewardId))
                : Promise.resolve(true);
            operation.then(
                (granted) => call("onRewardedFinished", Boolean(granted), ""),
                (error) => call("onRewardedFinished", false, String(error))
            );
        },

        setAllCallbacks() {
            if (!inEnvironment() || callbacksInstalled) {
                return;
            }
            callbacksInstalled = true;
            window.ytgame.system.onAudioEnabledChange((enabled) => call("onAudioEnabledChanged", Boolean(enabled)));
            window.ytgame.system.onPause(() => call("onGamePaused"));
            window.ytgame.system.onResume(() => call("onGameResumed"));
        }
    };
}());
