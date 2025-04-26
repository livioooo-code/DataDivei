from app import db
from datetime import datetime
import json
from flask_login import UserMixin

class Route(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    start_lat = db.Column(db.Float, nullable=False)
    start_lng = db.Column(db.Float, nullable=False)
    end_lat = db.Column(db.Float, nullable=False)
    end_lng = db.Column(db.Float, nullable=False)
    polyline = db.Column(db.Text, nullable=True)  # Encoded polyline of the route
    waypoints = db.Column(db.Text, nullable=True)  # JSON string of waypoints [[lat, lng], ...]
    distance = db.Column(db.Float, nullable=True)  # Distance in meters
    duration = db.Column(db.Float, nullable=True)  # Duration in seconds
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relacja z dostawami
    deliveries = db.relationship('Delivery', backref='route', lazy=True)
    
    def __repr__(self):
        return f'<Route {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'start': [self.start_lat, self.start_lng],
            'end': [self.end_lat, self.end_lng],
            'waypoints': json.loads(self.waypoints) if self.waypoints else [],
            'polyline': self.polyline,
            'distance': self.distance,
            'duration': self.duration,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String(50), nullable=True)
    last_name = db.Column(db.String(50), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    routes = db.relationship('Route', secondary='user_routes', backref='users')
    is_courier = db.Column(db.Boolean, default=False)
    
    # Powiązanie z kurierem (1-to-1)
    courier_profile = db.relationship('Courier', backref='user', uselist=False)
    
    def __repr__(self):
        return f'<User {self.username}>'
        
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'is_courier': self.is_courier,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# Profil kuriera
class Courier(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True)
    vehicle_type = db.Column(db.String(50), nullable=True)  # Typ pojazdu (rower, samochód, itp.)
    license_plate = db.Column(db.String(20), nullable=True)  # Numer rejestracyjny (jeśli dotyczy)
    max_weight = db.Column(db.Float, nullable=True)  # Maksymalna waga przesyłek (kg)
    work_zone = db.Column(db.String(100), nullable=True)  # Preferowana strefa pracy
    status = db.Column(db.String(20), default='offline')  # Status kuriera (online, busy, offline)
    current_lat = db.Column(db.Float, nullable=True)  # Aktualna szerokość geograficzna
    current_lng = db.Column(db.Float, nullable=True)  # Aktualna długość geograficzna
    last_location_update = db.Column(db.DateTime, nullable=True)  # Ostatnia aktualizacja lokalizacji
    
    # Relacja z dostawami
    deliveries = db.relationship('Delivery', backref='courier', lazy=True)
    
    def __repr__(self):
        return f'<Courier {self.user.username}>'
        
    def to_dict(self):
        return {
            'id': self.id,
            'user': self.user.to_dict(),
            'vehicle_type': self.vehicle_type,
            'license_plate': self.license_plate,
            'max_weight': self.max_weight,
            'work_zone': self.work_zone,
            'status': self.status,
            'current_location': [self.current_lat, self.current_lng] if self.current_lat and self.current_lng else None,
            'last_location_update': self.last_location_update.isoformat() if self.last_location_update else None
        }

# Model dostawy
class Delivery(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(db.Integer, db.ForeignKey('route.id'), nullable=False)
    courier_id = db.Column(db.Integer, db.ForeignKey('courier.id'), nullable=True)
    status = db.Column(db.String(20), default='new')  # Status dostawy (new, assigned, in_progress, delivered, failed)
    
    # Informacje o przesyłce
    package_id = db.Column(db.String(50), nullable=True)  # Identyfikator paczki
    package_description = db.Column(db.Text, nullable=True)  # Opis przesyłki
    weight = db.Column(db.Float, nullable=True)  # Waga przesyłki w kg
    
    # Informacje o odbiorcy
    recipient_name = db.Column(db.String(100), nullable=False)
    recipient_phone = db.Column(db.String(20), nullable=True)
    recipient_email = db.Column(db.String(120), nullable=True)
    
    # Adresy
    pickup_address = db.Column(db.String(200), nullable=False)
    pickup_lat = db.Column(db.Float, nullable=True)
    pickup_lng = db.Column(db.Float, nullable=True)
    delivery_address = db.Column(db.String(200), nullable=False)
    delivery_lat = db.Column(db.Float, nullable=True)
    delivery_lng = db.Column(db.Float, nullable=True)
    
    # Terminy
    pickup_time = db.Column(db.DateTime, nullable=True)  # Czas odbioru przesyłki
    delivery_time = db.Column(db.DateTime, nullable=True)  # Czas dostarczenia
    estimated_delivery_time = db.Column(db.DateTime, nullable=True)  # Szacowany czas dostarczenia
    
    # Pola śledzenia
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Komentarze i notatki
    notes = db.Column(db.Text, nullable=True)
    delivery_photo = db.Column(db.String(255), nullable=True)  # Opcjonalnie: zdjęcie potwierdzające dostarczenie
    
    # Płatności
    price = db.Column(db.Float, nullable=True)  # Cena dostawy
    payment_method = db.Column(db.String(50), default='cash')  # cash, card, online, invoice
    payment_status = db.Column(db.String(50), default='pending')  # pending, paid, failed, refunded
    payment_id = db.Column(db.String(255), nullable=True)  # ID transakcji płatności (dla płatności online)
    paid_at = db.Column(db.DateTime, nullable=True)  # Kiedy zapłacono
    
    def __repr__(self):
        return f'<Delivery {self.id} - {self.status}>'
        
    def to_dict(self):
        return {
            'id': self.id,
            'route_id': self.route_id,
            'courier_id': self.courier_id,
            'status': self.status,
            'package_id': self.package_id,
            'package_description': self.package_description,
            'weight': self.weight,
            'recipient_name': self.recipient_name,
            'recipient_phone': self.recipient_phone,
            'recipient_email': self.recipient_email,
            'pickup_address': self.pickup_address,
            'pickup_location': [self.pickup_lat, self.pickup_lng] if self.pickup_lat and self.pickup_lng else None,
            'delivery_address': self.delivery_address,
            'delivery_location': [self.delivery_lat, self.delivery_lng] if self.delivery_lat and self.delivery_lng else None,
            'pickup_time': self.pickup_time.isoformat() if self.pickup_time else None,
            'delivery_time': self.delivery_time.isoformat() if self.delivery_time else None,
            'estimated_delivery_time': self.estimated_delivery_time.isoformat() if self.estimated_delivery_time else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'price': self.price,
            'payment_method': self.payment_method,
            'payment_status': self.payment_status,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None
        }

# Association table for user's saved routes
user_routes = db.Table('user_routes',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('route_id', db.Integer, db.ForeignKey('route.id'), primary_key=True),
    db.Column('is_favorite', db.Boolean, default=False),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)

# Historia statusów dostawy dla dokładnego śledzenia
class DeliveryStatusHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    delivery_id = db.Column(db.Integer, db.ForeignKey('delivery.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    latitude = db.Column(db.Float, nullable=True)  # Lokalizacja zmiany statusu
    longitude = db.Column(db.Float, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    # Relacja z dostawą
    delivery = db.relationship('Delivery', backref='status_history')
    
    def __repr__(self):
        return f'<DeliveryStatusHistory {self.id} - {self.status}>'
