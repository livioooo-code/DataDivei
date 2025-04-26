document.addEventListener('DOMContentLoaded', function() {
  // Sprawdź czy aplikacja działa w trybie standalone (zainstalowana)
  const isInStandaloneMode = () => {
    return (window.matchMedia('(display-mode: standalone)').matches) || 
           (window.navigator.standalone) || 
           document.referrer.includes('android-app://');
  };

  // Dostosuj interfejs, jeśli aplikacja jest uruchomiona jako zainstalowana
  if (isInStandaloneMode()) {
    document.body.classList.add('standalone-mode');
    console.log('Aplikacja uruchomiona w trybie standalone (zainstalowana)');
    
    // Ukryj nagłówek przeglądarki w trybie standalone na Androidzie
    if (/Android/i.test(navigator.userAgent)) {
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', '#212529');
      }
    }
  }

  // Zarejestruj service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
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
    document.body.classList.add('standalone-mode');
  });
  
  // Dodaj obsługę dla przycisku wstecz na Androidzie
  if ('navigation' in window) {
    window.addEventListener('popstate', (e) => {
      // Jeśli nie ma więcej stron w historii i aplikacja jest w trybie standalone
      if (isInStandaloneMode() && window.navigation.currentEntry?.index === 0) {
        // Zapobiegaj zamknięciu aplikacji, pokazując dialog
        if (confirm('Czy chcesz zamknąć aplikację?')) {
          window.close();
        } else {
          // Zapobiegaj zamknięciu aplikacji
          history.pushState(null, '', window.location.href);
        }
      }
    });
  }
});