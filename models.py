from app import db
from datetime import datetime

class Route(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    start_lat = db.Column(db.Float, nullable=False)
    start_lng = db.Column(db.Float, nullable=False)
    end_lat = db.Column(db.Float, nullable=False)
    end_lng = db.Column(db.Float, nullable=False)
    polyline = db.Column(db.Text, nullable=True)  # Encoded polyline of the route
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Route {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'start': [self.start_lat, self.start_lng],
            'end': [self.end_lat, self.end_lng],
            'polyline': self.polyline
        }
