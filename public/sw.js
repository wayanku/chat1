self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Pesan Baru', body: 'Anda menerima pesan baru di StoryBali Cht' };
  
  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    tag: 'chat-notification',
    renotify: true,
    data: {
      url: self.location.origin
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
