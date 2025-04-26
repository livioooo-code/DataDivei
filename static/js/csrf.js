/**
 * Funkcja do odświeżania tokenu CSRF i obsługi błędów związanych z wygaśnięciem tokenu
 */
document.addEventListener('DOMContentLoaded', function() {
    // Obsługa błędów AJAXowych - sprawdzenie czy mamy błąd CSRF
    $(document).ajaxError(function(event, jqXHR, ajaxSettings, thrownError) {
        if (jqXHR.status === 400 && jqXHR.responseText.includes('CSRF token')) {
            refreshCsrfToken();
        }
    });

    // Obsługa formularzy - przechwytywanie błędów CSRF
    $('form').on('submit', function(e) {
        const form = $(this);
        if (form.find('input[name="csrf_token"]').length > 0) {
            $.ajax({
                url: '/csrf-token',
                type: 'GET',
                success: function() {
                    // Kontynuuj przesyłanie formularza
                    form.unbind('submit').submit();
                },
                error: function() {
                    alert('Wystąpił błąd podczas odświeżania sesji. Proszę odświeżyć stronę.');
                }
            });
            e.preventDefault();
        }
    });

    // Funkcja odświeżająca token CSRF
    window.refreshCsrfToken = function() {
        $.ajax({
            url: '/csrf-token',
            type: 'GET',
            success: function() {
                // Token został odświeżony
                console.log('Token CSRF odświeżony');
            },
            error: function() {
                console.error('Błąd podczas odświeżania tokenu CSRF');
            }
        });
    };

    // Odświeżaj token co 30 minut
    setInterval(refreshCsrfToken, 30 * 60 * 1000);
});