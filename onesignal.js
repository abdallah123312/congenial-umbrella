// عدّل السطرين دول بالقيم اللي هتاخدها من حساب OneSignal بتاعك (شرح في README.md)
const ONESIGNAL_APP_ID = "YOUR-ONESIGNAL-APP-ID";
const ONESIGNAL_REST_API_KEY = "YOUR-ONESIGNAL-REST-API-KEY";

// بترسل إشعار للطلاب اللي فعّلوا الإشعارات، لما يتضاف محتوى جديد.
// لو بعتّله "grade"، الإشعار هيوصل بس لطلاب الصف ده (بناءً على التاج اللي بيتسجل وقت تفعيل الإشعارات)
export async function sendNewContentNotification(message, grade) {
  if (ONESIGNAL_APP_ID.startsWith("YOUR-") || ONESIGNAL_REST_API_KEY.startsWith("YOUR-")) {
    // لسه مش متظبط، تجاهل بهدوء بدل ما يبوظ حفظ المحاضرة
    return;
  }
  try {
    const body = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: "منصة الأبطال", ar: "منصة الأبطال" },
      contents: { en: message, ar: message },
    };
    if (grade) {
      body.filters = [{ field: "tag", key: "grade", relation: "=", value: grade }];
    } else {
      body.included_segments = ["Subscribed Users"];
    }
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // فشل الإرسال ما ينفعش يوقف حفظ المحاضرة
  }
}

// بيطلب من الطالب إذن الإشعارات، وبيسجل صفه الدراسي كـ"تاج" عشان الإشعارات تستهدفه صح
export function requestNotificationPermission(grade) {
  if (typeof window === "undefined") return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      await OneSignal.Notifications.requestPermission();
      if (grade) {
        await OneSignal.User.addTag("grade", grade);
      }
    } catch (e) {}
  });
}
