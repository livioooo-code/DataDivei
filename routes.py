import os
import requests
import json
import polyline
from flask import render_template, request, jsonify
from app import app, db
from models import Route

@app.route('/')
def index():
    """Render the main map page."""
    return render_template('index.html')

@app.route('/api/routes', methods=['GET'])
def get_routes():
    """Get all saved routes."""
    routes = Route.query.all()
    return jsonify([route.to_dict() for route in routes])

@app.route('/api/route/<int:route_id>', methods=['GET'])
def get_route(route_id):
    """Get a specific route by ID."""
    route = Route.query.get_or_404(route_id)
    return jsonify(route.to_dict())

@app.route('/api/directions', methods=['POST'])
def get_directions():
    """Get directions between two points using OSRM."""
    data = request.get_json()
    
    if not data or 'start' not in data or 'end' not in data:
        return jsonify({'error': 'Missing start or end coordinates'}), 400
    
    start = data['start']  # [lat, lng]
    end = data['end']      # [lat, lng]
    
    # Use OSRM API for directions (open source routing machine)
    osrm_url = f"http://router.project-osrm.org/route/v1/driving/{start[1]},{start[0]};{end[1]},{end[0]}?overview=full&geometries=polyline"
    
    try:
        response = requests.get(osrm_url)
        data = response.json()
        
        if 'routes' in data and len(data['routes']) > 0:
            route_data = data['routes'][0]
            geometry = route_data['geometry']  # This is already an encoded polyline
            
            # If you want to save the route
            if 'save' in request.args and request.args['save'] == 'true':
                name = request.args.get('name', f"Route from {start} to {end}")
                new_route = Route(
                    name=name,
                    start_lat=start[0],
                    start_lng=start[1],
                    end_lat=end[0],
                    end_lng=end[1],
                    polyline=geometry
                )
                db.session.add(new_route)
                db.session.commit()
            
            decoded_polyline = polyline.decode(geometry)
            
            return jsonify({
                'route': decoded_polyline,
                'encoded_polyline': geometry,
                'distance': route_data['distance'],
                'duration': route_data['duration']
            })
        else:
            return jsonify({'error': 'No route found'}), 404
            
    except requests.RequestException as e:
        app.logger.error(f"Error fetching directions: {str(e)}")
        return jsonify({'error': 'Failed to fetch directions'}), 500
