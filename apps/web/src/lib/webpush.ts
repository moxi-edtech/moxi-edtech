import webpush from "web-push";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const mailTo = process.env.VAPID_MAILTO || "mailto:dev@moxi-edtech.com";

if (publicKey && privateKey) {
  webpush.setVapidDetails(mailTo, publicKey, privateKey);
}

export const sendPushNotification = async (
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string; url?: string }
) => {
  try {
    const response = await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
    return response;
  } catch (error: any) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      console.log("[WebPush] Subscription has expired or is no longer valid");
      return { expired: true };
    }
    throw error;
  }
};

export default webpush;
