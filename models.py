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
        
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String(50), nullable=True)
    last_name = db.Column(db.String(50), nullable=True)
    phone = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    routes = db.relationship('Route', secondary='user_routes', backref='users')
    
    def __repr__(self):
        return f'<User {self.username}>'
        
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# Association table for user's saved routes
user_routes = db.Table('user_routes',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('route_id', db.Integer, db.ForeignKey('route.id'), primary_key=True),
    db.Column('is_favorite', db.Boolean, default=False),
    db.Column('created_at', db.DateTime, default=datetime.utcnow)
)
