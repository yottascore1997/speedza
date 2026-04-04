import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

export type FirebasePhoneAuthWebHandle = {
  sendOtp: (e164Phone: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<string>;
};

type Msg =
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
};

function buildHtml(cfg: Props["firebaseConfig"]): string {
  const c = JSON.stringify(cfg);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:transparent;">
<div id="recaptcha-container"></div>
<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js"></script>
<script>
(function(){
  var cfg = ${c};
  firebase.initializeApp(cfg);
  window.__confirmation = null;

  window.__sendOtp = function(phone) {
    try {
      var verifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'invisible' });
      firebase.auth().signInWithPhoneNumber(phone, verifier).then(function(cr) {
        window.__confirmation = cr;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'otp_sent' }));
      }).catch(function(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          message: e.message || String(e),
          code: e.code
        }));
      });
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: e.message || String(e),
        code: e.code
      }));
    }
  };

  window.__verifyOtp = function(code) {
    try {
      if (!window.__confirmation) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          message: 'No pending verification. Request OTP again.',
          code: 'auth/no-confirmation'
        }));
        return;
      }
      window.__confirmation.confirm(code).then(function(cred) {
        return cred.user.getIdToken();
      }).then(function(idToken) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'verified', idToken: idToken }));
      }).catch(function(e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          message: e.message || String(e),
          code: e.code
        }));
      });
    } catch (e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: e.message || String(e),
        code: e.code
      }));
    }
  };
})();
</script>
</body></html>`;
}

export const FirebasePhoneAuthWebView = forwardRef<FirebasePhoneAuthWebHandle, Props>(
  function FirebasePhoneAuthWebView({ firebaseConfig }, ref) {
    const webRef = useRef<WebView>(null);
    const sendResolver = useRef<{
      resolve: () => void;
      reject: (e: Error) => void;
    } | null>(null);
    const verifyResolver = useRef<{
      resolve: (t: string) => void;
      reject: (e: Error) => void;
    } | null>(null);

    const baseUrl = `https://${firebaseConfig.projectId}.firebaseapp.com`;
    const html = buildHtml(firebaseConfig);

    const onMessage = useCallback((e: WebViewMessageEvent) => {
      let msg: Msg;
      try {
        msg = JSON.parse(e.nativeEvent.data) as Msg;
      } catch {
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
    }, []);

    useImperativeHandle(ref, () => ({
      sendOtp(e164Phone: string) {
        return new Promise<void>((resolve, reject) => {
          sendResolver.current = { resolve, reject };
          const escaped = JSON.stringify(e164Phone);
          webRef.current?.injectJavaScript(`__sendOtp(${escaped}); true;`);
        });
      },
      verifyOtp(code: string) {
        return new Promise<string>((resolve, reject) => {
          verifyResolver.current = { resolve, reject };
          const escaped = JSON.stringify(code);
          webRef.current?.injectJavaScript(`__verifyOtp(${escaped}); true;`);
        });
      },
    }));

    return (
      <View style={styles.wrap} pointerEvents="none">
        <WebView
          ref={webRef}
          source={{ html, baseUrl }}
          onMessage={onMessage}
          style={styles.web}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={["*"]}
          mixedContentMode="always"
          allowsInlineMediaPlayback
          scrollEnabled={false}
          setSupportMultipleWindows={false}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0.01,
    overflow: "hidden",
    left: 0,
    top: 0,
  },
  web: { width: 2, height: 2, backgroundColor: "transparent" },
});
