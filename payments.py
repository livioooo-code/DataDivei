"""
Moduł obsługi płatności dla aplikacji dostaw.
"""
import os
import stripe
from datetime import datetime
from flask import url_for, current_app

# Konfiguracja Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

def get_domain_url():
    """Zwraca domenę aplikacji, uwzględniając środowisko (replit vs produkcja)"""
    if os.environ.get('REPLIT_DEPLOYMENT') != '':
        return f"https://{os.environ.get('REPLIT_DEV_DOMAIN')}"
    else:
        domain = os.environ.get('REPLIT_DOMAINS')
        if domain:
            return f"https://{domain.split(',')[0]}"
        return "http://localhost:5000"  # fallback dla lokalnego developmentu

def create_checkout_session(delivery):
    """
    Tworzy sesję płatności Stripe dla dostawy.
    
    Args:
        delivery: Obiekt dostawy
        
    Returns:
        URL do strony płatności Stripe
    """
    try:
        # Przygotuj opis produktu
        delivery_description = f"Dostawa #{delivery.id}: {delivery.pickup_address} -> {delivery.delivery_address}"
        
        # Utwórz sesję płatności
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[
                {
                    'price_data': {
                        'currency': 'pln',
                        'product_data': {
                            'name': f'Dostawa #{delivery.id}',
                            'description': delivery_description,
                        },
                        'unit_amount': int(delivery.price * 100),  # Stripe wymaga kwoty w groszach
                    },
                    'quantity': 1,
                },
            ],
            mode='payment',
            success_url=get_domain_url() + url_for('payment_success', delivery_id=delivery.id),
            cancel_url=get_domain_url() + url_for('payment_cancel', delivery_id=delivery.id),
        )
        
        return checkout_session.url
    except Exception as e:
        current_app.logger.error(f"Błąd tworzenia sesji płatności Stripe: {str(e)}")
        return None

def check_payment_status(payment_id):
    """
    Sprawdza status płatności w Stripe.
    
    Args:
        payment_id: ID płatności Stripe
    
    Returns:
        Słownik z informacjami o płatności lub None w przypadku błędu
    """
    try:
        payment_intent = stripe.PaymentIntent.retrieve(payment_id)
        return {
            'status': payment_intent.status,
            'amount': payment_intent.amount / 100,  # Konwersja z groszy na złote
            'currency': payment_intent.currency,
            'payment_method': payment_intent.payment_method,
            'created': datetime.fromtimestamp(payment_intent.created),
        }
    except Exception as e:
        current_app.logger.error(f"Błąd sprawdzania statusu płatności Stripe: {str(e)}")
        return None

def mark_delivery_as_paid(delivery, payment_id):
    """
    Oznacza dostawę jako opłaconą.
    
    Args:
        delivery: Obiekt dostawy
        payment_id: ID płatności Stripe
    """
    from models import db
    
    try:
        delivery.payment_status = 'paid'
        delivery.payment_id = payment_id
        delivery.paid_at = datetime.utcnow()
        
        db.session.commit()
        return True
    except Exception as e:
        current_app.logger.error(f"Błąd oznaczania dostawy jako opłaconej: {str(e)}")
        db.session.rollback()
        return False