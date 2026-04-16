import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`${label} timed out after ${ms / 1000}s. Check internet and try again.`));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export type FirebasePhoneAuthWebHandle = {
  sendOtp: (e164Phone: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<string>;
  /** After error/timeout: new WebView + clean reCAPTCHA so "Send OTP" works again */
  reset: () => void;
};

type Msg =
  | { type: "ready" }
  | { type: "otp_sent" }
  | { type: "verified"; idToken: string }
  | { type: "error"; message: string; code?: string };

type Props = {
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  };
  onReadyChange?: (ready: boolean) => void;
};

function buildHtml(cfg: Props["firebaseConfig"]): string {
  const c = JSON.stringify(cfg);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:transparent;">
<div id="recaptcha-container"></div>
<script>
(function(){
  var cfg = ${c};
  function post(obj) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  }
  var s1 = document.createElement('script');
  s1.src = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js';
  s1.onload = function() {
    var s2 = document.createElement('script');
    s2.src = 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js';
    s2.onload = function() { initBridge(); };
    s2.onerror = function() { post({ type: 'error', message: 'Failed to load firebase-auth' }); };
    document.head.appendChild(s2);
  };
  s1.onerror = function() { post({ type: 'error', message: 'Failed to load firebase-app' }); };
  document.head.appendChild(s1);

  function initBridge() {
    try {
      firebase.initializeApp(cfg);
    } catch (e) {
      post({ type: 'error', message: String(e && e.message ? e.message : e) });
      return;
    }
    window.__confirmation = null;

    window.__sendOtp = function(phone) {
      try {
        var holder = document.getElementById('recaptcha-container');
        if (holder) holder.innerHTML = '';
        var verifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'invisible' });
        firebase.auth().signInWithPhoneNumber(phone, verifier).then(function(cr) {
          window.__confirmation = cr;
          post({ type: 'otp_sent' });
        }).catch(function(e) {
          post({ type: 'error', message: e.message || String(e), code: e.code });
        });
      } catch (e) {
        post({ type: 'error', message: e.message || String(e), code: e.code });
      }
    };

    window.__verifyOtp = function(code) {
      try {
        if (!window.__confirmation) {
          post({ type: 'error', message: 'No pending verification. Request OTP again.', code: 'auth/no-confirmation' });
          return;
        }
        window.__confirmation.confirm(code).then(function(cred) {
          return cred.user.getIdToken();
        }).then(function(idToken) {
          post({ type: 'verified', idToken: idToken });
        }).catch(function(e) {
          post({ type: 'error', message: e.message || String(e), code: e.code });
        });
      } catch (e) {
        post({ type: 'error', message: e.message || String(e), code: e.code });
      }
    };

    post({ type: 'ready' });
  }
})();
</script>
</body></html>`;
}

export const FirebasePhoneAuthWebView = forwardRef<FirebasePhoneAuthWebHandle, Props>(
  function FirebasePhoneAuthWebView({ firebaseConfig, onReadyChange }, ref) {
    const { width: winW } = useWindowDimensions();
    const [sessionKey, setSessionKey] = useState(0);
    const webRef = useRef<WebView>(null);
    const sendResolver = useRef<{
      resolve: () => void;
      reject: (e: Error) => void;
    } | null>(null);
    const verifyResolver = useRef<{
      resolve: (t: string) => void;
      reject: (e: Error) => void;
    } | null>(null);
    const bridgeReady = useRef(false);
    type ReadyWaiter = { resolve: () => void; reject: (e: Error) => void };
    const readyWaiters = useRef<ReadyWaiter[]>([]);

    const baseUrl = `https://${firebaseConfig.projectId}.firebaseapp.com`;
    const html = buildHtml(firebaseConfig);

    const flushReady = useCallback(() => {
      bridgeReady.current = true;
      onReadyChange?.(true);
      readyWaiters.current.splice(0).forEach((w) => w.resolve());
    }, [onReadyChange]);

    const resetReady = useCallback(() => {
      bridgeReady.current = false;
      onReadyChange?.(false);
      readyWaiters.current.splice(0).forEach((w) => w.reject(new Error("WebView reset")));
    }, [onReadyChange]);

    useEffect(() => {
      resetReady();
    }, [sessionKey, resetReady]);

    const abortPending = useCallback((reason: string) => {
      const err = new Error(reason);
      sendResolver.current?.reject(err);
      sendResolver.current = null;
      verifyResolver.current?.reject(err);
      verifyResolver.current = null;
    }, []);

    const remount = useCallback(() => {
      abortPending("Starting over");
      setSessionKey((k) => k + 1);
    }, [abortPending]);

    const waitForBridgeReady = useCallback((maxMs: number) => {
      return new Promise<void>((resolve, reject) => {
        if (bridgeReady.current) {
          resolve();
          return;
        }
        let t: ReturnType<typeof setTimeout> | undefined;
        const wrapped: ReadyWaiter = {
          resolve: () => {
            if (t !== undefined) clearTimeout(t);
            resolve();
          },
          reject: (e) => {
            if (t !== undefined) clearTimeout(t);
            reject(e);
          },
        };
        t = setTimeout(() => {
          const i = readyWaiters.current.indexOf(wrapped);
          if (i >= 0) readyWaiters.current.splice(i, 1);
          reject(new Error("Firebase did not load in the WebView. Check network and try again."));
        }, maxMs);
        readyWaiters.current.push(wrapped);
      });
    }, []);

    const onMessage = useCallback(
      (e: WebViewMessageEvent) => {
        let msg: Msg;
        try {
          msg = JSON.parse(e.nativeEvent.data) as Msg;
        } catch {
          return;
        }
        if (msg.type === "ready") {
          flushReady();
          return;
        }
        if (msg.type === "otp_sent") {
          sendResolver.current?.resolve();
          sendResolver.current = null;
          return;
        }
        if (msg.type === "verified") {
          verifyResolver.current?.resolve(msg.idToken);
          verifyResolver.current = null;
          return;
        }
        if (msg.type === "error") {
          const err = new Error(msg.message);
          (err as Error & { code?: string }).code = msg.code;
          sendResolver.current?.reject(err);
          sendResolver.current = null;
          verifyResolver.current?.reject(err);
          verifyResolver.current = null;
        }
      },
      [flushReady],
    );

    const rejectBoth = useCallback(
      (msg: string) => {
        abortPending(msg);
      },
      [abortPending],
    );

    useImperativeHandle(ref, () => ({
      reset: () => {
        remount();
      },
      async sendOtp(e164Phone: string) {
        await waitForBridgeReady(45000);
        const inner = new Promise<void>((resolve, reject) => {
          sendResolver.current = { resolve, reject };
          const escaped = JSON.stringify(e164Phone);
          requestAnimationFrame(() => {
            webRef.current?.injectJavaScript(
              `try{__sendOtp(${escaped});}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:String(e.message||e)}));} true;`,
            );
          });
        });
        return withTimeout(inner, 120000, "Send OTP", () => {
          abortPending("Send OTP timed out");
          remount();
        });
      },
      async verifyOtp(code: string) {
        await waitForBridgeReady(45000);
        const inner = new Promise<string>((resolve, reject) => {
          verifyResolver.current = { resolve, reject };
          const escaped = JSON.stringify(code);
          requestAnimationFrame(() => {
            webRef.current?.injectJavaScript(
              `try{__verifyOtp(${escaped});}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:String(e.message||e)}));} true;`,
            );
          });
        });
        return withTimeout(inner, 120000, "Verify OTP", () => {
          abortPending("Verify OTP timed out");
          remount();
        });
      },
    }));

    return (
      <View
        style={[styles.wrap, { width: Math.min(360, winW), height: 520 }]}
        pointerEvents="none"
        collapsable={false}
      >
        <WebView
          key={sessionKey}
          ref={webRef}
          source={{ html, baseUrl }}
          onMessage={onMessage}
          style={styles.web}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          originWhitelist={["*"]}
          mixedContentMode="always"
          allowsInlineMediaPlayback
          scrollEnabled={false}
          setSupportMultipleWindows={false}
          cacheEnabled
          onError={(e) => rejectBoth(e.nativeEvent.description || "WebView error")}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: -2000,
    top: 0,
    opacity: 0.02,
    overflow: "hidden",
  },
  web: { flex: 1, width: "100%", height: "100%", backgroundColor: "transparent" },
});
