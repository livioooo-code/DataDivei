# Courier Navigation System (PWA)

Kompleksowy system nawigacyjny dla kurierów, dostępny jako aplikacja Progressive Web App (PWA).

## Funkcje

- **Optymalizacja tras** - automatyczne sortowanie przystanków w najbardziej efektywnej kolejności
- **Mapy drogowe** - wizualizacja trasy na mapie z wykorzystaniem rzeczywistych dróg
- **Śledzenie w czasie rzeczywistym** - aktualizacje trasy w czasie rzeczywistym z uwzględnieniem ruchu drogowego
- **Szczegółowe informacje o przystankach** - adresy, kategorie, czasy dostawy
- **Dane pogodowe** - informacje o warunkach atmosferycznych na trasie
- **Analiza świateł drogowych** - optymalizacja przejazdu pod kątem sygnalizacji świetlnej
- **Tryb offline** - dostęp do zapisanych tras bez połączenia z internetem
- **PWA** - możliwość instalacji jako aplikacja na urządzeniach mobilnych

## Technologie

- **Backend**: Python, Flask, SQLAlchemy
- **Frontend**: JavaScript, HTML5, CSS3, Bootstrap
- **Mapy**: Leaflet
- **API**: OpenRouteService (mapy i trasy), OpenWeatherMap (dane pogodowe)
- **Baza danych**: PostgreSQL
- **PWA**: Service Workers, Web App Manifest, IndexedDB

## Instalacja jako PWA

### Na Androidzie:
1. Otwórz aplikację w Chrome
2. Kliknij ikonę "Zainstaluj" w pasku adresu lub baner instalacyjny
3. Potwierdź instalację

### Na iOS:
1. Otwórz aplikację w Safari
2. Kliknij ikonę udostępniania
3. Wybierz "Dodaj do ekranu początkowego"
4. Potwierdź instalację

## Konfiguracja środowiska deweloperskiego

### Wymagania
- Python 3.11+
- PostgreSQL
- Node.js (opcjonalnie, dla narzędzi frontendowych)

### Instalacja
1. Sklonuj repozytorium
```bash
git clone https://github.com/twojuser/courier-navigation-system.git
cd courier-navigation-system
```

2. Zainstaluj zależności
```bash
pip install -r render_requirements.txt
```

3. Skonfiguruj zmienne środowiskowe
```bash
# Stwórz plik .env z następującymi zmiennymi:
DATABASE_URL=postgresql://username:password@localhost:5432/courier_navigation
OPENROUTE_API_KEY=twoj_klucz_api
WEATHER_API_KEY=twoj_klucz_api
```

4. Uruchom aplikację
```bash
gunicorn wsgi:app
```

## Licencja

Ten projekt jest udostępniany na licencji MIT. Szczegóły znajdziesz w pliku LICENSE.