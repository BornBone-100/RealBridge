// Firebase Messaging Service Worker
// 이 파일은 반드시 /public/firebase-messaging-sw.js 위치에 있어야 합니다.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey:            'AIzaSyC38ri7wHVQQ4DqrM5_1FFNCNdyBeIkUBU',
  authDomain:        'rd-vibe.firebaseapp.com',
  projectId:         'rd-vibe',
  storageBucket:     'rd-vibe.firebasestorage.app',
  messagingSenderId: '832744301651',
  appId:             '1:832744301651:web:9faabcfe31ae2f9f39d2a6',
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // 백그라운드 메시지 수신
  messaging.onBackgroundMessage((payload) => {
    const { title = '3rd Vibe', body = '새로운 알림이 있어요' } = payload.notification ?? {};

    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: payload.data?.type ?? 'default',
      data: payload.data ?? {},
    });
  });

  // 알림 클릭 시 앱으로 이동
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data ?? {};
    let url = '/home';

    if (data.type === 'new_message' && data.match_id) url = `/chat/${data.match_id}`;
    else if (data.type === 'new_intro') url = '/matches';
    else if (data.type === 'feedback' && data.milestone_id) {
      url = `/date-feedback?mid=${data.milestone_id}&no=${data.milestone_no ?? 1}`;
    } else if (data.type === 'match_result') url = '/matches';

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        clients.openWindow(url);
      })
    );
  });
}
