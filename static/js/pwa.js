document.addEventListener('DOMContentLoaded', function() {
  // Zarejestruj service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/static/service-worker.js')
        .then((registration) => {
          console.log('Service Worker zarejestrowany pomyślnie:', registration.scope);
        })
        .catch((error) => {
          console.error('Błąd rejestracji Service Worker:', error);
        });
    });
  }

  // Obsługa zdarzenia "beforeinstallprompt" (prompt instalacji PWA)
  let deferredPrompt;
  const installButton = document.getElementById('installPwa');
  
  // Ukryj przycisk instalacji na początku
  if (installButton) {
    installButton.style.display = 'none';
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    // Zapobiegaj automatycznemu pokazywaniu promptu
    e.preventDefault();
    // Zapisz zdarzenie, aby wywołać je później
    deferredPrompt = e;
    // Pokaż przycisk instalacji
    if (installButton) {
      installButton.style.display = 'block';
      
      // Dodaj obsługę kliknięcia przycisku instalacji
      installButton.addEventListener('click', () => {
        // Pokaż prompt instalacji
        deferredPrompt.prompt();
        // Czekaj na wybór użytkownika
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('Użytkownik zaakceptował instalację');
            // Ukryj przycisk po instalacji
            installButton.style.display = 'none';
          } else {
            console.log('Użytkownik odrzucił instalację');
          }
          // Wyczyść zapisane zdarzenie
          deferredPrompt = null;
        });
      });
    }
  });

  // Kiedy aplikacja jest już zainstalowana, ukryj przycisk instalacji
  window.addEventListener('appinstalled', (evt) => {
    console.log('Aplikacja zainstalowana!');
    if (installButton) {
      installButton.style.display = 'none';
    }
  });
});